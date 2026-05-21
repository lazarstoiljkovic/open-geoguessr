import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import Scoreboard from '../../components/Scoreboard/Scoreboard';
import './Room.scss';

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();
  const { room, status, joinRoom, startGame, leaveRoom, isStarting } = useGame();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (code) joinRoom(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'playing' || status === 'countdown') {
      navigate(`/game/${code}`);
    }
  }, [status, code, navigate]);

  const handleCopy = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!room) {
    return (
      <div className="room-page room-page--loading">
        <div className="room-page__spinner" />
        <p>Connecting to room...</p>
      </div>
    );
  }

  const isHost = room.hostId === user?.id;
  const isElimination = room.gameMode === 'elimination';

  return (
    <div className="room-page">
      <div className="room-page__header">
        <div className="room-page__code-block">
          <span className="room-page__code-label">Room Code</span>
          <div className="room-page__code-row">
            <span className="room-page__code">{room.code}</span>
            <button className={`room-page__copy-btn${copied ? ' room-page__copy-btn--copied' : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <button className="btn btn--secondary" onClick={() => { leaveRoom(); navigate('/'); }}>
          Leave
        </button>
      </div>

      <div className="room-page__body">
        <div className="room-page__players">
          <h2>Players <span className="room-page__player-count">{room.players.length}</span></h2>
          <Scoreboard players={room.players} currentUserId={user?.id} />
        </div>

        <div className="room-page__sidebar">
          <div className="room-page__settings-chips">
            <div className="room-page__chip">
              <span className="room-page__chip-icon">{isElimination ? '⚔️' : '🎯'}</span>
              <div>
                <div className="room-page__chip-label">Game Mode</div>
                <div className="room-page__chip-value">{isElimination ? 'Elimination' : 'Standard'}</div>
              </div>
            </div>
            <div className="room-page__chip">
              <span className="room-page__chip-icon">{room.locationMode === 'world' ? '🌏' : '🌍'}</span>
              <div>
                <div className="room-page__chip-label">Locations</div>
                <div className="room-page__chip-value">{room.locationMode === 'world' ? 'Random World' : 'Famous'}</div>
              </div>
            </div>
            <div className="room-page__chip">
              <span className="room-page__chip-icon">🔄</span>
              <div>
                <div className="room-page__chip-label">Rounds</div>
                <div className="room-page__chip-value">{isElimination ? '∞' : room.totalRounds}</div>
              </div>
            </div>
            <div className="room-page__chip">
              <span className="room-page__chip-icon">⏱</span>
              <div>
                <div className="room-page__chip-label">Per Round</div>
                <div className="room-page__chip-value">{formatDuration(room.roundDurationSeconds)}</div>
              </div>
            </div>
          </div>

          {isElimination && (
            <p className="room-page__mode-hint">
              Worst guesser each round is eliminated. Last one standing wins.
            </p>
          )}

          {isHost ? (
            <div className="room-page__host-actions">
              <p className="room-page__host-hint">Start when all players have joined.</p>
              <button
                className="btn btn--primary btn--lg"
                onClick={() => startGame()}
                disabled={room.players.length < 1 || isStarting}
              >
                {isStarting ? 'Starting...' : 'Start Game'}
              </button>
            </div>
          ) : (
            <div className="room-page__waiting">
              <div className="room-page__waiting-dots">
                <span /><span /><span />
              </div>
              <p>Waiting for host to start...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
