import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalaxyMinimap } from './GalaxyMinimap';
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

describe('GalaxyMinimap', () => {
  it('renders nothing when there are no systems or grid dimensions are 0', () => {
    const { container } = render(
      <GalaxyMinimap
        systems={[]}
        walletAddress={null}
        scrollTop={0}
        gridWidth={0}
        gridHeight={0}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('galaxy-minimap')).not.toBeInTheDocument();
  });

  it('renders minimap cells and viewport indicator for a large grid', () => {
    const systems = [
      makeSystem({ systemId: 1, coordX: 0, coordY: 0, owner: 'GME' }),
      makeSystem({ systemId: 2, coordX: 5, coordY: 20, owner: 'GOTHER' }),
    ];

    render(
      <GalaxyMinimap
        systems={systems}
        walletAddress="GME"
        scrollTop={0}
        viewportHeight={600}
        gridWidth={10}
        gridHeight={25}
      />
    );

    expect(screen.getByTestId('galaxy-minimap')).toBeInTheDocument();
    expect(screen.getByTestId('minimap-cell-1')).toBeInTheDocument();
    expect(screen.getByTestId('minimap-cell-2')).toBeInTheDocument();

    const indicator = screen.getByTestId('minimap-viewport-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('y', '0');
    expect(indicator).toHaveAttribute('height', '600');
  });

  it('accurately reflects scrolled viewport position', () => {
    const systems = [makeSystem({ systemId: 1, coordX: 0, coordY: 0 })];

    const { rerender } = render(
      <GalaxyMinimap
        systems={systems}
        walletAddress={null}
        scrollTop={0}
        viewportHeight={600}
        gridWidth={20}
        gridHeight={50}
      />
    );

    let indicator = screen.getByTestId('minimap-viewport-indicator');
    expect(indicator).toHaveAttribute('y', '0');

    // Scroll viewport down by 340px
    rerender(
      <GalaxyMinimap
        systems={systems}
        walletAddress={null}
        scrollTop={340}
        viewportHeight={600}
        gridWidth={20}
        gridHeight={50}
      />
    );

    indicator = screen.getByTestId('minimap-viewport-indicator');
    expect(indicator).toHaveAttribute('y', '340');
  });

  it('calls onNavigate with target position when minimap is clicked', () => {
    const systems = [makeSystem({ systemId: 1, coordX: 0, coordY: 0 })];
    const onNavigate = vi.fn();

    render(
      <GalaxyMinimap
        systems={systems}
        walletAddress={null}
        scrollTop={0}
        viewportHeight={600}
        gridWidth={20}
        gridHeight={50} // fullHeight = 50 * 34 = 1700
        onNavigate={onNavigate}
      />
    );

    const svg = screen.getByRole('img', { name: /galaxy minimap/i });
    // Mock getBoundingClientRect
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      bottom: 200,
      right: 120,
      width: 120,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Click halfway down (clientY = 100 out of 200)
    fireEvent.click(svg, { clientY: 100 });

    expect(onNavigate).toHaveBeenCalled();
    const targetScroll = onNavigate.mock.calls[0][0];
    // clickRatio = 0.5; target = 0.5 * 1700 - 300 = 850 - 300 = 550
    expect(targetScroll).toBe(550);
  });
});
