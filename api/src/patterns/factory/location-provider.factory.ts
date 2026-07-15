import { Service } from 'typedi';
import { CachedLocationRepository } from 'src/database/repositories/cached-location.repository';
import { GoogleStreetViewService } from 'src/services/google-streetview.service';
import { LocationMode } from 'src/types';
import { ILocationProvider } from './location-provider.interface';
import { FamousLocationProvider } from './providers/famous-location.provider';
import { WorldLocationProvider } from './providers/world-location.provider';

export abstract class LocationProviderFactory {
  abstract createProvider(mode: LocationMode): ILocationProvider;

  async getLocation(mode: LocationMode): Promise<ReturnType<ILocationProvider['getLocation']>> {
    const provider = this.createProvider(mode);
    return provider.getLocation();
  }
}

@Service()
export class GameLocationProviderFactory extends LocationProviderFactory {
  private readonly famousProvider: FamousLocationProvider;
  private readonly worldProvider: WorldLocationProvider;

  constructor(
    cachedLocationRepo: CachedLocationRepository,
    googleSV: GoogleStreetViewService,
  ) {
    super();
    this.famousProvider = new FamousLocationProvider();
    this.worldProvider = new WorldLocationProvider(cachedLocationRepo, googleSV);
  }

  createProvider(mode: LocationMode): ILocationProvider {
    switch (mode) {
      case 'famous': return this.famousProvider;
      case 'world':  return this.worldProvider;
      default: throw new Error(`Unknown location mode: ${mode}`);
    }
  }

  getWorldProvider(): WorldLocationProvider {
    return this.worldProvider;
  }
}
