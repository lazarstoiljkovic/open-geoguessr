import axios from 'axios';
import { API_URL } from '../env';
import { Room, LocationMode, GameMode } from '../types';

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function createRoom(
  locationMode: LocationMode = 'famous',
  gameMode: GameMode = 'standard',
  totalRounds = 5,
  roundDurationSeconds = 60,
): Promise<Room> {
  const { data } = await client.post<{ room: Room }>('/rooms/create', { locationMode, gameMode, totalRounds, roundDurationSeconds });
  return data.room;
}

export async function joinRoom(code: string): Promise<Room> {
  const { data } = await client.post<{ room: Room }>('/rooms/join', { code });
  return data.room;
}

export async function getRoom(code: string): Promise<Room> {
  const { data } = await client.get<{ room: Room }>(`/rooms/${code}`);
  return data.room;
}
