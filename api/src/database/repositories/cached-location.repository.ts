import { Service } from 'typedi';
import { CachedLocationModel, ICachedLocation } from '../models/cached-location.model';
import { BaseRepository } from './base.repository';

@Service()
export class CachedLocationRepository extends BaseRepository<ICachedLocation> {
  constructor() {
    super(CachedLocationModel);
  }

  async pickRandom(): Promise<ICachedLocation | null> {
    const [doc] = await this.model.aggregate<ICachedLocation>([{ $sample: { size: 1 } }]);
    return doc ?? null;
  }

  async markUsed(id: string): Promise<void> {
    await this.updateById(id, {
      $inc: { usedCount: 1 },
      $set: { lastUsedAt: new Date() },
    });
  }
}
