import axios from 'axios';
import { API_URL } from '../env';
import { LeaderboardEntry } from '../types';

const client = axios.create({ baseURL: API_URL });

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await client.get<{ leaderboard: LeaderboardEntry[] }>('/leaderboard');
  return data.leaderboard;
}
