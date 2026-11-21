import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OwnedSystemsList } from './OwnedSystemsList';
import { GalaxySystem } from '../hooks/useGalaxyData';

function makeSystem(overrides: Partial<GalaxySystem> = {}): GalaxySystem {
  return {
    systemId: 0,
    owner: null,
    coordX: 0,
    coordY: 0,
    resourceType: 'Iron',
    resourceYield: 10,
    defenseRating: 5,
    lastClaimed: 0,
    ...overrides,
  };
}

describe('OwnedSystemsList', () => {
  it('renders not connected message when walletAddress is null', () => {
    render(<OwnedSystemsList systems={[]} walletAddress={null} />);

    expect(screen.getByTestId('owned-systems-empty')).toHaveTextContent(
      /connect wallet/i
    );
  });

  it('renders empty message when player owns no systems', () => {
    const systems = [makeSystem({ systemId: 1, owner: 'GOTHER' })];
    render(<OwnedSystemsList systems={systems} walletAddress="GME" />);

    expect(screen.getByTestId('owned-systems-empty')).toHaveTextContent(
      /no systems claimed yet/i
    );
    expect(screen.getByTestId('owned-systems-count')).toHaveTextContent('0');
  });

  it('renders list of systems owned by connected player', () => {
    const systems = [
      makeSystem({ systemId: 1, owner: 'GME', resourceType: 'Plasma', coordX: 2, coordY: 5 }),
      makeSystem({ systemId: 2, owner: 'GOTHER', resourceType: 'Iron' }),
      makeSystem({ systemId: 3, owner: 'GME', resourceType: 'Energy', coordX: 4, coordY: 7 }),
      makeSystem({ systemId: 4, owner: null }),
    ];

    render(<OwnedSystemsList systems={systems} walletAddress="GME" />);

    expect(screen.getByTestId('owned-systems-count')).toHaveTextContent('2');
    expect(screen.getByTestId('owned-system-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('owned-system-item-3')).toBeInTheDocument();
    expect(screen.queryByTestId('owned-system-item-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('owned-system-item-4')).not.toBeInTheDocument();
  });

  it('calls onSelectSystem when a system item is clicked', () => {
    const systems = [makeSystem({ systemId: 5, owner: 'GME' })];
    const onSelect = vi.fn();

    render(
      <OwnedSystemsList
        systems={systems}
        walletAddress="GME"
        onSelectSystem={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('owned-system-item-5'));
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it('highlights currently selected system', () => {
    const systems = [
      makeSystem({ systemId: 1, owner: 'GME' }),
      makeSystem({ systemId: 2, owner: 'GME' }),
    ];

    render(
      <OwnedSystemsList
        systems={systems}
        walletAddress="GME"
        selectedSystemId={2}
      />
    );

    expect(screen.getByTestId('owned-system-item-2')).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByTestId('owned-system-item-1')).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('stays in sync with ownership changes when systems prop updates', () => {
    const initialSystems = [makeSystem({ systemId: 1, owner: 'GME' })];
    const { rerender } = render(
      <OwnedSystemsList systems={initialSystems} walletAddress="GME" />
    );

    expect(screen.getByTestId('owned-systems-count')).toHaveTextContent('1');
    expect(screen.getByTestId('owned-system-item-1')).toBeInTheDocument();

    // Player claims system 2
    const updatedSystems = [
      makeSystem({ systemId: 1, owner: 'GME' }),
      makeSystem({ systemId: 2, owner: 'GME' }),
    ];
    rerender(<OwnedSystemsList systems={updatedSystems} walletAddress="GME" />);

    expect(screen.getByTestId('owned-systems-count')).toHaveTextContent('2');
    expect(screen.getByTestId('owned-system-item-2')).toBeInTheDocument();

    // Player loses system 1 in battle
    const conqueredSystems = [
      makeSystem({ systemId: 1, owner: 'GENEMY' }),
      makeSystem({ systemId: 2, owner: 'GME' }),
    ];
    rerender(<OwnedSystemsList systems={conqueredSystems} walletAddress="GME" />);

    expect(screen.getByTestId('owned-systems-count')).toHaveTextContent('1');
    expect(screen.queryByTestId('owned-system-item-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('owned-system-item-2')).toBeInTheDocument();
  });
});
