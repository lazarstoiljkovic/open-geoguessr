import { Service } from 'typedi';
import axios from 'axios';

const METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';

export interface PanoramaResult {
  lat: number;
  lng: number;
  panoId: string;
}

@Service()
export class GoogleStreetViewService {
  private readonly key = process.env.GOOGLE_MAPS_API_KEY;

  isConfigured(): boolean {
    return !!this.key;
  }

  async findNearestPanorama(lat: number, lng: number, radiusMeters = 50000): Promise<PanoramaResult | null> {
    if (!this.key) return null;
    try {
      const res = await axios.get(METADATA_URL, {
        params: { location: `${lat},${lng}`, radius: radiusMeters, source: 'outdoor', key: this.key },
        timeout: 5000,
      });
      if (res.data?.status !== 'OK') return null;
      const loc = res.data?.location;
      const panoId: string | undefined = res.data?.pano_id;
      if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number' || !panoId) return null;
      return { lat: loc.lat, lng: loc.lng, panoId };
    } catch {
      return null;
    }
  }
}
