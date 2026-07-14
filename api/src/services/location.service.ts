import { Service } from 'typedi';
import { Location, LocationMode } from 'src/types';
import { ICachedLocation } from 'src/database/models/cached-location.model';
import { GameLocationProviderFactory } from 'src/patterns/factory/location-provider.factory';

@Service()
export class LocationService {
  constructor(private readonly factory: GameLocationProviderFactory) {}

  async getOneLocation(mode: LocationMode): Promise<Location> {
    return this.factory.getLocation(mode);
  }

  async discoverAndSave(): Promise<ICachedLocation> {
    return this.factory.getWorldProvider().discoverAndSave();
  }
}
