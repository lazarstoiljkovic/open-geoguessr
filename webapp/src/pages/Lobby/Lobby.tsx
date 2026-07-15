import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '../../api/rooms.api';
import { useAuth } from '../../context/AuthContext';
import { GameMode, LocationMode } from '../../types';
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
  const [locationMode, setLocationMode] = useState<LocationMode>('famous');
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const [duration, setDuration] = useState(60);
  const [rounds, setRounds] = useState(5);
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const created = await createRoom(locationMode, gameMode, rounds, duration, hintsEnabled, teamsEnabled);
      navigate(`/room/${created.code}`);
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
        <div className="lobby-page__orb lobby-page__orb--gold" />
        <div className="lobby-page__orb lobby-page__orb--blue" />
        <div className="lobby-page__orb lobby-page__orb--purple" />

        <div className="lobby-page__hero-content">
          <div className="lobby-page__logo">🌍</div>
          <h1 className="lobby-page__title">Open GeoGuessr</h1>
          <p className="lobby-page__subtitle">
            Guess locations from street-level photos around the world. Challenge your friends and see who knows the globe best.
          </p>
          <div className="lobby-page__stats">
            <div className="lobby-page__stat">
              <span className="lobby-page__stat-num">∞</span>
              <span className="lobby-page__stat-label">Locations</span>
            </div>
            <div className="lobby-page__stat-divider" />
            <div className="lobby-page__stat">
              <span className="lobby-page__stat-num">2</span>
              <span className="lobby-page__stat-label">Game Modes</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lobby-page__forms">
        <div className="lobby-page__card">
          <div className="lobby-page__card-header">
            <h2>Create Room</h2>
            <p className="lobby-page__card-desc">Configure and host a game</p>
          </div>

          <div className="form-group">
            <label>Game Mode</label>
            <div className="lobby-page__toggle-row">
              <button
                className={`lobby-page__toggle-btn ${gameMode === 'standard' ? 'lobby-page__toggle-btn--active' : ''}`}
                onClick={() => setGameMode('standard')}
              >
                🎯 Standard
              </button>
              <button
                className={`lobby-page__toggle-btn ${gameMode === 'elimination' ? 'lobby-page__toggle-btn--active' : ''}`}
                onClick={() => setGameMode('elimination')}
              >
                ⚔️ Elimination
              </button>
            </div>
            {gameMode === 'elimination' && (
              <p className="lobby-page__hint">Worst guesser each round is eliminated. Last one standing wins.</p>
            )}
          </div>

          <div className="form-group">
            <label>Locations</label>
            <div className="lobby-page__modes">
              <button
                className={`lobby-page__mode-btn ${locationMode === 'famous' ? 'lobby-page__mode-btn--active' : ''}`}
                onClick={() => setLocationMode('famous')}
              >
                <span className="lobby-page__mode-icon">🌍</span>
                <span className="lobby-page__mode-name">Famous Landmarks</span>
                <span className="lobby-page__mode-desc">Iconic locations worldwide</span>
              </button>
              <button
                className={`lobby-page__mode-btn ${locationMode === 'world' ? 'lobby-page__mode-btn--active' : ''}`}
                onClick={() => setLocationMode('world')}
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

          <div className="form-group">
            <label>Hints</label>
            <div className="lobby-page__toggle-row">
              <button
                className={`lobby-page__toggle-btn ${!hintsEnabled ? 'lobby-page__toggle-btn--active' : ''}`}
                onClick={() => setHintsEnabled(false)}
              >
                🚫 Disabled
              </button>
              <button
                className={`lobby-page__toggle-btn ${hintsEnabled ? 'lobby-page__toggle-btn--active' : ''}`}
                onClick={() => setHintsEnabled(true)}
              >
                💡 Enabled
              </button>
            </div>
            {hintsEnabled && (
              <p className="lobby-page__hint">Each player can reveal the continent once and the country once per game.</p>
            )}
          </div>

          <div className="form-group">
            <label>Teams</label>
            <div className="lobby-page__toggle-row">
              <button
                className={`lobby-page__toggle-btn ${!teamsEnabled ? 'lobby-page__toggle-btn--active' : ''}`}
                onClick={() => setTeamsEnabled(false)}
              >
                🚫 Disabled
              </button>
              <button
                className={`lobby-page__toggle-btn ${teamsEnabled ? 'lobby-page__toggle-btn--active' : ''}`}
                onClick={() => setTeamsEnabled(true)}
              >
                👥 2v2 Teams
              </button>
            </div>
            {teamsEnabled && (
              <p className="lobby-page__hint">Players pick their team in the room lobby. Team chat unlocked.</p>
            )}
          </div>

          {gameMode === 'standard' && (
            <div className="form-group">
              <label>
                Rounds
                <span className="lobby-page__rounds-value">{rounds}</span>
              </label>
              <input
                className="lobby-page__slider"
                type="range"
                min={1}
                max={20}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
              />
            </div>
          )}

          <button className="btn btn--primary btn--lg lobby-page__create-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : '+ Create Room'}
          </button>
        </div>

        <div className="lobby-page__divider"><span>or join existing</span></div>

        <div className="lobby-page__card lobby-page__card--join">
          <div className="lobby-page__card-header">
            <h2>Join Room</h2>
            <p className="lobby-page__card-desc">Enter a 6-character room code</p>
          </div>

          <form onSubmit={handleJoin} className="lobby-page__join-form">
            <input
              className="input lobby-page__code-input"
              placeholder="A B C 1 2 3"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn btn--accent btn--lg" type="submit" disabled={loading || joinCode.length < 6}>
              {loading ? 'Joining...' : 'Join →'}
            </button>
          </form>
        </div>

        {error && <p className="error-text lobby-page__error">{error}</p>}
      </div>
    </div>
  );
}
