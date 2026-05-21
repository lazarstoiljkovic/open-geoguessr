import axios from 'axios';
import { API_URL } from '../env';

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function startGame(roomCode: string): Promise<void> {
  await client.post('/game/start', { roomCode });
}

export async function submitGuess(
  roomCode: string,
  lat: number,
  lng: number,
): Promise<{ distanceKm: number; roundScore: number }> {
  const { data } = await client.post<{ distanceKm: number; roundScore: number }>(
    '/game/guess',
    { roomCode, lat, lng },
  );
  return data;
}

export async function nextRound(roomCode: string): Promise<void> {
  await client.post('/game/next-round', { roomCode });
}

export async function requestHint(
  roomCode: string,
  hintType: 'continent' | 'country',
): Promise<{ value: string }> {
  const { data } = await client.post<{ value: string }>('/game/hint', { roomCode, hintType });
  return data;
}
