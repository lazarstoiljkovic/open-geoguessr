import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { UserRepository } from 'src/database/repositories/user.repository';
import { LocationService } from './location.service';
import { broadcastToRoom, getClientsInRoom } from 'src/websocket/ws.clients';
import { haversineDistance } from 'src/utils/geo.utils';
import { GameFactory, GameMode } from 'src/patterns/factory/game.factory';
import { DistanceScoringStrategy } from 'src/patterns/scoring/distance.strategy';
import { COUNTDOWN_SECONDS } from 'src/constants';
import { Location, Round } from 'src/types';

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

  async startGame(userId: string, roomCode: string, mode: GameMode = 'famous', duration = 60, totalRounds = 5): Promise<void> {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== userId) throw new Error('Only the host can start the game');
    if (room.status !== 'waiting') throw new Error('Game already started');

    const config = GameFactory.create(mode, duration, totalRounds);

    // Create empty round placeholders — location will be fetched lazily per round
    const rounds = Array.from({ length: config.totalRounds }, (_, index) => ({
      index,
      guesses: [] as [],
      startedAt: 0,
    }));

    await this.roomRepository.initGame(
      room._id.toString(),
      rounds,
      mode,
      config.roundDurationSeconds,
    );
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
    if (roundIndex >= room.totalRounds) { console.error(`[startRound] roundIndex ${roundIndex} >= totalRounds ${room.totalRounds}`); return; }

    // Lazy fetch location for this round
    const location = await this.locationService.getOneLocation(room.locationMode ?? 'famous');
    await this.roomRepository.setRoundLocation(room._id.toString(), roundIndex, location);

    const startedAt = Date.now();
    await this.roomRepository.updateCurrentRound(room._id.toString(), roundIndex, startedAt, 'playing');

    const updatedRoom = await this.roomRepository.findByCode(roomCode);
    if (!updatedRoom) return;

    const round = updatedRoom.rounds[roundIndex];
    if (!round?.location) { console.error(`[startRound] round ${roundIndex} still has no location after fetch`); return; }

    const clients = getClientsInRoom(roomCode);
    console.log(`[startRound] round=${roundIndex} location="${location.name}" broadcasting to ${clients.length} clients`);

    broadcastToRoom(roomCode, 'round_started', {
      round: this.serializeRoundForClient(round as RoundWithLocation),
      roundIndex,
      totalRounds: updatedRoom.totalRounds,
      durationSeconds: updatedRoom.roundDurationSeconds,
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

    broadcastToRoom(roomCode, 'round_ended', {
      round: updatedRoom.rounds[roundIndex],
      players: updatedRoom.players,
      isLastRound: roundIndex >= updatedRoom.totalRounds - 1,
    });
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

    const guess = {
      userId,
      lat,
      lng,
      distanceKm,
      roundScore,
      submittedAt: Date.now(),
    };

    await this.roomRepository.addGuessToRound(room._id.toString(), currentRoundIndex, guess);

    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      await this.roomRepository.updatePlayerScore(room._id.toString(), userId, player.score + roundScore);
    }

    // Check if all connected players have guessed
    const updatedRoom = await this.roomRepository.findByCode(roomCode);
    if (updatedRoom) {
      const connectedClients = getClientsInRoom(roomCode);
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

    const nextIndex = room.currentRoundIndex + 1;

    if (nextIndex >= room.totalRounds) {
      await this.roomRepository.setStatus(room._id.toString(), 'game_over');
      const finalRoom = await this.roomRepository.findByCode(roomCode);

      for (const player of finalRoom!.players) {
        await this.userRepository.updateScore(player.userId, player.score);
      }

      broadcastToRoom(roomCode, 'game_over', {
        players: finalRoom!.players.sort((a, b) => b.score - a.score),
      });
    } else {
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
