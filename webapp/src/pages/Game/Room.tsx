import React, { useEffect } from 'react';
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
  const isElimination = room.gameMode === 'elimination';

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
          <div className="room-page__info">
            <div className="room-page__info-row">
              <span>Game Mode</span>
              <span>{isElimination ? '⚔️ Elimination' : '🎯 Standard'}</span>
            </div>
            <div className="room-page__info-row">
              <span>Locations</span>
              <span>{room.locationMode === 'world' ? '🌏 Random World' : '🌍 Famous'}</span>
            </div>
            <div className="room-page__info-row">
              <span>Rounds</span>
              <span>{isElimination ? '∞' : room.totalRounds}</span>
            </div>
            <div className="room-page__info-row">
              <span>Time per round</span>
              <span>{formatDuration(room.roundDurationSeconds)}</span>
            </div>
            {isElimination && (
              <p className="room-page__mode-hint">
                Worst guesser each round is eliminated. Last one standing wins.
              </p>
            )}
          </div>

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
