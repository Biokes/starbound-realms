import React from 'react';
import { RecentlyActivePlayer } from '../hooks/useRecentlyActivePlayers';
import { formatTimeAgo, truncateAddress } from '../lib/format';
import { LoadingIndicator } from './LoadingIndicator';

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: '1rem',
    alignItems: 'center',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.6rem 1rem',
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  address: {
    fontFamily: 'monospace',
  },
  systems: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  time: {
    fontSize: '0.8rem',
    color: 'var(--accent)',
    whiteSpace: 'nowrap',
  },
  textMuted: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
};

export interface RecentlyActivePlayersProps {
  players: RecentlyActivePlayer[];
  isLoading: boolean;
  error: string | null;
  /** Reference time for the "time ago" labels; injectable for tests. */
  now?: Date;
}

/** Lists the players with the most recent on-chain activity, newest first (#311). */
export function RecentlyActivePlayers({ players, isLoading, error, now }: RecentlyActivePlayersProps) {
  if (isLoading) {
    return <LoadingIndicator label="Loading recent activity…" />;
  }
  if (error) {
    return <p style={styles.textMuted}>{error}</p>;
  }
  if (players.length === 0) {
    return <p style={styles.textMuted}>No activity yet — be the first to claim a star system.</p>;
  }

  return (
    <ul style={styles.list} aria-label="Recently active players">
      {players.map((player) => (
        <li key={player.address} style={styles.item}>
          <span style={styles.address} title={player.address}>
            {truncateAddress(player.address)}
          </span>
          <span style={styles.systems}>
            {player.systemsOwned} {player.systemsOwned === 1 ? 'system' : 'systems'}
          </span>
          <time style={styles.time} dateTime={player.lastActive}>
            {formatTimeAgo(player.lastActive, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}
