import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';
import './GoogleStreetViewViewer.scss';

interface Props {
  lat: number;
  lng: number;
  apiKey: string;
  panoId?: string;
}

export default function GoogleStreetViewViewer({ lat, lng, apiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    loadGoogleMapsApi(apiKey).then(() => {
      if (cancelled || !containerRef.current) return;

      try {
        const panorama = new window.google!.maps.StreetViewPanorama(containerRef.current, {
          position: { lat, lng },
          pov: { heading: 34, pitch: 10 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          showRoadLabels: false,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          clickToGo: true,
        });
        panoramaRef.current = panorama;

        const timeoutId = setTimeout(() => {
          if (!cancelled) { setError(true); setLoading(false); }
        }, 30000);

        const clearLoading = () => {
          if (cancelled) return;
          clearTimeout(timeoutId);
          setLoading(false);
        };

        panorama.addListener('tiles_loaded', clearLoading);

        panorama.addListener('status_changed', () => {
          if (panorama.getStatus() === window.google!.maps.StreetViewStatus.OK) clearLoading();
        });
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    });

    return () => {
      cancelled = true;
      panoramaRef.current = null;
    };
  }, [lat, lng, apiKey]);

  return (
    <div className="gsv-viewer">
      {loading && (
        <div className="gsv-viewer__loading">
          <div className="gsv-viewer__spinner" />
          <p>Loading Street View...</p>
        </div>
      )}
      {error && (
        <div className="gsv-viewer__error">
          <span>⚠️</span>
          <p>Street View not available here</p>
        </div>
      )}
      <div ref={containerRef} className="gsv-viewer__container" />
      {!loading && !error && (
        <div className="gsv-viewer__hint">
          🖱 Drag to look around · Click arrows to move · Scroll to zoom
        </div>
      )}
    </div>
  );
}
