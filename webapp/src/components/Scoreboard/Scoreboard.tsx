import React from 'react';
import classNames from 'classnames';
import { Player } from '../../types';
import './Scoreboard.scss';

const AVATAR_COLORS = [
  '#4caf7d', '#ff6b35', '#4fc3f7', '#ab47bc',
  '#f7c948', '#ef5350', '#26c6da', '#66bb6a',
];

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function avatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

interface ScoreboardProps {
  players: Player[];
  currentUserId?: string;
}

export default function Scoreboard({ players, currentUserId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="scoreboard">
      {sorted.map((player, i) => {
        const color = avatarColor(players.findIndex((p) => p.userId === player.userId));
        return (
          <div
            key={player.userId}
            className={classNames('scoreboard__row', {
              'scoreboard__row--me': player.userId === currentUserId,
              'scoreboard__row--disconnected': !player.connected,
            })}
          >
            <div className="scoreboard__avatar" style={{ background: `${color}22`, borderColor: color }}>
              <span style={{ color }}>{getInitials(player.username)}</span>
              {player.connected && <span className="scoreboard__online-dot" />}
            </div>
            <span className="scoreboard__name">
              {player.username}
              {player.isHost && <span className="scoreboard__host-badge">HOST</span>}
              {!player.connected && <span className="scoreboard__disconnected">offline</span>}
            </span>
            <div className="scoreboard__rank-score">
              <span className="scoreboard__score">{player.score.toLocaleString()}</span>
              <span className="scoreboard__rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
