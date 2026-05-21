import React, { useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoundGuess } from '../../types';
import './GuessMap.scss';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const correctIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface ClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
  disabled: boolean;
}

function ClickHandler({ onMapClick, disabled }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!disabled) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface GuessMapProps {
  onGuess?: (lat: number, lng: number) => void;
  disabled?: boolean;
  guesses?: RoundGuess[];
  correctLat?: number;
  correctLng?: number;
  myGuess?: { lat: number; lng: number } | null;
}

export default function GuessMap({ onGuess, disabled = false, guesses, correctLat, correctLng, myGuess }: GuessMapProps) {
  const [pendingPin, setPendingPin] = useState<[number, number] | null>(null);
  const showResults = correctLat !== undefined && correctLng !== undefined;

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPendingPin([lat, lng]);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!pendingPin || !onGuess) return;
    onGuess(pendingPin[0], pendingPin[1]);
    setPendingPin(null);
  }, [pendingPin, onGuess]);

  return (
    <div className="guess-map">
      <MapContainer center={[20, 0]} zoom={2} className="guess-map__container" worldCopyJump>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          maxZoom={18}
        />
        <ClickHandler onMapClick={handleMapClick} disabled={disabled || showResults} />

        {pendingPin && !showResults && (
          <Marker position={pendingPin} />
        )}

        {myGuess && showResults && (
          <Marker position={[myGuess.lat, myGuess.lng]} />
        )}

        {showResults && correctLat && correctLng && (
          <Marker position={[correctLat, correctLng]} icon={correctIcon} />
        )}

        {showResults && myGuess && correctLat && correctLng && (
          <Polyline
            positions={[[myGuess.lat, myGuess.lng], [correctLat, correctLng]]}
            pathOptions={{ color: '#f7c948', dashArray: '8 4', weight: 2 }}
          />
        )}

        {showResults && guesses?.map((g) => (
          <CircleMarker
            key={g.userId}
            center={[g.lat, g.lng]}
            radius={6}
            pathOptions={{ color: '#4fc3f7', fillColor: '#4fc3f7', fillOpacity: 0.7 }}
          />
        ))}
      </MapContainer>

      {!disabled && !showResults && (
        <div className="guess-map__actions">
          <button
            className="btn btn--accent btn--lg"
            onClick={handleSubmit}
            disabled={!pendingPin}
          >
            {pendingPin ? 'Confirm Guess' : 'Click on the map to guess'}
          </button>
        </div>
      )}
    </div>
  );
}
