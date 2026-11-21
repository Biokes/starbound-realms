import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlliancePanel } from './AlliancePanel';

describe('AlliancePanel component', () => {
  const player = 'GPLAYERADDRESS1111111111111111111111111111111111111111111111';

  it('shows loading indicator when isLoading is true', () => {
    render(
      <AlliancePanel
        playerAddress={player}
        currentAlliance={null}
        isLoading={true}
        onCreateAlliance={vi.fn()}
        onJoinAlliance={vi.fn()}
      />
    );

    expect(screen.getByText(/loading alliance data/i)).toBeInTheDocument();
  });

  it('renders creation and join forms when player has no alliance', () => {
    render(
      <AlliancePanel
        playerAddress={player}
        currentAlliance={null}
        onCreateAlliance={vi.fn()}
        onJoinAlliance={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/create new alliance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/join by id/i)).toBeInTheDocument();
  });

  it('calls onCreateAlliance with entered name', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AlliancePanel
        playerAddress={player}
        currentAlliance={null}
        onCreateAlliance={onCreate}
        onJoinAlliance={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/enter alliance name/i);
    await user.type(input, 'Star Vanguard');

    const button = screen.getByRole('button', { name: /create/i });
    await user.click(button);

    expect(onCreate).toHaveBeenCalledWith('Star Vanguard');
  });

  it('calls onJoinAlliance with entered ID', async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AlliancePanel
        playerAddress={player}
        currentAlliance={null}
        onCreateAlliance={vi.fn()}
        onJoinAlliance={onJoin}
      />
    );

    const input = screen.getByPlaceholderText(/enter alliance id/i);
    await user.type(input, 'alliance-42');

    const button = screen.getByRole('button', { name: /join/i });
    await user.click(button);

    expect(onJoin).toHaveBeenCalledWith('alliance-42');
  });

  it('displays alliance details and members when in an alliance', () => {
    const alliance = {
      id: 'alliance-1',
      name: 'Galactic Empire',
      leader: player,
      members: [player, 'GMEMBER222222222222222222222222222222222222222222222222222222'],
    };

    render(
      <AlliancePanel
        playerAddress={player}
        currentAlliance={alliance}
        onCreateAlliance={vi.fn()}
        onJoinAlliance={vi.fn()}
        onLeaveAlliance={vi.fn()}
      />
    );

    expect(screen.getByText('Galactic Empire')).toBeInTheDocument();
    expect(screen.getByText('alliance-1')).toBeInTheDocument();
    expect(screen.getByText('You (Leader)')).toBeInTheDocument();
    expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave alliance/i })).toBeInTheDocument();
  });
});
