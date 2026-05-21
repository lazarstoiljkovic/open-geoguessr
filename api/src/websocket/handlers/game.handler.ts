import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { AuthenticatedClient, broadcastToRoom, getClientsInRoom } from '../ws.clients';
import { GameService, RoundWithLocation } from 'src/services/game.service';

@Service()
export class GameHandler {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly gameService: GameService,
  ) {}

  async handle(client: AuthenticatedClient, event: string, data: Record<string, unknown>): Promise<void> {
    switch (event) {
      case 'join_room':
        return this.onJoinRoom(client, data as { roomCode: string });
      case 'leave_room':
        return this.onLeaveRoom(client);
      default:
        client.send(JSON.stringify({ event: 'error', data: { message: `Unknown event: ${event}` } }));
    }
  }

  async handleDisconnect(client: AuthenticatedClient): Promise<void> {
    const { roomCode, userId } = client;
    if (!roomCode) return;

    const room = await this.roomRepository.findByCode(roomCode);
    if (!room) return;

    await this.roomRepository.updatePlayerConnection(room._id.toString(), userId, false);

    const updatedRoom = await this.roomRepository.findByCode(roomCode);
    broadcastToRoom(roomCode, 'room_updated', this.serializeRoom(updatedRoom!));

    const activePlayers = getClientsInRoom(roomCode).filter((c) => c.userId !== userId);
    if (activePlayers.length === 0 && room.status === 'waiting') {
      await this.roomRepository.setStatus(room._id.toString(), 'game_over');
    }
  }

  private async onJoinRoom(client: AuthenticatedClient, data: { roomCode: string }): Promise<void> {
    const room = await this.roomRepository.findByCode(data.roomCode);
    if (!room) {
      return client.send(JSON.stringify({ event: 'error', data: { message: 'Room not found' } }));
    }

    client.roomCode = data.roomCode;

    const alreadyIn = room.players.some((p) => p.userId === client.userId);
    if (!alreadyIn) {
      await this.roomRepository.addPlayer(room._id.toString(), {
        userId: client.userId,
        username: client.username,
        isHost: false,
        score: 0,
        connected: true,
      });
    } else {
      await this.roomRepository.updatePlayerConnection(room._id.toString(), client.userId, true);
    }

    const updatedRoom = await this.roomRepository.findByCode(data.roomCode);
    broadcastToRoom(data.roomCode, 'room_updated', this.serializeRoom(updatedRoom!));
    client.send(JSON.stringify({ event: 'joined_room', data: this.serializeRoom(updatedRoom!) }));

    // Catch-up: if game is in progress, resend the current round
    if (updatedRoom!.status === 'playing') {
      const round = updatedRoom!.rounds[updatedRoom!.currentRoundIndex];
      if (round?.location) {
        client.send(JSON.stringify({
          event: 'round_started',
          data: {
            round: this.gameService.serializeRoundForClient(round as RoundWithLocation),
            roundIndex: updatedRoom!.currentRoundIndex,
            totalRounds: updatedRoom!.totalRounds,
            durationSeconds: updatedRoom!.roundDurationSeconds,
          },
        }));
      }
    }
  }

  private async onLeaveRoom(client: AuthenticatedClient): Promise<void> {
    if (!client.roomCode) return;
    await this.handleDisconnect(client);
    client.roomCode = undefined;
  }

  private serializeRoom(room: { _id: unknown; code: string; status: string; hostId: string; players: unknown; totalRounds: number; currentRoundIndex: number; roundDurationSeconds: number }) {
    return {
      id: room._id,
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players,
      totalRounds: room.totalRounds,
      currentRoundIndex: room.currentRoundIndex,
      roundDurationSeconds: room.roundDurationSeconds,
    };
  }
}
