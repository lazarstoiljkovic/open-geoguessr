import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { LocationService } from './location.service';
import { broadcastToRoom, getClientsInRoom } from 'src/websocket/ws.clients';
import { haversineDistance } from 'src/utils/geo.utils';
import { LocationMode } from 'src/types';
import { ScoringContext } from 'src/patterns/scoring/scoring.context';
import { ScoringStrategy } from 'src/patterns/scoring/scoring.strategy';
import { DistanceScoringStrategy } from 'src/patterns/scoring/distance.strategy';
import { TimeBonusScoringStrategy } from 'src/patterns/scoring/time-bonus.strategy';
import { HintPenaltyDecorator } from 'src/patterns/scoring/hint-penalty.decorator';
import { AccuracyBonusDecorator } from 'src/patterns/scoring/accuracy-bonus.decorator';
import { COUNTDOWN_SECONDS } from 'src/constants';
import { EliminationRoundResult, GameMode, Location, Round } from 'src/types';
import { IRoom } from 'src/database/models/room.model';
import axios from 'axios';
import { GameEventSubject } from 'src/patterns/observer/game-event-subject';
import { LeaderboardObserver } from 'src/patterns/observer/observers/leaderboard.observer';
import { BroadcastObserver } from 'src/patterns/observer/observers/broadcast.observer';

export type RoundWithLocation = Round & { location: Location };

const roundTimers = new Map<string, NodeJS.Timeout>();
const countdownTimers = new Map<string, NodeJS.Timeout>();
const hintUsage = new Map<string, Map<string, Set<string>>>();
const scoringContexts = new Map<string, ScoringContext>();

@Service()
export class GameService extends GameEventSubject {

  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly locationService: LocationService,
    leaderboardObserver: LeaderboardObserver,
    broadcastObserver: BroadcastObserver,
  ) {
    super();
    this.registerObserver(leaderboardObserver);
    this.registerObserver(broadcastObserver);
  }

  async startGame(userId: string, roomCode: string): Promise<void> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== userId) throw new Error('Only the host can start the game');
    if (room.status !== 'waiting') throw new Error('Game already started');

    const locationMode = (room.locationMode ?? 'famous') as LocationMode;
    const gameMode = (room.gameMode ?? 'standard') as GameMode;
    const roundDurationSeconds = room.roundDurationSeconds ?? 60;
    const totalRounds = room.totalRounds ?? 5;

    const rounds = Array.from({ length: totalRounds }, (_, index) => ({
      index,
      guesses: [] as [],
      startedAt: 0,
    }));

    await this.roomRepository.initGame(room._id.toString(), rounds, locationMode, roundDurationSeconds, gameMode);
    await this.roomRepository.setStatus(room._id.toString(), 'countdown');
    hintUsage.set(roomCode, new Map());

    let finalStrategy: ScoringStrategy =
      gameMode === 'elimination' ? new TimeBonusScoringStrategy() : new DistanceScoringStrategy();

    if (room.hintsEnabled) {
      finalStrategy = new HintPenaltyDecorator(finalStrategy);
    }
    finalStrategy = new AccuracyBonusDecorator(finalStrategy);

    const scoringContext = new ScoringContext();
    scoringContext.setStrategy(finalStrategy);
    scoringContexts.set(roomCode, scoringContext);

    broadcastToRoom(roomCode, 'game_countdown', { seconds: COUNTDOWN_SECONDS });

    let remaining = COUNTDOWN_SECONDS;
    const timer = setInterval(async () => {
      remaining--;
      broadcastToRoom(roomCode, 'countdown_tick', { remaining });
      if (remaining <= 0) {
        clearInterval(timer);
        countdownTimers.delete(roomCode);
        await this.startRound(roomCode, 0).catch((err) => {
          console.error('[GameService.startGame] startRound(0) failed:', err);
        });
      }
    }, 1000);
    countdownTimers.set(roomCode, timer);
  }

  async startRound(roomCode: string, roundIndex: number): Promise<void> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) { console.error(`[startRound] room not found: ${roomCode}`); return; }

    const location = await this.locationService.getOneLocation(room.locationMode ?? 'famous');
    await this.roomRepository.setRoundLocation(room._id.toString(), roundIndex, location);

    const startedAt = Date.now();
    await this.roomRepository.updateCurrentRound(room._id.toString(), roundIndex, startedAt, 'playing');

    const updatedRoom = await this.roomRepository.findByCode(roomCode);
    if (!updatedRoom) return;

    const round = updatedRoom.rounds[roundIndex];
    if (!round?.location) { console.error(`[startRound] round ${roundIndex} has no location`); return; }

    console.log(`[startRound] round=${roundIndex} location="${location.name}" mode=${room.gameMode}`);

    broadcastToRoom(roomCode, 'round_started', {
      round: this.serializeRoundForClient(round as RoundWithLocation),
      roundIndex,
      totalRounds: updatedRoom.totalRounds,
      durationSeconds: updatedRoom.roundDurationSeconds,
      gameMode: updatedRoom.gameMode,
      eliminatedPlayerIds: updatedRoom.eliminatedPlayerIds ?? [],
    });

    const timer = setTimeout(() => {
      this.endRound(roomCode, roundIndex);
    }, updatedRoom.roundDurationSeconds * 1000);

    roundTimers.set(`${roomCode}:${roundIndex}`, timer);
  }

  async endRound(roomCode: string, roundIndex: number): Promise<void> {
    const existing = roundTimers.get(`${roomCode}:${roundIndex}`);
    if (existing) {
      clearTimeout(existing);
      roundTimers.delete(`${roomCode}:${roundIndex}`);
    }

    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) return;

    await this.roomRepository.setRoundEndTime(room._id.toString(), roundIndex, Date.now());
    await this.roomRepository.setStatus(room._id.toString(), 'round_results');

    const updatedRoom = await this.roomRepository.findByCode(roomCode);
    if (!updatedRoom) return;

    let elimination: EliminationRoundResult | undefined;

    if (updatedRoom.gameMode === 'elimination') {
      elimination = await this.computeElimination(updatedRoom, roundIndex);
    }

    const isLastRound = this.checkIsLastRound(updatedRoom, elimination?.eliminatedUserIds ?? []);

    broadcastToRoom(roomCode, 'round_ended', {
      round: updatedRoom.rounds[roundIndex],
      players: updatedRoom.players,
      isLastRound,
      eliminatedPlayerIds: updatedRoom.eliminatedPlayerIds ?? [],
      ...(elimination && { elimination }),
    });
  }

  private async computeElimination(room: IRoom, roundIndex: number): Promise<EliminationRoundResult> {
    const eliminatedSoFar = room.eliminatedPlayerIds ?? [];
    const activePlayers = room.players.filter((p) => !eliminatedSoFar.includes(p.userId));
    const activePlayerIds = activePlayers.map((p) => p.userId);

    const roundGuesses = room.rounds[roundIndex].guesses.filter((g) => activePlayerIds.includes(g.userId));

    const noGuessers = activePlayerIds.filter((id) => !roundGuesses.some((g) => g.userId === id));
    const guessers = roundGuesses.map((g) => ({ userId: g.userId, distanceKm: g.distanceKm }));

    let eliminatedUserIds: string[] = [];
    let isTieBreaker = false;

    if (noGuessers.length === activePlayerIds.length) {
      isTieBreaker = false;
    } else if (noGuessers.length > 0) {
      eliminatedUserIds = noGuessers;
    } else {
      const maxDist = Math.max(...guessers.map((g) => g.distanceKm));
      const worst = guessers.filter((g) => g.distanceKm === maxDist);
      if (worst.length === 1) {
        eliminatedUserIds = [worst[0].userId];
      } else {
        isTieBreaker = true;
      }
    }

    for (const userId of eliminatedUserIds) {
      await this.roomRepository.addEliminatedPlayer(room._id.toString(), userId);
    }

    return { eliminatedUserIds, isTieBreaker };
  }

  private checkIsLastRound(room: IRoom, newlyEliminated: string[]): boolean {
    if (room.gameMode !== 'elimination') {
      return room.currentRoundIndex >= room.totalRounds - 1;
    }
    const totalEliminated = (room.eliminatedPlayerIds ?? []).length + newlyEliminated.length;
    const remaining = room.players.length - totalEliminated;
    return remaining <= 1;
  }

  async submitGuess(
    userId: string,
    roomCode: string,
    lat: number,
    lng: number,
  ): Promise<{ distanceKm: number; roundScore: number }> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'playing') throw new Error('No round in progress');

    if ((room.eliminatedPlayerIds ?? []).includes(userId)) {
      throw new Error('You have been eliminated');
    }

    const { currentRoundIndex } = room;
    const round = room.rounds[currentRoundIndex];
    if (!round?.location) throw new Error('Round has no location');

    if (round.guesses.some((g) => g.userId === userId)) {
      throw new Error('Already guessed this round');
    }

    const distanceKm = haversineDistance(lat, lng, round.location.lat, round.location.lng);
    const timeTakenSeconds = (Date.now() - round.startedAt) / 1000;
    const hintsUsed = hintUsage.get(roomCode)?.get(userId)?.size ?? 0;
    const context = scoringContexts.get(roomCode) ?? new ScoringContext();
    const roundScore = context.calculate({
      distanceKm,
      timeTakenSeconds,
      roundDurationSeconds: room.roundDurationSeconds,
      hintsUsed,
    });

    const guess = { userId, lat, lng, distanceKm, roundScore, submittedAt: Date.now() };

    await this.roomRepository.addGuessToRound(room._id.toString(), currentRoundIndex, guess);

    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      await this.roomRepository.updatePlayerScore(room._id.toString(), userId, player.score + roundScore);
    }

    const updatedRoom = await this.roomRepository.findByCode(roomCode);
    if (updatedRoom) {
      const eliminatedIds = updatedRoom.eliminatedPlayerIds ?? [];
      const connectedClients = getClientsInRoom(roomCode).filter((c) => !eliminatedIds.includes(c.userId));
      const allGuessed = connectedClients.every((c) =>
        updatedRoom.rounds[currentRoundIndex].guesses.some((g) => g.userId === c.userId),
      );
      if (allGuessed) {
        await this.endRound(roomCode, currentRoundIndex);
      }
    }

    return { distanceKm, roundScore };
  }

  async nextRound(userId: string, roomCode: string): Promise<void> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'round_results') throw new Error('Not in round results phase');
    if (room.hostId !== userId) throw new Error('Only the host can advance rounds');

    const eliminatedIds = room.eliminatedPlayerIds ?? [];
    const remainingCount = room.players.length - eliminatedIds.length;

    if (room.gameMode === 'elimination' && remainingCount <= 1) {
      await this.triggerGameOver(room._id.toString(), roomCode);
      return;
    }

    const nextIndex = room.currentRoundIndex + 1;

    if (room.gameMode !== 'elimination' && nextIndex >= room.totalRounds) {
      await this.triggerGameOver(room._id.toString(), roomCode);
      return;
    }

    const COUNTDOWN = 3;
    broadcastToRoom(roomCode, 'round_countdown', { seconds: COUNTDOWN, roundIndex: nextIndex });

    let remaining = COUNTDOWN;
    const tick = setInterval(async () => {
      remaining--;
      broadcastToRoom(roomCode, 'round_countdown_tick', { remaining });
      if (remaining <= 0) {
        clearInterval(tick);
        await this.startRound(roomCode, nextIndex).catch((err) => {
          console.error(`[GameService.nextRound] startRound(${nextIndex}) failed:`, err);
        });
      }
    }, 1000);
  }

  private async triggerGameOver(roomId: string, roomCode: string): Promise<void> {
    scoringContexts.delete(roomCode);
    await this.roomRepository.setStatus(roomId, 'game_over');
    const finalRoom = await this.roomRepository.findByCode(roomCode);
    if (!finalRoom) return;

    await this.notifyGameOver({
      roomId,
      roomCode,
      players: finalRoom.players,
    });
  }

  async requestHint(userId: string, roomCode: string, hintType: 'continent' | 'country'): Promise<{ value: string }> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (!room.hintsEnabled) throw new Error('Hints are not enabled for this room');
    if (room.status !== 'playing') throw new Error('No round in progress');

    const round = room.rounds[room.currentRoundIndex];
    if (!round?.location) throw new Error('Round has no location');

    const roomHints = hintUsage.get(roomCode) ?? new Map<string, Set<string>>();
    const userHints = roomHints.get(userId) ?? new Set<string>();

    if (userHints.has(hintType)) throw new Error(`You already used the ${hintType} hint`);

    userHints.add(hintType);
    roomHints.set(userId, userHints);
    hintUsage.set(roomCode, roomHints);

    const { lat, lng } = round.location;
    const geoRes = await axios.get('https://api.bigdatacloud.net/data/reverse-geocode-client', {
      params: { latitude: lat, longitude: lng, localityLanguage: 'en' },
      timeout: 5000,
    });

    const value = hintType === 'country'
      ? (geoRes.data.countryName ?? 'Unknown')
      : (geoRes.data.continent ?? 'Unknown');

    return { value };
  }

  serializeRoundForClient(round: RoundWithLocation) {
    return {
      index: round.index,
      location: {
        id: round.location.id,
        name: round.location.name,
        country: round.location.country,
        imageUrl: round.location.imageUrl,
        images: round.location.images ?? [],
        mapillaryImageId: round.location.mapillaryImageId,
        viewerLat: round.location.lat,
        viewerLng: round.location.lng,
        streetViewPanoId: round.location.streetViewPanoId,
      },
      startedAt: round.startedAt,
    };
  }
}
