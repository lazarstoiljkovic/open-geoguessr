import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';
import { GOOGLE_MAPS_KEY } from '../../env';
import './GoogleGuessMap.scss';

interface Props {
  onGuess?: (lat: number, lng: number) => void;
  disabled?: boolean;
}

export default function GoogleGuessMap({ onGuess, disabled = false }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapDivRef.current) return;
    let cancelled = false;

    loadGoogleMapsApi(GOOGLE_MAPS_KEY).then(() => {
      if (cancelled || !mapDivRef.current) return;

      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        disableDefaultUI: true,
        zoomControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      mapRef.current = map;

      if (!disabled) {
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng || cancelled) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          setPin({ lat, lng });

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

  const handleGuess = useCallback(() => {
    if (!pin || !onGuess) return;
    onGuess(pin.lat, pin.lng);
    setPin(null);
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [pin, onGuess]);

  return (
    <div
      className={`gg-map${expanded ? ' gg-map--expanded' : ''}${disabled ? ' gg-map--disabled' : ''}`}
      onMouseEnter={() => !disabled && setExpanded(true)}
      onMouseLeave={() => !disabled && setExpanded(false)}
    >
      <div ref={mapDivRef} className="gg-map__canvas" />
      {!disabled && (
        <button
          className={`gg-map__btn${pin ? ' gg-map__btn--ready' : ''}`}
          onClick={handleGuess}
          disabled={!pin}
        >
          {pin ? 'Confirm Guess' : 'Click map to place pin'}
        </button>
      )}
    </div>
  );
}
