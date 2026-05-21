import mongoose, { Document, Schema } from 'mongoose';
import { ChatMessage, GameMode, GameStatus, Player, Round } from 'src/types';

export interface IRoom extends Document {
  code: string;
  hostId: string;
  players: Player[];
  status: GameStatus;
  rounds: Round[];
  currentRoundIndex: number;
  totalRounds: number;
  roundDurationSeconds: number;
  locationMode: 'famous' | 'world';
  gameMode: GameMode;
  eliminatedPlayerIds: string[];
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const RoundGuessSchema = new Schema(
  {
    userId: String,
    lat: Number,
    lng: Number,
    distanceKm: Number,
    roundScore: Number,
    submittedAt: Number,
  },
  { _id: false },
);

const LocationSchema = new Schema(
  {
    id: String,
    name: String,
    country: String,
    lat: Number,
    lng: Number,
    wikipediaTitle: String,
    imageUrl: String,
    images: [String],
    mapillaryImageId: String,
  },
  { _id: false },
);

const RoundSchema = new Schema(
  {
    index: Number,
    location: LocationSchema,
    guesses: [RoundGuessSchema],
    startedAt: Number,
    endedAt: Number,
  },
  { _id: false },
);

const ChatMessageSchema = new Schema(
  {
    userId: String,
    username: String,
    text: String,
    timestamp: Number,
  },
  { _id: false },
);

const PlayerSchema = new Schema(
  {
    userId: String,
    username: String,
    isHost: Boolean,
    score: { type: Number, default: 0 },
    connected: { type: Boolean, default: true },
  },
  { _id: false },
);

const RoomSchema = new Schema<IRoom>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    hostId: { type: String, required: true },
    players: [PlayerSchema],
    status: {
      type: String,
      enum: ['waiting', 'countdown', 'playing', 'round_results', 'game_over'],
      default: 'waiting',
    },
    rounds: [RoundSchema],
    currentRoundIndex: { type: Number, default: -1 },
    totalRounds: { type: Number, default: 5 },
    roundDurationSeconds: { type: Number, default: 60 },
    locationMode: { type: String, enum: ['famous', 'world'], default: 'famous' },
    gameMode: { type: String, enum: ['standard', 'elimination'], default: 'standard' },
    eliminatedPlayerIds: { type: [String], default: [] },
    messages: { type: [ChatMessageSchema], default: [] },
  },
  { timestamps: true },
);

export const RoomModel = mongoose.model<IRoom>('Room', RoomSchema);
