import { Service } from 'typedi';
import { CachedLocationModel, ICachedLocation } from '../models/cached-location.model';

@Service()
export class CachedLocationRepository {
  async save(data: { lat: number; lng: number; panoId: string; name: string; country: string }): Promise<ICachedLocation> {
    return new CachedLocationModel(data).save();
  }

  async countAll(): Promise<number> {
    return CachedLocationModel.countDocuments().exec();
  }

  // Returns a uniformly random document. When cache is large this is fast enough.
  // Falls back to null when collection is empty.
  async pickRandom(): Promise<ICachedLocation | null> {
    const [doc] = await CachedLocationModel.aggregate<ICachedLocation>([{ $sample: { size: 1 } }]);
    return doc ?? null;
  }

  async markUsed(id: string): Promise<void> {
    await CachedLocationModel.findByIdAndUpdate(id, {
      $inc: { usedCount: 1 },
      $set: { lastUsedAt: new Date() },
    }).exec();
  }
}
