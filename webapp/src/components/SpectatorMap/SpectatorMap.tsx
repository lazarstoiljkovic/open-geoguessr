import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';
import { GOOGLE_MAPS_KEY } from '../../env';
import { LivePin, Player } from '../../types';
import './SpectatorMap.scss';

const PLAYER_COLORS = ['#f7c948', '#4fc3f7', '#ef5350', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#d4e157'];

function colorForPlayer(players: Player[], userId: string): string {
  const idx = players.findIndex((p) => p.userId === userId);
  return PLAYER_COLORS[idx % PLAYER_COLORS.length] ?? '#ffffff';
}

interface Props {
  livePlayerPins: LivePin[];
  activePlayers: Player[];  // non-eliminated players
  followingUserId: string | null;
  onFollowPlayer: (userId: string) => void;
}

export default function SpectatorMap({ livePlayerPins, activePlayers, followingUserId, onFollowPlayer }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapDivRef.current) return;
    let cancelled = false;

    loadGoogleMapsApi(GOOGLE_MAPS_KEY).then(() => {
      if (cancelled || !mapDivRef.current) return;
      mapRef.current = new google.maps.Map(mapDivRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      });
    });

    return () => { cancelled = true; };
  }, []);

  // Update markers when pins change
  useEffect(() => {
    if (!mapRef.current) return;

    const activeIds = new Set(activePlayers.map((p) => p.userId));

    // Remove markers for players who are no longer active
    markersRef.current.forEach((marker, userId) => {
      if (!activeIds.has(userId)) {
        marker.setMap(null);
        markersRef.current.delete(userId);
      }
    });

    livePlayerPins.forEach((pin) => {
      if (!activeIds.has(pin.userId)) return;
      const color = colorForPlayer(activePlayers, pin.userId);
      const isFollowed = pin.userId === followingUserId;
      const position = { lat: pin.lat, lng: pin.lng };

      if (markersRef.current.has(pin.userId)) {
        const marker = markersRef.current.get(pin.userId)!;
        marker.setPosition(position);
        marker.setIcon(makeIcon(color, isFollowed));
      } else {
        const marker = new google.maps.Marker({
          position,
          map: mapRef.current!,
          icon: makeIcon(color, isFollowed),
          title: pin.username,
        });
        markersRef.current.set(pin.userId, marker);
      }
    });
  }, [livePlayerPins, activePlayers, followingUserId]);

  // Pan to followed player when they move
  useEffect(() => {
    if (!mapRef.current || !followingUserId) return;
    const pin = livePlayerPins.find((p) => p.userId === followingUserId);
    if (pin) {
      mapRef.current.panTo({ lat: pin.lat, lng: pin.lng });
    }
  }, [livePlayerPins, followingUserId]);

  return (
    <div className="spectator-map">
      <div className="spectator-map__player-pills">
        {activePlayers.map((player) => {
          const color = colorForPlayer(activePlayers, player.userId);
          const isFollowing = player.userId === followingUserId;
          const hasPin = livePlayerPins.some((p) => p.userId === player.userId);
          return (
            <button
              key={player.userId}
              className={`spectator-map__pill${isFollowing ? ' spectator-map__pill--active' : ''}`}
              style={{ '--player-color': color } as React.CSSProperties}
              onClick={() => onFollowPlayer(isFollowing ? '' : player.userId)}
            >
              <span className="spectator-map__pill-dot" />
              {player.username}
              {!hasPin && <span className="spectator-map__pill-waiting">…</span>}
            </button>
          );
        })}
      </div>
      <div ref={mapDivRef} className="spectator-map__canvas" />
    </div>
  );
}

function makeIcon(color: string, large: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: large ? 12 : 8,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: '#fff',
    strokeWeight: large ? 3 : 2,
  };
}
