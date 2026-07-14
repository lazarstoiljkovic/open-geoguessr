import { Service } from 'typedi';
import { IRoom, RoomModel } from '../models/room.model';
import { ChatMessage, GameMode, GameStatus, Location, LocationMode, Player, Round } from 'src/types';
import { BaseRepository } from './base.repository';

@Service()
export class RoomRepository extends BaseRepository<IRoom> {
  constructor() {
    super(RoomModel);
  }

  async createRoom(data: {
    code: string;
    hostId: string;
    player: Player;
    totalRounds: number;
    roundDurationSeconds: number;
    locationMode: LocationMode;
    gameMode: GameMode;
    hintsEnabled: boolean;
    spectatorsAllowed: boolean;
    teamsEnabled: boolean;
    teamSize: number;
  }): Promise<IRoom> {
    return this.create({
      code: data.code,
      hostId: data.hostId,
      players: [data.player],
      totalRounds: data.totalRounds,
      roundDurationSeconds: data.roundDurationSeconds,
      locationMode: data.locationMode,
      gameMode: data.gameMode,
      hintsEnabled: data.hintsEnabled,
      spectatorsAllowed: data.spectatorsAllowed,
      teamsEnabled: data.teamsEnabled,
      teamSize: data.teamSize,
    });
  }

  async findByCode(code: string): Promise<IRoom | null> {
    return this.findOne({ code: code.toUpperCase() });
  }

  async addPlayer(roomId: string, player: Player): Promise<IRoom | null> {
    return this.model.findByIdAndUpdate(
      roomId,
      { $push: { players: player } },
      { new: true },
    ).exec();
  }

  async updatePlayerConnection(roomId: string, userId: string, connected: boolean): Promise<void> {
    await this.model.findByIdAndUpdate(
      roomId,
      { $set: { 'players.$[elem].connected': connected } },
      { arrayFilters: [{ 'elem.userId': userId }] },
    ).exec();
  }

  async setStatus(roomId: string, status: GameStatus): Promise<IRoom | null> {
    return this.updateById(roomId, { $set: { status } });
  }

  async initGame(
    roomId: string,
    rounds: Pick<Round, 'index' | 'guesses' | 'startedAt'>[],
    locationMode: string,
    roundDurationSeconds: number,
    gameMode = 'standard',
  ): Promise<IRoom | null> {
    return this.updateById(roomId, {
      $set: { rounds, locationMode, roundDurationSeconds, gameMode, eliminatedPlayerIds: [] },
    });
  }

  async setRoundLocation(roomId: string, roundIndex: number, location: Location): Promise<void> {
    await this.model.findByIdAndUpdate(
      roomId,
      { $set: { 'rounds.$[elem].location': location } },
      { arrayFilters: [{ 'elem.index': roundIndex }] },
    ).exec();
  }

  async updateCurrentRound(roomId: string, roundIndex: number, startedAt: number, status: GameStatus): Promise<IRoom | null> {
    return this.model.findByIdAndUpdate(
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
    await this.model.findByIdAndUpdate(
      roomId,
      { $set: { 'players.$[elem].score': score } },
      { arrayFilters: [{ 'elem.userId': userId }] },
    ).exec();
  }

  async addGuessToRound(roomId: string, roundIndex: number, guess: Round['guesses'][0]): Promise<IRoom | null> {
    return this.model.findByIdAndUpdate(
      roomId,
      { $push: { 'rounds.$[elem].guesses': guess } },
      { arrayFilters: [{ 'elem.index': roundIndex }], new: true },
    ).exec();
  }

  async setRoundEndTime(roomId: string, roundIndex: number, endedAt: number): Promise<void> {
    await this.model.findByIdAndUpdate(
      roomId,
      { $set: { 'rounds.$[elem].endedAt': endedAt } },
      { arrayFilters: [{ 'elem.index': roundIndex }] },
    ).exec();
  }

  async addEliminatedPlayer(roomId: string, userId: string): Promise<void> {
    await this.model.findByIdAndUpdate(
      roomId,
      { $addToSet: { eliminatedPlayerIds: userId } },
    ).exec();
  }

  async updatePlayerTeam(roomId: string, userId: string, teamId: number): Promise<IRoom | null> {
    return this.model.findByIdAndUpdate(
      roomId,
      { $set: { 'players.$[elem].teamId': teamId } },
      { arrayFilters: [{ 'elem.userId': userId }], new: true },
    ).exec();
  }

  async addMessage(roomId: string, message: ChatMessage): Promise<void> {
    await this.model.findByIdAndUpdate(
      roomId,
      { $push: { messages: { $each: [message], $slice: -200 } } },
    ).exec();
  }

  async deleteOldRooms(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.deleteMany({ createdAt: { $lt: oneDayAgo } });
  }
}
