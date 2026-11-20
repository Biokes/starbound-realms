import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecentlyActivePlayers } from './useRecentlyActivePlayers';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

// Shape exactly as the backend's `SELECT * FROM players` returns it.
function rawPlayer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    address: 'GRECENTPLAYER',
    systems_owned: 2,
    battles_won: 0,
    battles_lost: 0,
    first_seen: '2026-11-01T12:00:00.000Z',
    last_active: '2026-11-20T11:55:00.000Z',
    ...overrides,
  };
}

function mockResponse(players: unknown[]) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ players }),
  } as Response);
}

describe('useRecentlyActivePlayers', () => {
  it('fetches from /player/recent and maps rows to the camelCase shape', async () => {
    mockResponse([rawPlayer()]);

    const { result } = renderHook(() => useRecentlyActivePlayers('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://backend.example/player/recent');
    expect(result.current.players).toEqual([
      { address: 'GRECENTPLAYER', systemsOwned: 2, lastActive: '2026-11-20T11:55:00.000Z' },
    ]);
  });

  it('keeps the backend order (most recent first)', async () => {
    mockResponse([rawPlayer({ address: 'GNEWEST' }), rawPlayer({ address: 'GOLDER' })]);

    const { result } = renderHook(() => useRecentlyActivePlayers('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.players.map((p) => p.address)).toEqual(['GNEWEST', 'GOLDER']);
  });

  it('starts loading with no error and no players', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRecentlyActivePlayers('http://backend.example'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.players).toEqual([]);
  });

  it('sets an error when the backend responds with a non-OK status', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    const { result } = renderHook(() => useRecentlyActivePlayers('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/500/);
    expect(result.current.players).toEqual([]);
  });

  it('sets an error instead of throwing when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useRecentlyActivePlayers('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/network down/);
  });
});
