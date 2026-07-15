import { Service } from 'typedi';
import { RoomRepository } from 'src/database/repositories/room.repository';
import { AuthenticatedClient, broadcastToRoom, getClientsInRoom } from '../ws.clients';
import { GameService, RoundWithLocation } from 'src/services/game.service';
import { RoomService } from 'src/services/room.service';

@Service()
export class GameHandler {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly gameService: GameService,
    private readonly roomService: RoomService,
  ) {}

  async handle(client: AuthenticatedClient, event: string, data: Record<string, unknown>): Promise<void> {
    switch (event) {
      case 'join_room':
        return this.onJoinRoom(client, data as { roomCode: string });
      case 'leave_room':
        return this.onLeaveRoom(client);
      case 'send_message':
        return this.onSendMessage(client, data as { text: string });
      case 'send_team_message':
        return this.onSendTeamMessage(client, data as { text: string });
      case 'join_team':
        return this.onJoinTeam(client, data as { teamId: number });
      case 'pin_move':
        return this.onPinMove(client, data as { lat: number; lng: number });
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
    client.send(JSON.stringify({ event: 'chat_history', data: { messages: updatedRoom!.messages ?? [] } }));

    const catchUpRoom = updatedRoom!;
    if (catchUpRoom.status === 'playing') {
      const round = catchUpRoom.rounds[catchUpRoom.currentRoundIndex];
      if (round?.location) {
        client.send(JSON.stringify({
          event: 'round_started',
          data: {
            round: this.gameService.serializeRoundForClient(round as RoundWithLocation),
            roundIndex: catchUpRoom.currentRoundIndex,
            totalRounds: catchUpRoom.totalRounds,
            durationSeconds: catchUpRoom.roundDurationSeconds,
            gameMode: catchUpRoom.gameMode,
            eliminatedPlayerIds: catchUpRoom.eliminatedPlayerIds ?? [],
          },
        }));
      }
    } else if (catchUpRoom.status === 'round_results') {
      const round = catchUpRoom.rounds[catchUpRoom.currentRoundIndex];
      if (round) {
        client.send(JSON.stringify({
          event: 'round_ended',
          data: {
            round,
            players: catchUpRoom.players,
            isLastRound: catchUpRoom.currentRoundIndex >= catchUpRoom.totalRounds - 1,
            eliminatedPlayerIds: catchUpRoom.eliminatedPlayerIds ?? [],
          },
        }));
      }
    } else if (catchUpRoom.status === 'game_over') {
      client.send(JSON.stringify({
        event: 'game_over',
        data: {
          players: [...catchUpRoom.players].sort((a, b) => b.score - a.score),
        },
      }));
    }
  }

  private async onSendMessage(client: AuthenticatedClient, data: { text: string }): Promise<void> {
    if (!client.roomCode) return;
    const text = String(data.text ?? '').trim().slice(0, 300);
    if (!text) return;

    const message = { userId: client.userId, username: client.username, text, timestamp: Date.now() };

    const room = await this.roomRepository.findByCode(client.roomCode);
    if (room) await this.roomRepository.addMessage(room._id.toString(), message);

    broadcastToRoom(client.roomCode, 'new_message', message);
  }

  private async onJoinTeam(client: AuthenticatedClient, data: { teamId: number }): Promise<void> {
    if (!client.roomCode) return;
    const teamId = Number(data.teamId);
    if (teamId !== 1 && teamId !== 2) {
      return client.send(JSON.stringify({ event: 'error', data: { message: 'Invalid teamId' } }));
    }
    try {
      await this.roomService.joinTeam(client.roomCode, client.userId, teamId);
      const updatedRoom = await this.roomRepository.findByCode(client.roomCode);
      broadcastToRoom(client.roomCode, 'room_updated', this.serializeRoom(updatedRoom!));
    } catch (err) {
      client.send(JSON.stringify({ event: 'error', data: { message: err instanceof Error ? err.message : 'Failed to join team' } }));
    }
  }

  private async onSendTeamMessage(client: AuthenticatedClient, data: { text: string }): Promise<void> {
    if (!client.roomCode) return;
    const text = String(data.text ?? '').trim().slice(0, 300);
    if (!text) return;

    const room = await this.roomRepository.findByCode(client.roomCode);
    if (!room) return;

    const sender = room.players.find((p) => p.userId === client.userId);
    if (!sender?.teamId) return;

    const message = { userId: client.userId, username: client.username, text, timestamp: Date.now(), teamId: sender.teamId };

    const teamClients = getClientsInRoom(client.roomCode).filter((c) => {
      const p = room.players.find((pl) => pl.userId === c.userId);
      return p?.teamId === sender.teamId;
    });

    const payload = JSON.stringify({ event: 'new_team_message', data: message });
    teamClients.forEach((c) => c.send(payload));
  }

  private onPinMove(client: AuthenticatedClient, data: { lat: number; lng: number }): void {
    if (!client.roomCode) return;
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!isFinite(lat) || !isFinite(lng)) return;

    broadcastToRoom(client.roomCode, 'spectator_pin_move', {
      userId: client.userId,
      username: client.username,
      lat,
      lng,
    });
  }

  private async onLeaveRoom(client: AuthenticatedClient): Promise<void> {
    if (!client.roomCode) return;
    await this.handleDisconnect(client);
    client.roomCode = undefined;
  }

  private serializeRoom(room: {
    _id: unknown; code: string; status: string; hostId: string;
    players: unknown; totalRounds: number; currentRoundIndex: number;
    roundDurationSeconds: number; locationMode?: string; gameMode?: string;
    eliminatedPlayerIds?: string[]; hintsEnabled?: boolean;
    teamsEnabled?: boolean; teamSize?: number;
  }) {
    return {
      id: room._id,
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players,
      totalRounds: room.totalRounds,
      currentRoundIndex: room.currentRoundIndex,
      roundDurationSeconds: room.roundDurationSeconds,
      locationMode: room.locationMode ?? 'famous',
      gameMode: room.gameMode ?? 'standard',
      eliminatedPlayerIds: room.eliminatedPlayerIds ?? [],
      hintsEnabled: room.hintsEnabled ?? false,
      teamsEnabled: room.teamsEnabled ?? false,
      teamSize: room.teamSize ?? 2,
    };
  }
}
