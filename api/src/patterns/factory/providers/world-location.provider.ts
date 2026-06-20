import axios from 'axios';
import { Location } from 'src/types';
import { ICachedLocation } from 'src/database/models/cached-location.model';
import { CachedLocationRepository } from 'src/database/repositories/cached-location.repository';
import { GoogleStreetViewService } from 'src/services/google-streetview.service';
import { ILocationProvider } from '../location-provider.interface';

interface Region {
  latMin: number; latMax: number;
  lngMin: number; lngMax: number;
  weight: number;
}

const REGIONS: Region[] = [
  { latMin: 36,  latMax: 71,  lngMin: -10,  lngMax: 40,   weight: 25 },
  { latMin: 25,  latMax: 55,  lngMin: -130, lngMax: -60,  weight: 20 },
  { latMin: 24,  latMax: 47,  lngMin: 120,  lngMax: 148,  weight: 12 },
  { latMin: -55, latMax: 15,  lngMin: -82,  lngMax: -34,  weight: 10 },
  { latMin: 0,   latMax: 25,  lngMin: 95,   lngMax: 128,  weight: 8  },
  { latMin: -45, latMax: -10, lngMin: 110,  lngMax: 155,  weight: 7  },
  { latMin: 5,   latMax: 35,  lngMin: 65,   lngMax: 92,   weight: 5  },
  { latMin: 7,   latMax: 32,  lngMin: -118, lngMax: -77,  weight: 4  },
  { latMin: 10,  latMax: 38,  lngMin: -18,  lngMax: 38,   weight: 3  },
  { latMin: -35, latMax: -10, lngMin: 15,   lngMax: 45,   weight: 3  },
  { latMin: -47, latMax: -34, lngMin: 165,  lngMax: 178,  weight: 2  },
  { latMin: 20,  latMax: 42,  lngMin: 28,   lngMax: 60,   weight: 1  },
];

const TOTAL_WEIGHT = REGIONS.reduce((s, r) => s + r.weight, 0);
const LOW_WATER_MARK = 20;
const BACKGROUND_BATCH = 15;
const MAX_DISCOVER_ATTEMPTS = 150;

function pickWeightedRegion(): Region {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const region of REGIONS) {
    rand -= region.weight;
    if (rand <= 0) return region;
  }
  return REGIONS[REGIONS.length - 1];
}

function randomCoordInRegion(r: Region): { lat: number; lng: number } {
  return {
    lat: r.latMin + Math.random() * (r.latMax - r.latMin),
    lng: r.lngMin + Math.random() * (r.lngMax - r.lngMin),
  };
}

async function reverseGeocode(lat: number, lng: number): Promise<{ name: string; country: string }> {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      headers: { 'User-Agent': 'open-geoguessr/1.0 (educational project)' },
      params: { lat, lon: lng, format: 'json', zoom: 10 },
      timeout: 5000,
    });
    const addr = res.data?.address ?? {};
    const name = addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.state ?? 'Unknown';
    const country = addr.country ?? 'Unknown';
    return { name, country };
  } catch {
    return { name: 'Unknown', country: 'Unknown' };
  }
}

export class WorldLocationProvider implements ILocationProvider {
  private filling = false;

  constructor(
    private readonly cachedLocationRepo: CachedLocationRepository,
    private readonly googleSV: GoogleStreetViewService,
  ) {}

  async getLocation(): Promise<Location> {
    const cached = await this.cachedLocationRepo.pickRandom();
    if (cached) {
      void this.maybeRefillCache();
      await this.cachedLocationRepo.markUsed(cached._id.toString());
      return this.fromCached(cached);
    }

    if (!this.googleSV.isConfigured()) {
      throw new Error('No Street View API key configured and cache is empty');
    }

    console.log('[WorldLocationProvider] Cache empty — running live discovery');
    const found = await this.discover();
    return this.fromCached(found);
  }

  async discoverAndSave(): Promise<ICachedLocation> {
    if (!this.googleSV.isConfigured()) throw new Error('GOOGLE_MAPS_API_KEY not set');
    return this.discover();
  }

  private async discover(): Promise<ICachedLocation> {
    for (let attempt = 1; attempt <= MAX_DISCOVER_ATTEMPTS; attempt++) {
      const region = pickWeightedRegion();
      const { lat, lng } = randomCoordInRegion(region);

      const pano = await this.googleSV.findNearestPanorama(lat, lng, 50);
      if (!pano) continue;

      const { name, country } = await reverseGeocode(pano.lat, pano.lng);
      const saved = await this.cachedLocationRepo.create({ lat: pano.lat, lng: pano.lng, panoId: pano.panoId, name, country });

      console.log(`[WorldLocationProvider] Discovered ${name}, ${country} after ${attempt} attempt(s)`);
      return saved;
    }

    throw new Error(`Could not find a Street View location after ${MAX_DISCOVER_ATTEMPTS} attempts`);
  }

  private async maybeRefillCache(): Promise<void> {
    if (this.filling) return;
    const count = await this.cachedLocationRepo.count();
    if (count >= LOW_WATER_MARK) return;
    if (!this.googleSV.isConfigured()) return;

    this.filling = true;
    console.log(`[WorldLocationProvider] Cache low (${count}), background-filling ${BACKGROUND_BATCH} locations`);
    (async () => {
      for (let i = 0; i < BACKGROUND_BATCH; i++) {
        await this.discover().catch(() => {});
      }
    })().finally(() => { this.filling = false; });
  }

  private fromCached(c: ICachedLocation): Location {
    return {
      id: c._id.toString(),
      name: c.name,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
      streetViewPanoId: c.panoId,
      wikipediaTitle: '',
      imageUrl: undefined,
      images: [],
      mapillaryImageId: undefined,
    };
  }
}
