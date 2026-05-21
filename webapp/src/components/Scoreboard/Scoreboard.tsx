import React from 'react';
import classNames from 'classnames';
import { Player } from '../../types';
import './Scoreboard.scss';

interface ScoreboardProps {
  players: Player[];
  currentUserId?: string;
}

export default function Scoreboard({ players, currentUserId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="scoreboard">
      {sorted.map((player, i) => (
        <div
          key={player.userId}
          className={classNames('scoreboard__row', {
            'scoreboard__row--me': player.userId === currentUserId,
            'scoreboard__row--disconnected': !player.connected,
          })}
        >
          <span className="scoreboard__rank">
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
          </span>
          <span className="scoreboard__name">
            {player.username}
            {player.isHost && <span className="scoreboard__host-badge">HOST</span>}
            {!player.connected && <span className="scoreboard__disconnected"> (offline)</span>}
          </span>
          <span className="scoreboard__score">{player.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
