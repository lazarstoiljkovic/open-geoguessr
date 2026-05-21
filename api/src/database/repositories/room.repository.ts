import { Service } from 'typedi';
import { IRoom, RoomModel } from '../models/room.model';
import { GameStatus, Location, Player, Round } from 'src/types';

@Service()
export class RoomRepository {
  async create(data: { code: string; hostId: string; player: Player; totalRounds: number; roundDurationSeconds: number }): Promise<IRoom> {
    const room = new RoomModel({
      code: data.code,
      hostId: data.hostId,
      players: [data.player],
      totalRounds: data.totalRounds,
      roundDurationSeconds: data.roundDurationSeconds,
    });
    return room.save();
  }

  async findByCode(code: string): Promise<IRoom | null> {
    return RoomModel.findOne({ code: code.toUpperCase() }).exec();
  }

  async findById(id: string): Promise<IRoom | null> {
    return RoomModel.findById(id).exec();
  }

  async addPlayer(roomId: string, player: Player): Promise<IRoom | null> {
    return RoomModel.findByIdAndUpdate(
      roomId,
      { $push: { players: player } },
      { new: true },
    ).exec();
  }

  async updatePlayerConnection(roomId: string, userId: string, connected: boolean): Promise<void> {
    await RoomModel.findByIdAndUpdate(
      roomId,
      { $set: { 'players.$[elem].connected': connected } },
      { arrayFilters: [{ 'elem.userId': userId }] },
    ).exec();
  }

  async setStatus(roomId: string, status: GameStatus): Promise<IRoom | null> {
    return RoomModel.findByIdAndUpdate(roomId, { $set: { status } }, { new: true }).exec();
  }

  // Initializes game: stores empty round placeholders, mode, and duration all at once
  async initGame(
    roomId: string,
    rounds: Pick<Round, 'index' | 'guesses' | 'startedAt'>[],
    locationMode: string,
    roundDurationSeconds: number,
  ): Promise<IRoom | null> {
    return RoomModel.findByIdAndUpdate(
      roomId,
      { $set: { rounds, locationMode, roundDurationSeconds } },
      { new: true },
    ).exec();
  }

  async setRoundLocation(roomId: string, roundIndex: number, location: Location): Promise<void> {
    await RoomModel.findByIdAndUpdate(
      roomId,
      { $set: { 'rounds.$[elem].location': location } },
      { arrayFilters: [{ 'elem.index': roundIndex }] },
    ).exec();
  }

  async updateCurrentRound(roomId: string, roundIndex: number, startedAt: number, status: GameStatus): Promise<IRoom | null> {
    return RoomModel.findByIdAndUpdate(
      roomId,
      {
        $set: {
          currentRoundIndex: roundIndex,
          status,
          'rounds.$[elem].startedAt': startedAt,
        },
      },
      { arrayFilters: [{ 'elem.index': roundIndex }], new: true },
    ).exec();
  }

  async updatePlayerScore(roomId: string, userId: string, score: number): Promise<void> {
    await RoomModel.findByIdAndUpdate(
      roomId,
      { $set: { 'players.$[elem].score': score } },
      { arrayFilters: [{ 'elem.userId': userId }] },
    ).exec();
  }

  async addGuessToRound(roomId: string, roundIndex: number, guess: Round['guesses'][0]): Promise<IRoom | null> {
    return RoomModel.findByIdAndUpdate(
      roomId,
      { $push: { 'rounds.$[elem].guesses': guess } },
      { arrayFilters: [{ 'elem.index': roundIndex }], new: true },
    ).exec();
  }

  async setRoundEndTime(roomId: string, roundIndex: number, endedAt: number): Promise<void> {
    await RoomModel.findByIdAndUpdate(
      roomId,
      { $set: { 'rounds.$[elem].endedAt': endedAt } },
      { arrayFilters: [{ 'elem.index': roundIndex }] },
    ).exec();
  }

  async deleteOldRooms(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await RoomModel.deleteMany({ createdAt: { $lt: oneDayAgo } }).exec();
  }
}
