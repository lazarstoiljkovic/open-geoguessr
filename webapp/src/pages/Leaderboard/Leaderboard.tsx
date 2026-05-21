import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../../api/leaderboard.api';
import { LeaderboardEntry } from '../../types';
import './Leaderboard.scss';

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-page__header">
        <h1>🏆 Leaderboard</h1>
        <p>Top players worldwide</p>
      </div>

      <div className="leaderboard-page__table-wrap">
        {loading ? (
          <div className="leaderboard-page__loading">
            <div className="leaderboard-page__spinner" />
          </div>
        ) : entries.length === 0 ? (
          <div className="leaderboard-page__empty">
            <p>No games played yet. Be the first!</p>
          </div>
        ) : (
          <table className="leaderboard-page__table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Total Score</th>
                <th>Games Played</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.username} className={entry.rank <= 3 ? 'leaderboard-page__top' : ''}>
                  <td className="leaderboard-page__rank">
                    {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                  </td>
                  <td className="leaderboard-page__name">{entry.username}</td>
                  <td className="leaderboard-page__score">{entry.totalScore.toLocaleString()}</td>
                  <td>{entry.gamesPlayed}</td>
                  <td>
                    {entry.gamesPlayed > 0
                      ? Math.round(entry.totalScore / entry.gamesPlayed).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
