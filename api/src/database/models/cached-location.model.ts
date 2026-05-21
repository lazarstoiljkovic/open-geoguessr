import mongoose, { Document, Schema } from 'mongoose';

export interface ICachedLocation extends Document {
  lat: number;
  lng: number;
  panoId: string;
  name: string;
  country: string;
  usedCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
}

const CachedLocationSchema = new Schema<ICachedLocation>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    panoId: { type: String, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    usedCount: { type: Number, default: 0, index: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

export const CachedLocationModel = mongoose.model<ICachedLocation>('CachedLocation', CachedLocationSchema);
