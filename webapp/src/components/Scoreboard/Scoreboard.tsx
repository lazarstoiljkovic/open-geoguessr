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
  teamsEnabled?: boolean;
}

function PlayerRow({ player, rank, currentUserId, colorIndex }: {
  player: Player; rank: number; currentUserId?: string; colorIndex: number;
}) {
  const color = avatarColor(colorIndex);
  const MEDALS = ['🥇', '🥈', '🥉'];
  return (
    <div
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
          {rank < 3 ? MEDALS[rank] : `#${rank + 1}`}
        </span>
      </div>
    </div>
  );
}

export default function Scoreboard({ players, currentUserId, teamsEnabled }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (!teamsEnabled) {
    return (
      <div className="scoreboard">
        {sorted.map((player, i) => (
          <PlayerRow
            key={player.userId}
            player={player}
            rank={i}
            currentUserId={currentUserId}
            colorIndex={players.findIndex((p) => p.userId === player.userId)}
          />
        ))}
      </div>
    );
  }

  const teams = [1, 2].map((tid) => {
    const members = [...players.filter((p) => p.teamId === tid)].sort((a, b) => b.score - a.score);
    const total = members.reduce((s, p) => s + p.score, 0);
    return { tid, members, total };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="scoreboard">
      {teams.map((team) => (
        <div key={team.tid} className="scoreboard__team-group">
          <div className="scoreboard__team-header">
            <span className="scoreboard__team-label">👥 Team {team.tid}</span>
            <span className="scoreboard__team-total">{team.total.toLocaleString()}</span>
          </div>
          {team.members.map((player, i) => (
            <PlayerRow
              key={player.userId}
              player={player}
              rank={i}
              currentUserId={currentUserId}
              colorIndex={players.findIndex((p) => p.userId === player.userId)}
            />
          ))}
          {team.members.length === 0 && (
            <p className="scoreboard__team-empty">No players</p>
          )}
        </div>
      ))}
    </div>
  );
}
