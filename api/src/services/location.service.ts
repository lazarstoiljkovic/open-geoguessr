import { Service } from 'typedi';
import axios from 'axios';
import { Location } from 'src/types';
import { shuffleArray } from 'src/utils/geo.utils';
import { GoogleStreetViewService } from './google-streetview.service';
import { CachedLocationRepository } from 'src/database/repositories/cached-location.repository';
import { ICachedLocation } from 'src/database/models/cached-location.model';

// ---------------------------------------------------------------------------
// Famous landmark locations (static — used for "famous" game mode)
// ---------------------------------------------------------------------------

const FAMOUS_LOCATIONS: Omit<Location, 'imageUrl' | 'images' | 'mapillaryImageId'>[] = [
  { id: 'f1',  name: 'Eiffel Tower',           country: 'France',           lat: 48.8584,   lng: 2.2945,    wikipediaTitle: '' },
  { id: 'f2',  name: 'Colosseum',              country: 'Italy',            lat: 41.8902,   lng: 12.4922,   wikipediaTitle: '' },
  { id: 'f3',  name: 'Statue of Liberty',      country: 'USA',              lat: 40.6892,   lng: -74.0445,  wikipediaTitle: '' },
  { id: 'f4',  name: 'Machu Picchu',           country: 'Peru',             lat: -13.1631,  lng: -72.545,   wikipediaTitle: '' },
  { id: 'f5',  name: 'Taj Mahal',              country: 'India',            lat: 27.1751,   lng: 78.0421,   wikipediaTitle: '' },
  { id: 'f6',  name: 'Sagrada Família',        country: 'Spain',            lat: 41.4036,   lng: 2.1744,    wikipediaTitle: '' },
  { id: 'f7',  name: 'Big Ben',                country: 'UK',               lat: 51.5007,   lng: -0.1246,   wikipediaTitle: '' },
  { id: 'f8',  name: 'Sydney Opera House',     country: 'Australia',        lat: -33.8568,  lng: 151.2153,  wikipediaTitle: '' },
  { id: 'f9',  name: 'Great Wall of China',    country: 'China',            lat: 40.4319,   lng: 116.5704,  wikipediaTitle: '' },
  { id: 'f10', name: 'Niagara Falls',          country: 'Canada/USA',       lat: 43.0962,   lng: -79.0377,  wikipediaTitle: '' },
  { id: 'f11', name: 'Chichen Itza',           country: 'Mexico',           lat: 20.6843,   lng: -88.5678,  wikipediaTitle: '' },
  { id: 'f12', name: 'Acropolis of Athens',    country: 'Greece',           lat: 37.9715,   lng: 23.7267,   wikipediaTitle: '' },
  { id: 'f13', name: 'Burj Khalifa',           country: 'UAE',              lat: 25.1972,   lng: 55.2744,   wikipediaTitle: '' },
  { id: 'f14', name: 'Christ the Redeemer',    country: 'Brazil',           lat: -22.9519,  lng: -43.2105,  wikipediaTitle: '' },
  { id: 'f15', name: 'Stonehenge',             country: 'UK',               lat: 51.1789,   lng: -1.8262,   wikipediaTitle: '' },
  { id: 'f16', name: 'Petra',                  country: 'Jordan',           lat: 30.3285,   lng: 35.4444,   wikipediaTitle: '' },
  { id: 'f17', name: 'Mount Fuji',             country: 'Japan',            lat: 35.3606,   lng: 138.7274,  wikipediaTitle: '' },
  { id: 'f18', name: 'Neuschwanstein Castle',  country: 'Germany',          lat: 47.5576,   lng: 10.7498,   wikipediaTitle: '' },
  { id: 'f19', name: 'Angkor Wat',             country: 'Cambodia',         lat: 13.4125,   lng: 103.867,   wikipediaTitle: '' },
  { id: 'f20', name: 'Santorini',              country: 'Greece',           lat: 36.3932,   lng: 25.4615,   wikipediaTitle: '' },
  { id: 'f21', name: 'Pyramids of Giza',       country: 'Egypt',            lat: 29.9792,   lng: 31.1342,   wikipediaTitle: '' },
  { id: 'f22', name: 'Alhambra',               country: 'Spain',            lat: 37.1772,   lng: -3.5902,   wikipediaTitle: '' },
  { id: 'f23', name: 'Hagia Sophia',           country: 'Turkey',           lat: 41.0086,   lng: 28.9802,   wikipediaTitle: '' },
  { id: 'f24', name: 'Golden Gate Bridge',     country: 'USA',              lat: 37.8199,   lng: -122.4783, wikipediaTitle: '' },
  { id: 'f25', name: 'Victoria Falls',         country: 'Zimbabwe/Zambia',  lat: -17.9243,  lng: 25.8572,   wikipediaTitle: '' },
  { id: 'f26', name: 'Tokyo Tower',            country: 'Japan',            lat: 35.6586,   lng: 139.7454,  wikipediaTitle: '' },
  { id: 'f27', name: 'Pompeii',                country: 'Italy',            lat: 40.7497,   lng: 14.4997,   wikipediaTitle: '' },
  { id: 'f28', name: 'Edinburgh Castle',       country: 'UK',               lat: 55.9486,   lng: -3.1999,   wikipediaTitle: '' },
  { id: 'f29', name: 'Louvre Museum',          country: 'France',           lat: 48.8606,   lng: 2.3376,    wikipediaTitle: '' },
  { id: 'f30', name: 'Colmar',                 country: 'France',           lat: 48.0794,   lng: 7.3585,    wikipediaTitle: '' },
  { id: 'f31', name: 'Hallstatt',              country: 'Austria',          lat: 47.5622,   lng: 13.6493,   wikipediaTitle: '' },
  { id: 'f32', name: 'Dubrovnik Old Town',     country: 'Croatia',          lat: 42.6410,   lng: 18.1076,   wikipediaTitle: '' },
  { id: 'f33', name: 'Charles Bridge',         country: 'Czech Republic',   lat: 50.0865,   lng: 14.4114,   wikipediaTitle: '' },
  { id: 'f34', name: 'St. Basil\'s Cathedral', country: 'Russia',           lat: 55.7525,   lng: 37.6231,   wikipediaTitle: '' },
  { id: 'f35', name: 'Moai, Easter Island',    country: 'Chile',            lat: -27.1127,  lng: -109.3497, wikipediaTitle: '' },
  { id: 'f36', name: 'Meteora',                country: 'Greece',           lat: 39.7217,   lng: 21.6306,   wikipediaTitle: '' },
  { id: 'f37', name: 'Plitvice Lakes',         country: 'Croatia',          lat: 44.8654,   lng: 15.5820,   wikipediaTitle: '' },
  { id: 'f38', name: 'Zhangjiajie',            country: 'China',            lat: 29.3245,   lng: 110.4344,  wikipediaTitle: '' },
  { id: 'f39', name: 'Blue Mosque',            country: 'Turkey',           lat: 41.0054,   lng: 28.9768,   wikipediaTitle: '' },
];

// ---------------------------------------------------------------------------
// Weighted regions for random coordinate generation
// Higher weight = picked more often. Biased towards areas with good SV coverage.
// ---------------------------------------------------------------------------

interface Region {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  weight: number;
}

const REGIONS: Region[] = [
  // Europe — excellent Street View coverage
  { latMin: 36, latMax: 71, lngMin: -10, lngMax: 40,  weight: 25 },
  // USA + Canada (south of 55°)
  { latMin: 25, latMax: 55, lngMin: -130, lngMax: -60, weight: 20 },
  // Japan, South Korea, Taiwan
  { latMin: 24, latMax: 47, lngMin: 120, lngMax: 148, weight: 12 },
  // South America (most of it has decent coverage)
  { latMin: -55, latMax: 15, lngMin: -82, lngMax: -34, weight: 10 },
  // Southeast Asia (Thailand, Vietnam, Malaysia, Philippines)
  { latMin: 0,  latMax: 25, lngMin: 95,  lngMax: 128, weight: 8 },
  // Australia
  { latMin: -45, latMax: -10, lngMin: 110, lngMax: 155, weight: 7 },
  // South Asia (India, Sri Lanka, Bangladesh)
  { latMin: 5,  latMax: 35, lngMin: 65,  lngMax: 92,  weight: 5 },
  // Mexico + Central America
  { latMin: 7,  latMax: 32, lngMin: -118, lngMax: -77, weight: 4 },
  // North + West Africa coast + Morocco
  { latMin: 10, latMax: 38, lngMin: -18,  lngMax: 38,  weight: 3 },
  // South Africa + coastal east Africa
  { latMin: -35, latMax: -10, lngMin: 15, lngMax: 45,  weight: 3 },
  // New Zealand
  { latMin: -47, latMax: -34, lngMin: 165, lngMax: 178, weight: 2 },
  // Middle East (Israel, Jordan, UAE, Turkey)
  { latMin: 20, latMax: 42, lngMin: 28,  lngMax: 60,  weight: 1 },
];

const TOTAL_WEIGHT = REGIONS.reduce((s, r) => s + r.weight, 0);

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

// ---------------------------------------------------------------------------
// Reverse geocoding via Nominatim (free, no key required)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LocationService
// ---------------------------------------------------------------------------

// How many unused locations to keep in the DB before background refill triggers
const LOW_WATER_MARK = 20;
// How many locations to add per background fill batch
const BACKGROUND_BATCH = 15;
// Max random-coord attempts before giving up
const MAX_DISCOVER_ATTEMPTS = 150;

@Service()
export class LocationService {
  private filling = false;

  constructor(
    private readonly googleSV: GoogleStreetViewService,
    private readonly cachedLocationRepo: CachedLocationRepository,
  ) {}

  // Called per round — returns one confirmed location.
  async getOneLocation(mode: 'famous' | 'world'): Promise<Location> {
    return mode === 'world' ? this.getOneWorldLocation() : this.getOneFamousLocation();
  }

  // Public — used by the prefill script to add locations to the DB.
  async discoverAndSave(): Promise<ICachedLocation> {
    if (!this.googleSV.isConfigured()) throw new Error('GOOGLE_MAPS_API_KEY not set');
    return this.discover();
  }

  // ── Famous ────────────────────────────────────────────────────────────────

  private getOneFamousLocation(): Location {
    const loc = shuffleArray([...FAMOUS_LOCATIONS])[0];
    return { ...loc, imageUrl: undefined, images: [], mapillaryImageId: undefined };
  }

  // ── World ─────────────────────────────────────────────────────────────────

  private async getOneWorldLocation(): Promise<Location> {
    // 1. Serve from DB cache when available
    const cached = await this.cachedLocationRepo.pickRandom();
    if (cached) {
      void this.maybeRefillCache();
      await this.cachedLocationRepo.markUsed(cached._id.toString());
      return this.fromCached(cached);
    }

    // 2. Cache is empty — discover live (blocks until found or throws)
    if (!this.googleSV.isConfigured()) {
      console.warn('[LocationService] No API key and cache empty — using famous location as fallback');
      return this.getOneFamousLocation();
    }

    console.log('[LocationService] Cache empty — running live discovery');
    const found = await this.discover();
    return this.fromCached(found);
  }

  // ── Core discovery loop ───────────────────────────────────────────────────
  // Generates random coords within weighted regions, checks SV metadata at
  // 50 m radius. Saves every confirmed hit to the DB. Returns the first hit.

  private async discover(): Promise<ICachedLocation> {
    for (let attempt = 1; attempt <= MAX_DISCOVER_ATTEMPTS; attempt++) {
      const region = pickWeightedRegion();
      const { lat, lng } = randomCoordInRegion(region);

      const pano = await this.googleSV.findNearestPanorama(lat, lng, 50);
      if (!pano) continue;

      const { name, country } = await reverseGeocode(pano.lat, pano.lng);
      const saved = await this.cachedLocationRepo.save({
        lat: pano.lat,
        lng: pano.lng,
        panoId: pano.panoId,
        name,
        country,
      });

      console.log(`[LocationService] Discovered ${name}, ${country} after ${attempt} attempt(s)`);
      return saved;
    }

    throw new Error(`Could not find a Street View location after ${MAX_DISCOVER_ATTEMPTS} attempts`);
  }

  // Triggers a background fill when cache drops below LOW_WATER_MARK.
  // Non-blocking — does not affect the current round.
  private async maybeRefillCache(): Promise<void> {
    if (this.filling) return;
    const count = await this.cachedLocationRepo.countAll();
    if (count >= LOW_WATER_MARK) return;
    if (!this.googleSV.isConfigured()) return;

    this.filling = true;
    console.log(`[LocationService] Cache low (${count}), background-filling ${BACKGROUND_BATCH} locations`);
    (async () => {
      for (let i = 0; i < BACKGROUND_BATCH; i++) {
        await this.discover().catch(() => {});
      }
    })().finally(() => { this.filling = false; });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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
