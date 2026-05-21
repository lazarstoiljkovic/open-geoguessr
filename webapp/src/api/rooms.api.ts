import axios from 'axios';
import { API_URL } from '../env';
import { Room, GameMode } from '../types';

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function createRoom(mode: GameMode = 'famous'): Promise<Room> {
  const { data } = await client.post<{ room: Room }>('/rooms/create', { mode });
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
