import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RecentlyActivePlayers } from './RecentlyActivePlayers';
import { RecentlyActivePlayer } from '../hooks/useRecentlyActivePlayers';

const NOW = new Date('2026-11-20T12:00:00.000Z');

function player(overrides: Partial<RecentlyActivePlayer> = {}): RecentlyActivePlayer {
  return {
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwx',
    systemsOwned: 3,
    lastActive: '2026-11-20T11:55:00.000Z',
    ...overrides,
  };
}

describe('RecentlyActivePlayers', () => {
  it('shows a loading indicator while loading', () => {
    render(<RecentlyActivePlayers players={[]} isLoading={true} error={null} />);

    expect(screen.getByRole('status', { name: /loading recent activity/i })).toBeInTheDocument();
  });

  it('shows the error when the fetch failed', () => {
    render(
      <RecentlyActivePlayers
        players={[]}
        isLoading={false}
        error="failed to fetch recently active players: 500"
      />
    );

    expect(screen.getByText(/failed to fetch recently active players/i)).toBeInTheDocument();
  });

  it('shows an empty state when nobody has been active yet', () => {
    render(<RecentlyActivePlayers players={[]} isLoading={false} error={null} />);

    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists each player in the order given with address, systems and time since last activity', () => {
    render(
      <RecentlyActivePlayers
        players={[
          player({ address: 'GNEWESTPLAYERADDRESS', systemsOwned: 1, lastActive: '2026-11-20T11:59:40.000Z' }),
          player({ address: 'GOLDERPLAYERADDRESS', systemsOwned: 4, lastActive: '2026-11-20T09:00:00.000Z' }),
        ]}
        isLoading={false}
        error={null}
        now={NOW}
      />
    );

    const items = within(screen.getByRole('list', { name: 'Recently active players' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(within(items[0]).getByText('GNEWES...RESS')).toHaveAttribute('title', 'GNEWESTPLAYERADDRESS');
    expect(within(items[0]).getByText('1 system')).toBeInTheDocument();
    expect(within(items[0]).getByText('just now')).toHaveAttribute('datetime', '2026-11-20T11:59:40.000Z');

    expect(within(items[1]).getByText('GOLDER...RESS')).toBeInTheDocument();
    expect(within(items[1]).getByText('4 systems')).toBeInTheDocument();
    expect(within(items[1]).getByText('3h ago')).toBeInTheDocument();
  });

  it('does not show loading or error text in the happy path', () => {
    render(<RecentlyActivePlayers players={[player()]} isLoading={false} error={null} now={NOW} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });
});
