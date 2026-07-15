import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';
import { GOOGLE_MAPS_KEY } from '../../env';
import './GoogleGuessMap.scss';

interface Props {
  onGuess?: (lat: number, lng: number) => void;
  onPinMove?: (lat: number, lng: number) => void;
  disabled?: boolean;
}

export default function GoogleGuessMap({ onGuess, onPinMove, disabled = false }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onPinMoveRef = useRef(onPinMove);
  useEffect(() => { onPinMoveRef.current = onPinMove; }, [onPinMove]);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    let cancelled = false;

    loadGoogleMapsApi(GOOGLE_MAPS_KEY).then(() => {
      if (cancelled || !mapDivRef.current) return;

      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      mapRef.current = map;
      setMapReady(true);

      if (!disabled) {
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng || cancelled) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          setPin({ lat, lng });
          onPinMoveRef.current?.(lat, lng);

          if (markerRef.current) {
            markerRef.current.setPosition(e.latLng);
          } else {
            markerRef.current = new google.maps.Marker({
              position: e.latLng,
              map,
              animation: google.maps.Animation.DROP,
            });
          }
        });
      }
    });

    return () => { cancelled = true; };
  }, [disabled]);

  useEffect(() => {
    if (isOpen && mapRef.current && mapReady) {
      setTimeout(() => {
        google.maps.event.trigger(mapRef.current!, 'resize');
        mapRef.current!.setCenter({ lat: 20, lng: 0 });
      }, 50);
    }
  }, [isOpen, mapReady]);

  const handleGuess = useCallback(() => {
    if (!pin || !onGuess) return;
    onGuess(pin.lat, pin.lng);
    setPin(null);
    setIsOpen(false);
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [pin, onGuess]);

  if (disabled) return null;

  return (
    <>
      <button
        className={`gg-trigger${pin ? ' gg-trigger--pinned' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="gg-trigger__icon">{pin ? '📍' : '🗺️'}</span>
        <span className="gg-trigger__text">{pin ? 'Move Pin' : 'Place Pin'}</span>
        {pin && <span className="gg-trigger__dot" />}
      </button>

      <div className={`gg-modal${isOpen ? ' gg-modal--open' : ''}`}>
        <div className="gg-modal__backdrop" onClick={() => setIsOpen(false)} />
        <div className="gg-modal__box">
          <div className="gg-modal__header">
            <span className="gg-modal__title">Click the map to place your pin</span>
            <button className="gg-modal__close" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          <div ref={mapDivRef} className="gg-modal__canvas" />
          <div className="gg-modal__footer">
            <button className="gg-modal__cancel" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
            <button
              className={`gg-modal__confirm${pin ? ' gg-modal__confirm--ready' : ''}`}
              onClick={handleGuess}
              disabled={!pin}
            >
              {pin ? '✓ Confirm Guess' : 'Click map to place pin'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
