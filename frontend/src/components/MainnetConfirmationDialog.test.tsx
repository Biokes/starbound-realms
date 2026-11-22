import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainnetConfirmationDialog } from './MainnetConfirmationDialog';

describe('MainnetConfirmationDialog', () => {
  it('renders the confirmation dialog with action name', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<MainnetConfirmationDialog action="Claim System" onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText(/mainnet transaction/i)).toBeInTheDocument();
    expect(screen.getByText(/claim system/i)).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<MainnetConfirmationDialog action="Build Fleet" onConfirm={onConfirm} onCancel={onCancel} />);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<MainnetConfirmationDialog action="Attack System" onConfirm={onConfirm} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when overlay is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <MainnetConfirmationDialog action="Move Fleet" onConfirm={onConfirm} onCancel={onCancel} />
    );

    const overlay = container.firstChild as HTMLElement;
    await user.click(overlay);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not call onCancel when dialog content is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<MainnetConfirmationDialog action="Test Action" onConfirm={onConfirm} onCancel={onCancel} />);

    const dialogContent = screen.getByText(/mainnet transaction/i).parentElement;
    if (dialogContent) {
      await user.click(dialogContent);
    }

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
