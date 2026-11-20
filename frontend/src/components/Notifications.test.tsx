import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotification, BackendNotificationsBridge } from './Notifications';

// Mock useNotificationsData so component tests don't need a real backend
vi.mock('../hooks/useNotifications', () => ({
  useNotificationsData: vi.fn(() => ({ notifications: [], unreadCount: 0, isLoading: false, error: null, refetch: vi.fn() })),
  NOTIFICATIONS_POLL_INTERVAL_MS: 15000,
}));

import { useNotificationsData } from '../hooks/useNotifications';

function Emitter({ initial }: { initial: string | null }) {
  const [message, setMessage] = useState<string | null>(initial);
  useNotification(message);
  return (
    <>
      <button onClick={() => setMessage(null)}>clear</button>
      <button onClick={() => setMessage('second error')}>change</button>
    </>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

describe('Notifications', () => {
  it('renders nothing when there is no message', () => {
    renderWithProvider(<Emitter initial={null} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a toast while a message is set', () => {
    renderWithProvider(<Emitter initial="something broke" />);

    expect(screen.getByRole('alert')).toHaveTextContent('something broke');
  });

  it('removes the toast when the message is cleared', () => {
    renderWithProvider(<Emitter initial="something broke" />);

    fireEvent.click(screen.getByText('clear'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces the toast when the message changes', () => {
    renderWithProvider(<Emitter initial="first error" />);

    fireEvent.click(screen.getByText('change'));

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('second error');
  });

  it('lets the player dismiss a toast', () => {
    renderWithProvider(<Emitter initial="something broke" />);

    fireEvent.click(screen.getByLabelText('Dismiss notification'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stacks messages from multiple sources in one surface', () => {
    renderWithProvider(
      <>
        <Emitter initial="claim failed" />
        <Emitter initial="build failed" />
      </>
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0].parentElement).toBe(alerts[1].parentElement);
  });

  it('removes a toast when its source unmounts', () => {
    const { rerender } = renderWithProvider(<Emitter initial="something broke" />);

    rerender(<NotificationProvider>{null}</NotificationProvider>);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('throws a helpful error when used outside the provider', () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Emitter initial="x" />)).toThrow(/NotificationProvider/);
    } finally {
      console.error = original;
    }
  });
});

// ── BackendNotificationsBridge (#218) ─────────────────────────────────────────

describe('BackendNotificationsBridge', () => {
  beforeEach(() => {
    vi.mocked(useNotificationsData).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows a toast for each unread backend notification', async () => {
    vi.mocked(useNotificationsData).mockReturnValue({
      notifications: [
        { id: 1, player: 'G' + 'A'.repeat(55), type: 'battle_lost', message: 'You lost at system 5.', payload: null, read: false, createdAt: 1000 },
      ],
      unreadCount: 1,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <NotificationProvider>
        <BackendNotificationsBridge backendUrl="http://backend.test" address={'G' + 'A'.repeat(55)} />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('You lost at system 5.'));
  });

  it('does not show already-read notifications as toasts', () => {
    vi.mocked(useNotificationsData).mockReturnValue({
      notifications: [
        { id: 2, player: 'G' + 'A'.repeat(55), type: 'battle_won', message: 'You won!', payload: null, read: true, createdAt: 1000 },
      ],
      unreadCount: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <NotificationProvider>
        <BackendNotificationsBridge backendUrl="http://backend.test" address={'G' + 'A'.repeat(55)} />
      </NotificationProvider>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not duplicate toasts across re-renders for the same notification id', async () => {
    const notifications = [
      { id: 3, player: 'G' + 'A'.repeat(55), type: 'battle_lost', message: 'Lost again.', payload: null, read: false, createdAt: 1000 },
    ];
    vi.mocked(useNotificationsData).mockReturnValue({
      notifications,
      unreadCount: 1,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { rerender } = render(
      <NotificationProvider>
        <BackendNotificationsBridge backendUrl="http://backend.test" address={'G' + 'A'.repeat(55)} />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));

    rerender(
      <NotificationProvider>
        <BackendNotificationsBridge backendUrl="http://backend.test" address={'G' + 'A'.repeat(55)} />
      </NotificationProvider>
    );

    // Still only one toast — not doubled on re-render
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
