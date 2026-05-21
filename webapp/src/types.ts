export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Player {
  userId: string;
  username: string;
  isHost: boolean;
  score: number;
  connected: boolean;
}

export interface RoundLocation {
  id: string;
  name: string;
  country: string;
  imageUrl?: string;
  images?: string[];
  mapillaryImageId?: string;
  streetViewPanoId?: string;
}

export interface RoundGuess {
  userId: string;
  lat: number;
  lng: number;
  distanceKm: number;
  roundScore: number;
  submittedAt: number;
}

export interface Round {
  index: number;
  location: RoundLocation & { lat?: number; lng?: number };
  guesses: RoundGuess[];
  startedAt: number;
  endedAt?: number;
}

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'round_results' | 'round_countdown' | 'game_over';
export type GameMode = 'standard' | 'elimination';
export type LocationMode = 'famous' | 'world';

export interface EliminationRoundResult {
  eliminatedUserIds: string[];
  isTieBreaker: boolean;
}

export interface LivePin {
  userId: string;
  username: string;
  lat: number;
  lng: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  status: GameStatus;
  totalRounds: number;
  currentRoundIndex: number;
  roundDurationSeconds: number;
  locationMode: LocationMode;
  gameMode: GameMode;
  eliminatedPlayerIds: string[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  totalScore: number;
  gamesPlayed: number;
}
