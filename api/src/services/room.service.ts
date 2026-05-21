import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { generateRoomCode } from 'src/utils/geo.utils';
import { Player } from 'src/types';
import { GameFactory, GameMode } from 'src/patterns/factory/game.factory';

@Service()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async createRoom(hostId: string, username: string, mode: GameMode = 'famous') {
    const config = GameFactory.create(mode);
    const code = generateRoomCode();

    const player: Player = {
      userId: hostId,
      username,
      isHost: true,
      score: 0,
      connected: true,
    };

    const room = await this.roomRepository.create({
      code,
      hostId,
      player,
      totalRounds: config.totalRounds,
      roundDurationSeconds: config.roundDurationSeconds,
    });

    return room;
  }

  async joinRoom(code: string, userId: string, username: string) {
    const room = await this.roomRepository.findByCode(code);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Game already in progress');

    const alreadyIn = room.players.some((p) => p.userId === userId);
    if (alreadyIn) return room;

    const player: Player = {
      userId,
      username,
      isHost: false,
      score: 0,
      connected: true,
    };

    return this.roomRepository.addPlayer(room._id.toString(), player);
  }

  async getRoomByCode(code: string) {
    return this.roomRepository.findByCode(code);
  }
}
