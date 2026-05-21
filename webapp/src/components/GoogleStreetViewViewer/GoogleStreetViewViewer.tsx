import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';
import './GoogleStreetViewViewer.scss';

interface Props {
  lat: number;
  lng: number;
  apiKey: string;
  panoId?: string; // unused on client — backend coords are already exact
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
        // Use the exact panorama coordinates returned by the backend metadata API.
        // The backend already confirmed outdoor Street View exists at this position,
        // so the JS API will find the same panorama via coordinate lookup.
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

        // Fallback: if no OK signal arrives within 30 s, show error
        const timeoutId = setTimeout(() => {
          if (!cancelled) { setError(true); setLoading(false); }
        }, 30000);

        const clearLoading = () => {
          if (cancelled) return;
          clearTimeout(timeoutId);
          setLoading(false);
        };

        // tiles_loaded fires when imagery is fully painted — most reliable success signal.
        panorama.addListener('tiles_loaded', clearLoading);

        // status_changed fires earlier, when the panorama is located and starts
        // rendering. Accepting OK here avoids waiting the full tile-download time.
        // We intentionally ignore non-OK statuses here — they can fire transiently
        // during initialisation even for valid panoramas, so only the timeout
        // handles genuine failure.
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
