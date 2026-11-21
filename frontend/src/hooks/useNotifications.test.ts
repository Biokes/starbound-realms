import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useNotificationsData, NOTIFICATIONS_POLL_INTERVAL_MS } from './useNotifications';

const PLAYER_ADDRESS = 'G' + 'A'.repeat(55);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// Shape exactly as the backend returns it
function rawNotification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    player: PLAYER_ADDRESS,
    type: 'battle_lost',
    message: 'You lost a battle at system 5.',
    payload: { system_id: 5 },
    read: false,
    created_at: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

function mockNotificationsResponse(notifications: unknown[], status = 200) {
  vi.mocked(fetch).mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => ({ notifications }),
  } as Response);
}

describe('useNotificationsData', () => {
  it('fetches from /player/:address/notifications on mount', async () => {
    mockNotificationsResponse([rawNotification()]);

    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith(
      `http://backend.example/player/${PLAYER_ADDRESS}/notifications`
    );
  });

  it('maps snake_case backend fields to camelCase', async () => {
    mockNotificationsResponse([rawNotification()]);

    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notifications).toEqual([
      {
        id: 1,
        player: PLAYER_ADDRESS,
        type: 'battle_lost',
        message: 'You lost a battle at system 5.',
        payload: { system_id: 5 },
        read: false,
        createdAt: Date.parse('2026-11-20T10:00:00.000Z'),
      },
    ]);
  });

  it('reports unreadCount correctly', async () => {
    mockNotificationsResponse([
      rawNotification({ read: false }),
      rawNotification({ id: 2, read: true }),
      rawNotification({ id: 3, read: false }),
    ]);

    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.unreadCount).toBe(2);
  });

  it('skips the request when address is null', () => {
    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', null)
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sets an error when the backend responds with a non-OK status', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('failed to fetch notifications: 500');
    expect(result.current.notifications).toEqual([]);
  });

  it('sets an error instead of throwing when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toMatch(/network down/);
  });

  it('re-fetches on the polling interval', async () => {
    mockNotificationsResponse([rawNotification()]);

    renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS, NOTIFICATIONS_POLL_INTERVAL_MS)
    );

    // Initial fetch
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance clock past one interval
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATIONS_POLL_INTERVAL_MS + 100);
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('exposes a refetch function that triggers an immediate re-fetch', async () => {
    mockNotificationsResponse([rawNotification()]);

    const { result } = renderHook(() =>
      useNotificationsData('http://backend.example', PLAYER_ADDRESS)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
