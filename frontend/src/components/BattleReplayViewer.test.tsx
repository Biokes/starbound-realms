import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BattleReplayViewer } from './BattleReplayViewer';
import { BattleReplay } from '../hooks/useBattleReplay';

const ATTACKER = 'GATTACKER1234567890123456789012345678901234567890123456';
const DEFENDER = 'GDEFENDER1234567890123456789012345678901234567890123456';

function makeReplay(roundCount: number): BattleReplay {
  const rounds = Array.from({ length: roundCount }, (_, i) => ({
    roundNumber: i + 1,
    attacker: { scouts: 3 - i, fighters: 1, cruisers: 0, dreadnoughts: 0 },
    defender: { scouts: Math.max(0, 2 - i), fighters: 0, cruisers: 0, dreadnoughts: 0 },
  }));
  return {
    battle: {
      battleId: 5,
      attacker: ATTACKER,
      defender: DEFENDER,
      systemId: 3,
      winner: ATTACKER,
      rounds: roundCount,
      ledgerSequence: 1000,
    },
    rounds,
  };
}

describe('BattleReplayViewer', () => {
  it('shows a loading indicator while the replay is being fetched', () => {
    render(
      <BattleReplayViewer replay={null} isLoading={true} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByText(/loading replay/i)).toBeInTheDocument();
  });

  it('shows the error message when the fetch failed', () => {
    render(
      <BattleReplayViewer
        replay={null}
        isLoading={false}
        error="failed to fetch replay: 404"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/failed to fetch replay/i)).toBeInTheDocument();
  });

  it('shows a not-indexed message when rounds array is empty', () => {
    render(
      <BattleReplayViewer replay={makeReplay(0)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByText(/per-round data not yet indexed/i)).toBeInTheDocument();
  });

  it('shows the battle metadata in the header', () => {
    render(
      <BattleReplayViewer replay={makeReplay(2)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByText(/battle #5/i)).toBeInTheDocument();
    expect(screen.getByText(/system 3/i)).toBeInTheDocument();
  });

  it('shows round 1 of N on initial render', () => {
    render(
      <BattleReplayViewer replay={makeReplay(2)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByText(/round 1 of 2/i)).toBeInTheDocument();
  });

  it('advances to the next round when Next is clicked', () => {
    render(
      <BattleReplayViewer replay={makeReplay(2)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /next round/i }));

    expect(screen.getByText(/round 2 of 2/i)).toBeInTheDocument();
  });

  it('goes back to the previous round when Prev is clicked', () => {
    render(
      <BattleReplayViewer replay={makeReplay(2)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /next round/i }));
    fireEvent.click(screen.getByRole('button', { name: /previous round/i }));

    expect(screen.getByText(/round 1 of 2/i)).toBeInTheDocument();
  });

  it('disables Prev on the first round', () => {
    render(
      <BattleReplayViewer replay={makeReplay(2)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /previous round/i })).toBeDisabled();
  });

  it('disables Next on the last round', () => {
    render(
      <BattleReplayViewer replay={makeReplay(1)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /next round/i })).toBeDisabled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BattleReplayViewer replay={makeReplay(1)} isLoading={false} error={null} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole('button', { name: /close replay/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows attacker and defender unit counts for the current round', () => {
    render(
      <BattleReplayViewer replay={makeReplay(2)} isLoading={false} error={null} onClose={vi.fn()} />
    );

    expect(screen.getByText('Attacker')).toBeInTheDocument();
    expect(screen.getByText('Defender')).toBeInTheDocument();
    // Round 1: attacker scouts=3, defender scouts=2
    const scoutCounts = screen.getAllByText('Scouts');
    expect(scoutCounts).toHaveLength(2);
  });
});
