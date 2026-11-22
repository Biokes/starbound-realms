import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BattleFeed, BattleFeedProps } from './BattleFeed';
import { RecentBattle } from '../hooks/useRecentBattles';
import { truncateAddress } from '../lib/format';

const ATTACKER = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwx';
const DEFENDER = 'ZYXWVUTSRQPONMLKJIHGFEDCBA0987654321zyxwvutsrqponmlkjihgfedcba';

function battle(overrides: Partial<RecentBattle> = {}): RecentBattle {
  return {
    battleId: 7,
    attacker: ATTACKER,
    defender: DEFENDER,
    systemId: 4,
    winner: DEFENDER,
    rounds: 3,
    ledgerSequence: 5000,
    createdAt: Date.parse('2026-10-01T12:00:00.000Z'),
    ...overrides,
  };
}

function props(overrides: Partial<BattleFeedProps> = {}): BattleFeedProps {
  return {
    battles: [],
    isLoading: false,
    error: null,
    hasPreviousPage: false,
    hasNextPage: false,
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    ...overrides,
  };
}

describe('BattleFeed', () => {
  it('shows a loading state while battles are loading', () => {
    render(<BattleFeed {...props({ isLoading: true })} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading battles…');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an empty message when there are no battles', () => {
    render(<BattleFeed {...props()} />);

    expect(screen.getByText('No battles yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the error instead of the list when the fetch failed', () => {
    render(<BattleFeed {...props({ error: 'failed to fetch battles: 500' })} />);

    expect(screen.getByText('failed to fetch battles: 500')).toBeInTheDocument();
    expect(screen.queryByText('No battles yet.')).not.toBeInTheDocument();
  });

  it('lists each battle with attacker, defender, system, winner and rounds', () => {
    render(
      <BattleFeed
        {...props({
          battles: [
            battle({ battleId: 7, systemId: 4, rounds: 3, winner: DEFENDER }),
            battle({ battleId: 8, systemId: 9, rounds: 1, winner: ATTACKER }),
          ],
        })}
      />
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(items[0]).toHaveTextContent(
      `${truncateAddress(ATTACKER)} attacked ${truncateAddress(DEFENDER)} at system 4. ${truncateAddress(DEFENDER)} won in 3 round(s).`
    );
    expect(items[0]).toHaveTextContent('Battle #7 · ledger 5000');

    expect(items[1]).toHaveTextContent(
      `${truncateAddress(ATTACKER)} attacked ${truncateAddress(DEFENDER)} at system 9. ${truncateAddress(ATTACKER)} won in 1 round(s).`
    );
    expect(items[1]).toHaveTextContent('Battle #8');
  });

  it('shows a Replay button for each battle only when onReplay is provided', () => {
    const { rerender } = render(
      <BattleFeed {...props({ battles: [battle({ battleId: 7 })] })} />
    );
    expect(screen.queryByRole('button', { name: 'Replay battle 7' })).not.toBeInTheDocument();

    rerender(
      <BattleFeed {...props({ battles: [battle({ battleId: 7 })], onReplay: vi.fn() })} />
    );
    expect(screen.getByRole('button', { name: 'Replay battle 7' })).toBeInTheDocument();
  });

  it('calls onReplay with the battle id when Replay is clicked', () => {
    const onReplay = vi.fn();
    render(
      <BattleFeed
        {...props({ battles: [battle({ battleId: 42 })], onReplay })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replay battle 42' }));

    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReplay).toHaveBeenCalledWith(42);
  });

  it('enables Previous and Next only when those pages exist and calls the handlers', () => {
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();
    render(
      <BattleFeed
        {...props({
          battles: [battle()],
          hasPreviousPage: true,
          hasNextPage: false,
          onPreviousPage,
          onNextPage,
        })}
      />
    );

    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(previous).toBeEnabled();
    expect(next).toBeDisabled();

    fireEvent.click(previous);
    expect(onPreviousPage).toHaveBeenCalledTimes(1);
    expect(onNextPage).not.toHaveBeenCalled();
  });
});
