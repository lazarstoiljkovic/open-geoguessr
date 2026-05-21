import React, { useEffect, useRef } from 'react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';
import { GOOGLE_MAPS_KEY } from '../../env';
import { Player, RoundGuess } from '../../types';
import './GoogleResultsMap.scss';

interface Props {
  guesses: RoundGuess[];
  correctLat: number;
  correctLng: number;
  players: Player[];
}

const COLORS = ['#4fc3f7', '#f7c948', '#a78bfa', '#34d399', '#f87171', '#fb923c'];

function makePlayerPin(color: string, initials: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50" viewBox="0 0 38 50">
    <circle cx="19" cy="19" r="17" fill="${color}" stroke="white" stroke-width="2.5"/>
    <text x="19" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="12" fill="white">${initials}</text>
    <polygon points="19,50 13,32 25,32" fill="${color}"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function makeCorrectPin(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50" viewBox="0 0 38 50">
    <circle cx="19" cy="19" r="17" fill="#ef4444" stroke="white" stroke-width="2.5"/>
    <text x="19" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="18" fill="white">&#9733;</text>
    <polygon points="19,50 13,32 25,32" fill="#ef4444"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function GoogleResultsMap({ guesses, correctLat, correctLng, players }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapDivRef.current) return;
    let cancelled = false;

    loadGoogleMapsApi(GOOGLE_MAPS_KEY).then(() => {
      if (cancelled || !mapDivRef.current) return;

      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      const bounds = new google.maps.LatLngBounds();
      const correctPos = new google.maps.LatLng(correctLat, correctLng);
      bounds.extend(correctPos);

      new google.maps.Marker({
        position: correctPos,
        map,
        icon: {
          url: makeCorrectPin(),
          scaledSize: new google.maps.Size(38, 50),
          anchor: new google.maps.Point(19, 50),
        },
        title: 'Correct location',
        zIndex: 1000,
      });

      const infoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

      guesses.forEach((guess, i) => {
        const player = players.find((p) => p.userId === guess.userId);
        const username = player?.username ?? 'Player';
        const initials = username.slice(0, 2).toUpperCase();
        const color = COLORS[i % COLORS.length];
        const pos = new google.maps.LatLng(guess.lat, guess.lng);

        bounds.extend(pos);

        new google.maps.Polyline({
          path: [pos, correctPos],
          strokeColor: color,
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 0.9,
              strokeColor: color,
              scale: 3,
            },
            offset: '0',
            repeat: '12px',
          }],
          map,
        });

        const marker = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            url: makePlayerPin(color, initials),
            scaledSize: new google.maps.Size(38, 50),
            anchor: new google.maps.Point(19, 50),
          },
          title: username,
          zIndex: 100 + i,
        });

        const distText = guess.distanceKm < 1
          ? `${Math.round(guess.distanceKm * 1000)} m`
          : `${Math.round(guess.distanceKm).toLocaleString()} km`;

        marker.addListener('mouseover', () => {
          infoWindow.setContent(
            `<div style="
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
              background:#1a1d27;
              border:1px solid ${color}55;
              border-radius:10px;
              padding:10px 14px;
              min-width:160px;
              box-shadow:0 4px 16px rgba(0,0,0,0.5);
            ">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
                <span style="font-weight:700;font-size:14px;color:#f0f0f0">${username}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
                <span style="color:#9ca3af;font-size:12px">📍 ${distText} away</span>
                <span style="font-weight:700;font-size:15px;color:${color}">+${guess.roundScore}</span>
              </div>
            </div>`,
          );
          infoWindow.open(map, marker);
        });
        marker.addListener('mouseout', () => infoWindow.close());
      });

      if (guesses.length > 0) {
        map.fitBounds(bounds, 80);
      }
    });

    return () => { cancelled = true; };
  }, [guesses, correctLat, correctLng, players]);

  return <div ref={mapDivRef} className="google-results-map" />;
}
