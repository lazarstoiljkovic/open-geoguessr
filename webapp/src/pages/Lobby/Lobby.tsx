import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '../../api/rooms.api';
import { useAuth } from '../../context/AuthContext';
import { GameMode } from '../../types';
import './Lobby.scss';

const DURATIONS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '90s', value: 90 },
  { label: '2 min', value: 120 },
];

export default function Lobby() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<GameMode>('famous');
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const created = await createRoom(mode);
      navigate(`/room/${created.code}`, { state: { mode, duration } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      const joined = await joinRoom(joinCode.trim().toUpperCase());
      navigate(`/room/${joined.code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Room not found or game in progress');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobby-page">
      <div className="lobby-page__hero">
        <h1 className="lobby-page__title">🌍 Open GeoGuessr</h1>
        <p className="lobby-page__subtitle">
          Guess locations from street-level photos around the world
        </p>
      </div>

      <div className="lobby-page__layout">
        {/* Create room */}
        <div className="lobby-page__card">
          <h2>Create Room</h2>
          <p className="lobby-page__card-desc">Start a game and share the code with friends</p>

          <div className="form-group">
            <label>Game Mode</label>
            <div className="lobby-page__modes">
              <button
                className={`lobby-page__mode-btn ${mode === 'famous' ? 'lobby-page__mode-btn--active' : ''}`}
                onClick={() => setMode('famous')}
              >
                <span className="lobby-page__mode-icon">🎯</span>
                <span className="lobby-page__mode-name">Famous Landmarks</span>
                <span className="lobby-page__mode-desc">Iconic locations from around the world</span>
              </button>
              <button
                className={`lobby-page__mode-btn ${mode === 'world' ? 'lobby-page__mode-btn--active' : ''}`}
                onClick={() => setMode('world')}
              >
                <span className="lobby-page__mode-icon">🌏</span>
                <span className="lobby-page__mode-name">Random World</span>
                <span className="lobby-page__mode-desc">Anywhere on the planet</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Round Duration</label>
            <div className="lobby-page__durations">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  className={`lobby-page__duration-pill ${duration === d.value ? 'lobby-page__duration-pill--active' : ''}`}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn--primary btn--lg"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>

        <div className="lobby-page__divider"><span>or</span></div>

        {/* Join room */}
        <div className="lobby-page__card">
          <h2>Join Room</h2>
          <p className="lobby-page__card-desc">Enter a 6-character room code</p>

          <form onSubmit={handleJoin} className="lobby-page__join-form">
            <input
              className="input lobby-page__code-input"
              placeholder="ABCDEF"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="btn btn--accent btn--lg"
              type="submit"
              disabled={loading || joinCode.length < 6}
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>

      {error && <p className="error-text lobby-page__error">{error}</p>}
    </div>
  );
}
