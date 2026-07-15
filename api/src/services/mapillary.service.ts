import { Service } from 'typedi';
import axios from 'axios';

const GRAPH = 'https://graph.mapillary.com';

export interface MapillaryImage {
  imageId: string;
  lat: number;
  lng: number;
  thumbUrl?: string;
}

@Service()
export class MapillaryService {
  private readonly token = process.env.MAPILLARY_CLIENT_TOKEN;

  isConfigured(): boolean {
    return !!this.token;
  }

  async findImageNear(lat: number, lng: number, radiusM = 5000): Promise<MapillaryImage | null> {
    if (!this.token) return null;

    try {
      const latD = radiusM / 111_000;
      const lngD = radiusM / (111_000 * Math.cos((lat * Math.PI) / 180));
      const bbox = `${lng - lngD},${lat - latD},${lng + lngD},${lat + latD}`;

      const res = await axios.get(`${GRAPH}/images`, {
        headers: { Authorization: `OAuth ${this.token}` },
        params: { fields: 'id,geometry', bbox, limit: 10 },
        timeout: 5000,
      });

      const images: Array<{ id: string; geometry: { coordinates: [number, number] } }> =
        res.data?.data ?? [];

      if (images.length === 0) return null;

      const img = images[Math.floor(Math.random() * images.length)];

      let thumbUrl: string | undefined;
      try {
        const thumbRes = await axios.get(`${GRAPH}/${img.id}`, {
          headers: { Authorization: `OAuth ${this.token}` },
          params: { fields: 'thumb_1024_url' },
          timeout: 5000,
        });
        thumbUrl = thumbRes.data?.thumb_1024_url;
      } catch {  }

      return {
        imageId: img.id,
        lat: img.geometry.coordinates[1],
        lng: img.geometry.coordinates[0],
        thumbUrl,
      };
    } catch {
      return null;
    }
  }

  async findImageNearWithFallback(lat: number, lng: number): Promise<MapillaryImage | null> {
    for (const r of [500, 2000, 8000]) {
      const result = await this.findImageNear(lat, lng, r);
      if (result) return result;
    }
    return null;
  }

  async randomImageInBbox(
    minLat: number, maxLat: number,
    minLng: number, maxLng: number,
  ): Promise<MapillaryImage | null> {
    if (!this.token) return null;

    const tileLat = minLat + Math.random() * (maxLat - minLat);
    const tileLng = minLng + Math.random() * (maxLng - minLng);
    const tileSize = 0.15;

    const bbox = [
      Math.max(minLng, tileLng - tileSize),
      Math.max(minLat, tileLat - tileSize),
      Math.min(maxLng, tileLng + tileSize),
      Math.min(maxLat, tileLat + tileSize),
    ].join(',');

    try {
      const res = await axios.get(`${GRAPH}/images`, {
        headers: { Authorization: `OAuth ${this.token}` },
        params: { fields: 'id,geometry', bbox, limit: 50 },
        timeout: 5000,
      });

      const images: Array<{ id: string; geometry: { coordinates: [number, number] } }> =
        res.data?.data ?? [];

      if (images.length === 0) return null;

      const img = images[Math.floor(Math.random() * images.length)];

      let thumbUrl: string | undefined;
      try {
        const thumbRes = await axios.get(`${GRAPH}/${img.id}`, {
          headers: { Authorization: `OAuth ${this.token}` },
          params: { fields: 'thumb_1024_url' },
          timeout: 5000,
        });
        thumbUrl = thumbRes.data?.thumb_1024_url;
      } catch {  }

      return {
        imageId: img.id,
        lat: img.geometry.coordinates[1],
        lng: img.geometry.coordinates[0],
        thumbUrl,
      };
    } catch {
      return null;
    }
  }
}
