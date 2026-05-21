import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import './LocationGallery.scss';

interface LocationGalleryProps {
  images: string[];
  alt?: string;
}

export default function LocationGallery({ images, alt = 'Location' }: LocationGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const imgRef = useRef<HTMLImageElement>(null);

  const validImages = images.filter((_, i) => !failed[i]);

  const go = useCallback((dir: -1 | 1) => {
    setCurrent((c) => {
      const next = (c + dir + images.length) % images.length;
      return next;
    });
    setZoomed(false);
  }, [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [go]);

  const handleImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({ x, y });
    setZoomed((z) => !z);
  };

  if (validImages.length === 0) {
    return (
      <div className="location-gallery location-gallery--empty">
        <span>📸</span>
        <p>No images available for this location</p>
      </div>
    );
  }

  const displayIndex = Math.min(current, images.length - 1);
  const src = images[displayIndex];

  return (
    <div className="location-gallery">
      <div className={classNames('location-gallery__viewer', { 'location-gallery__viewer--zoomed': zoomed })}>
        {!loaded[displayIndex] && !failed[displayIndex] && (
          <div className="location-gallery__skeleton" />
        )}

        <img
          ref={imgRef}
          key={src}
          src={src}
          alt={`${alt} — photo ${displayIndex + 1}`}
          className={classNames('location-gallery__image', {
            'location-gallery__image--visible': loaded[displayIndex],
            'location-gallery__image--zoomed': zoomed,
          })}
          style={zoomed ? { transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` } : undefined}
          onLoad={() => setLoaded((l) => ({ ...l, [displayIndex]: true }))}
          onError={() => setFailed((f) => ({ ...f, [displayIndex]: true }))}
          onClick={handleImgClick}
          draggable={false}
        />

        {failed[displayIndex] && (
          <div className="location-gallery__error">
            <span>🖼️</span>
            <p>Image unavailable</p>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <>
          <button
            className="location-gallery__arrow location-gallery__arrow--left"
            onClick={() => go(-1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            className="location-gallery__arrow location-gallery__arrow--right"
            onClick={() => go(1)}
            aria-label="Next photo"
          >
            ›
          </button>

          <div className="location-gallery__dots">
            {images.map((_, i) => (
              <button
                key={i}
                className={classNames('location-gallery__dot', {
                  'location-gallery__dot--active': i === displayIndex,
                  'location-gallery__dot--failed': failed[i],
                })}
                onClick={() => { setCurrent(i); setZoomed(false); }}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>

          <div className="location-gallery__counter">
            {displayIndex + 1} / {images.length}
          </div>

          <div className="location-gallery__hint">
            Click image to zoom · ← → to navigate
          </div>
        </>
      )}
    </div>
  );
}
