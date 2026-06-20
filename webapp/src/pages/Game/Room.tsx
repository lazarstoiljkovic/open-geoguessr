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
  const { room, status, joinRoom, startGame, leaveRoom, joinTeam, isStarting } = useGame();
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
  const myTeamId = room.players.find((p) => p.userId === user?.id)?.teamId;
  const team1Players = room.players.filter((p) => p.teamId === 1);
  const team2Players = room.players.filter((p) => p.teamId === 2);

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
          <Scoreboard players={room.players} currentUserId={user?.id} teamsEnabled={room.teamsEnabled} />
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

          {room.teamsEnabled && (
            <div className="room-page__teams">
              <h3 className="room-page__teams-title">Choose your team</h3>
              <div className="room-page__teams-grid">
                {[1, 2].map((tid) => {
                  const members = tid === 1 ? team1Players : team2Players;
                  const isMine = myTeamId === tid;
                  const isFull = members.length >= room.teamSize && !isMine;
                  return (
                    <button
                      key={tid}
                      className={`room-page__team-btn${isMine ? ' room-page__team-btn--active' : ''}${isFull ? ' room-page__team-btn--full' : ''}`}
                      onClick={() => !isMine && !isFull && joinTeam(tid)}
                      disabled={isFull && !isMine}
                    >
                      <span className="room-page__team-name">Team {tid}</span>
                      <span className="room-page__team-count">{members.length}/{room.teamSize}</span>
                      <div className="room-page__team-members">
                        {members.length === 0
                          ? <span className="room-page__team-empty">Empty</span>
                          : members.map((p) => (
                            <span key={p.userId} className="room-page__team-member">
                              {p.username}{p.userId === user?.id ? ' (you)' : ''}
                            </span>
                          ))
                        }
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
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
