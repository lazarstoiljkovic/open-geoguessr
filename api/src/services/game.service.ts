import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { UserRepository } from 'src/database/repositories/user.repository';
import { LocationService } from './location.service';
import { broadcastToRoom, getClientsInRoom } from 'src/websocket/ws.clients';
import { haversineDistance } from 'src/utils/geo.utils';
import { LocationMode } from 'src/patterns/factory/game.factory';
import { DistanceScoringStrategy } from 'src/patterns/scoring/distance.strategy';
import { COUNTDOWN_SECONDS } from 'src/constants';
import { EliminationRoundResult, GameMode, Location, Round } from 'src/types';
import { IRoom } from 'src/database/models/room.model';

export type RoundWithLocation = Round & { location: Location };

const roundTimers = new Map<string, NodeJS.Timeout>();
const countdownTimers = new Map<string, NodeJS.Timeout>();

@Service()
export class GameService {
  private readonly scoring = new DistanceScoringStrategy();

  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly userRepository: UserRepository,
    private readonly locationService: LocationService,
  ) {}

  // ── Start game ─────────────────────────────────────────────────────────────

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

  // ── Round lifecycle ────────────────────────────────────────────────────────

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
      // All players skipped → no elimination, continue
      isTieBreaker = false;
    } else if (noGuessers.length > 0) {
      // Some didn't guess → they are worst, eliminate them all
      eliminatedUserIds = noGuessers;
    } else {
      // Everyone guessed → find single worst
      const maxDist = Math.max(...guessers.map((g) => g.distanceKm));
      const worst = guessers.filter((g) => g.distanceKm === maxDist);
      if (worst.length === 1) {
        eliminatedUserIds = [worst[0].userId];
      } else {
        // Exact tie → tiebreaker round, no elimination
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

  // ── Submit guess ───────────────────────────────────────────────────────────

  async submitGuess(
    userId: string,
    roomCode: string,
    lat: number,
    lng: number,
  ): Promise<{ distanceKm: number; roundScore: number }> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'playing') throw new Error('No round in progress');

    // Reject guess from eliminated players
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
    const roundScore = this.scoring.calculate({
      distanceKm,
      timeTakenSeconds,
      roundDurationSeconds: room.roundDurationSeconds,
    });

    const guess = { userId, lat, lng, distanceKm, roundScore, submittedAt: Date.now() };

    await this.roomRepository.addGuessToRound(room._id.toString(), currentRoundIndex, guess);

    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      await this.roomRepository.updatePlayerScore(room._id.toString(), userId, player.score + roundScore);
    }

    // Check if all ACTIVE players have guessed
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

  // ── Next round ─────────────────────────────────────────────────────────────

  async nextRound(userId: string, roomCode: string): Promise<void> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'round_results') throw new Error('Not in round results phase');
    if (room.hostId !== userId) throw new Error('Only the host can advance rounds');

    const eliminatedIds = room.eliminatedPlayerIds ?? [];
    const remainingCount = room.players.length - eliminatedIds.length;

    // For elimination: game ends when ≤1 player remains
    if (room.gameMode === 'elimination' && remainingCount <= 1) {
      await this.triggerGameOver(room._id.toString(), roomCode);
      return;
    }

    const nextIndex = room.currentRoundIndex + 1;

    // For standard mode: game ends when all rounds played
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
    await this.roomRepository.setStatus(roomId, 'game_over');
    const finalRoom = await this.roomRepository.findByCode(roomCode);
    if (!finalRoom) return;

    for (const player of finalRoom.players) {
      await this.userRepository.updateScore(player.userId, player.score);
    }

    broadcastToRoom(roomCode, 'game_over', {
      players: finalRoom.players.sort((a, b) => b.score - a.score),
    });
  }

  // ── Serialization ──────────────────────────────────────────────────────────

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
