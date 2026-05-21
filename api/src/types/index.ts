export interface JwtPayload {
  userId: string;
  username: string;
}

export interface Location {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  wikipediaTitle: string;
  imageUrl?: string;
  images: string[];
  mapillaryImageId?: string;
  streetViewPanoId?: string; // confirmed outdoor pano from metadata API
}

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'round_results' | 'game_over';
export type GameMode = 'standard' | 'elimination';

export interface EliminationRoundResult {
  eliminatedUserIds: string[];
  isTieBreaker: boolean;
}

export interface Player {
  userId: string;
  username: string;
  isHost: boolean;
  score: number;
  connected: boolean;
}

export interface ChatMessage {
  userId: string;
  username: string;
  text: string;
  timestamp: number;
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
  location?: Location;
  guesses: RoundGuess[];
  startedAt: number;
  endedAt?: number;
}
