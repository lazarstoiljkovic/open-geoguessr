import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import './MapillaryViewer.scss';

interface MapillaryViewerProps {
  imageId: string;
  accessToken: string;
}

export default function MapillaryViewer({ imageId, accessToken }: MapillaryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !accessToken || !imageId) return;

    setLoading(true);
    setError(false);

    const viewer = new Viewer({
      accessToken,
      container: containerRef.current,
      imageId,
      component: {
        cover: false,
        direction: {},
        sequence: { visible: false },
        zoom: { visible: true },
      },
    });

    viewerRef.current = viewer;

    viewer.on('load', () => setLoading(false));
    viewer.on('dataloading', (event: { loading: boolean }) => {
      if (!event.loading) setLoading(false);
    });

    const fallback = setTimeout(() => setLoading(false), 6000);

    return () => {
      clearTimeout(fallback);
      try { viewer.remove(); } catch {  }
      viewerRef.current = null;
    };
  }, [imageId, accessToken]);

  if (!accessToken || !imageId) {
    return (
      <div className="mapillary-viewer mapillary-viewer--unavailable">
        <span>🗺️</span>
        <p>Street view not available</p>
        <small>Configure MAPILLARY_CLIENT_TOKEN to enable navigation</small>
      </div>
    );
  }

  return (
    <div className="mapillary-viewer">
      {loading && (
        <div className="mapillary-viewer__loading">
          <div className="mapillary-viewer__spinner" />
          <p>Loading street view...</p>
        </div>
      )}
      {error && (
        <div className="mapillary-viewer__error">
          <span>⚠️</span>
          <p>Failed to load panorama</p>
        </div>
      )}
      <div ref={containerRef} className="mapillary-viewer__container" />

      <div className="mapillary-viewer__hint">
        🖱 Drag to look around · Click arrows to move · Scroll to zoom
      </div>
    </div>
  );
}
