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

const COLORS = ['#f0c040', '#5aabff', '#a78bfa', '#4cdd8a', '#ff5f5f', '#fb923c', '#f472b6', '#34d399'];

function makePlayerPin(color: string, initials: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
    <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="20" y="26" text-anchor="middle" font-family="Space Grotesk,Arial,sans-serif" font-weight="700" font-size="13" fill="white">${initials}</text>
    <polygon points="20,52 13,34 27,34" fill="${color}"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function makeCorrectPin(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
    <circle cx="20" cy="20" r="18" fill="#ef4444" stroke="white" stroke-width="2"/>
    <text x="20" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="20" fill="white">★</text>
    <polygon points="20,52 13,34 27,34" fill="#ef4444"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function animateLine(
  map: google.maps.Map,
  from: google.maps.LatLng,
  to: google.maps.LatLng,
  color: string,
  delayMs: number,
): void {
  setTimeout(() => {
    const line = new google.maps.Polyline({
      path: [from],
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 2.5,
      map,
    });

    let step = 0;
    const STEPS = 50;
    const INTERVAL = 12;

    const timer = setInterval(() => {
      step++;
      const t = step / STEPS;
      const lat = from.lat() + (to.lat() - from.lat()) * t;
      const lng = from.lng() + (to.lng() - from.lng()) * t;
      line.setPath([from, new google.maps.LatLng(lat, lng)]);
      if (step >= STEPS) clearInterval(timer);
    }, INTERVAL);
  }, delayMs);
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
          scaledSize: new google.maps.Size(40, 52),
          anchor: new google.maps.Point(20, 52),
        },
        title: 'Correct location',
        zIndex: 1000,
      });

      const infoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

      // Place markers + animate lines sequentially
      guesses.forEach((guess, i) => {
        const player = players.find((p) => p.userId === guess.userId);
        const username = player?.username ?? 'Player';
        const initials = username.slice(0, 2).toUpperCase();
        const color = COLORS[i % COLORS.length];
        const pos = new google.maps.LatLng(guess.lat, guess.lng);
        bounds.extend(pos);

        // Animate line with staggered delay
        animateLine(map, pos, correctPos, color, i * 350);

        const marker = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            url: makePlayerPin(color, initials),
            scaledSize: new google.maps.Size(40, 52),
            anchor: new google.maps.Point(20, 52),
          },
          title: username,
          zIndex: 100 + i,
          opacity: 0,
        });

        // Fade marker in after line finishes drawing
        setTimeout(() => {
          if (!cancelled) marker.setOpacity(1);
        }, i * 350 + 600);

        const distText = guess.distanceKm < 1
          ? `${Math.round(guess.distanceKm * 1000)} m`
          : `${Math.round(guess.distanceKm).toLocaleString()} km`;

        marker.addListener('mouseover', () => {
          infoWindow.setContent(
            `<div style="
              font-family:'Space Grotesk','DM Sans',system-ui,sans-serif;
              background:#0f1320;
              border:1px solid ${color}55;
              border-radius:10px;
              padding:10px 14px;
              min-width:160px;
              box-shadow:0 4px 20px rgba(0,0,0,0.6);
            ">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
                <span style="font-weight:700;font-size:14px;color:#eef0f8">${username}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
                <span style="color:#7a85b0;font-size:12px">📍 ${distText} away</span>
                <span style="font-weight:800;font-size:16px;color:${color}">+${guess.roundScore}</span>
              </div>
            </div>`,
          );
          infoWindow.open(map, marker);
        });
        marker.addListener('mouseout', () => infoWindow.close());
      });

      if (guesses.length > 0) {
        setTimeout(() => { if (!cancelled) map.fitBounds(bounds, 80); }, 200);
      }
    });

    return () => { cancelled = true; };
  }, [guesses, correctLat, correctLng, players]);

  return <div ref={mapDivRef} className="google-results-map" />;
}
