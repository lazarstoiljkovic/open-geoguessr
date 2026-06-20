import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { generateRoomCode } from 'src/utils/geo.utils';
import { Player } from 'src/types';
import { LocationMode, GameMode } from 'src/patterns/factory/game.factory';
import { IGameSetup } from 'src/patterns/game-setup/game-setup.interface';
import { StandardGameSetup } from 'src/patterns/game-setup/setups/standard-game.setup';
import { EliminationGameSetup } from 'src/patterns/game-setup/setups/elimination-game.setup';
import { HintsDecorator } from 'src/patterns/game-setup/decorators/hints.decorator';
import { SpectatorDecorator } from 'src/patterns/game-setup/decorators/spectator.decorator';
import { TeamsDecorator } from 'src/patterns/game-setup/decorators/teams.decorator';

@Service()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async createRoom(
    hostId: string,
    username: string,
    locationMode: LocationMode = 'famous',
    gameMode: GameMode = 'standard',
    totalRounds = 5,
    roundDurationSeconds = 60,
    hintsEnabled = false,
    spectatorsAllowed = false,
    teamsEnabled = false,
    teamSize = 2,
  ) {
    const code = generateRoomCode();

    const player: Player = {
      userId: hostId,
      username,
      isHost: true,
      score: 0,
      connected: true,
    };

    let gameSetup: IGameSetup = gameMode === 'elimination'
      ? new EliminationGameSetup()
      : new StandardGameSetup();

    if (hintsEnabled) gameSetup = new HintsDecorator(gameSetup);
    if (spectatorsAllowed) gameSetup = new SpectatorDecorator(gameSetup);
    if (teamsEnabled) gameSetup = new TeamsDecorator(gameSetup, teamSize);

    const gameSettings = gameSetup.buildConfig();
    const actualTotalRounds = gameSettings.gameMode === 'elimination' ? 99 : totalRounds;

    const room = await this.roomRepository.createRoom({
      code,
      hostId,
      player,
      totalRounds: actualTotalRounds,
      roundDurationSeconds,
      locationMode,
      gameMode: gameSettings.gameMode,
      hintsEnabled: gameSettings.hintsEnabled,
      spectatorsAllowed: gameSettings.spectatorsAllowed,
      teamsEnabled: gameSettings.teamsEnabled,
      teamSize: gameSettings.teamSize,
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

  async joinTeam(roomCode: string, userId: string, teamId: number) {
    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) throw new Error('Room not found');
    if (!room.teamsEnabled) throw new Error('Teams are not enabled in this room');

    const playersInTeam = room.players.filter((p) => p.teamId === teamId && p.userId !== userId);
    if (playersInTeam.length >= room.teamSize) throw new Error(`Team ${teamId} is full`);

    return this.roomRepository.updatePlayerTeam(room._id.toString(), userId, teamId);
  }

  async getRoomByCode(code: string) {
    return this.roomRepository.findByCode(code);
  }
}
