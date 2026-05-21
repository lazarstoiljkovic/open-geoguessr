import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { GameMode } from '../../types';
import Scoreboard from '../../components/Scoreboard/Scoreboard';
import './Room.scss';

const DURATIONS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '90s', value: 90 },
  { label: '2 min', value: 120 },
];


interface LocationState {
  mode?: GameMode;
  duration?: number;
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();
  const { room, status, joinRoom, startGame, leaveRoom, isStarting } = useGame();
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as LocationState) ?? {};
  const [mode, setMode] = useState<GameMode>(state.mode ?? 'famous');
  const [duration, setDuration] = useState<number>(state.duration ?? 60);
  const [rounds, setRounds] = useState<number>(5);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (code) joinRoom(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'playing' || status === 'countdown') {
      navigate(`/game/${code}`);
    }
  }, [status, code, navigate]);

  if (!room) {
    return (
      <div className="room-page room-page--loading">
        <div className="room-page__spinner" />
        <p>Connecting to room...</p>
      </div>
    );
  }

  const isHost = room.hostId === user?.id;

  return (
    <div className="room-page">
      <div className="room-page__header">
        <div className="room-page__code-block">
          <span className="room-page__code-label">Room Code</span>
          <span className="room-page__code">{room.code}</span>
        </div>
        <button className="btn btn--secondary" onClick={() => { leaveRoom(); navigate('/'); }}>
          Leave
        </button>
      </div>

      <div className="room-page__body">
        <div className="room-page__players">
          <h2>Players ({room.players.length})</h2>
          <Scoreboard players={room.players} currentUserId={user?.id} />
        </div>

        <div className="room-page__sidebar">
          {isHost ? (
            <>
              <div className="room-page__settings">
                <div className="room-page__settings-group">
                  <span className="room-page__settings-label">Game Mode</span>
                  <div className="room-page__mode-btns">
                    <button
                      className={`room-page__mode-btn ${mode === 'famous' ? 'room-page__mode-btn--active' : ''}`}
                      onClick={() => setMode('famous')}
                    >
                      🎯 Famous
                    </button>
                    <button
                      className={`room-page__mode-btn ${mode === 'world' ? 'room-page__mode-btn--active' : ''}`}
                      onClick={() => setMode('world')}
                    >
                      🌏 Random World
                    </button>
                  </div>
                </div>

                <div className="room-page__settings-group">
                  <span className="room-page__settings-label">Round Duration</span>
                  <div className="room-page__duration-pills">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        className={`room-page__duration-pill ${duration === d.value ? 'room-page__duration-pill--active' : ''}`}
                        onClick={() => setDuration(d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="room-page__settings-group">
                  <span className="room-page__settings-label">
                    Number of Rounds
                    <span className="room-page__settings-value">{rounds}</span>
                  </span>
                  <input
                    className="room-page__slider"
                    type="range"
                    min={1}
                    max={20}
                    value={rounds}
                    onChange={(e) => setRounds(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="room-page__host-actions">
                <p className="room-page__host-hint">Start when all players have joined.</p>
                <button
                  className="btn btn--primary btn--lg"
                  onClick={() => startGame(mode, duration, rounds)}
                  disabled={room.players.length < 1 || isStarting}
                >
                  {isStarting ? 'Starting...' : 'Start Game'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="room-page__info">
                <div className="room-page__info-row">
                  <span>Mode</span>
                  <span>{room.roundDurationSeconds === 30 ? '🎯 Famous' : '🌏 Random World'}</span>
                </div>
                <div className="room-page__info-row">
                  <span>Rounds</span>
                  <span>{room.totalRounds}</span>
                </div>
                <div className="room-page__info-row">
                  <span>Time per round</span>
                  <span>{room.roundDurationSeconds}s</span>
                </div>
              </div>
              <div className="room-page__waiting">
                <div className="room-page__waiting-dots">
                  <span /><span /><span />
                </div>
                <p>Waiting for host to start...</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
