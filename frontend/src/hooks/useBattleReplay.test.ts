import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBattleReplay } from './useBattleReplay';

const BACKEND = 'http://localhost:3000';

const rawBattle = {
  battle_id: '7',
  attacker: 'GATTACKER1234567890123456789012345678901234567890123456',
  defender: 'GDEFENDER1234567890123456789012345678901234567890123456',
  system_id: 3,
  winner: 'GATTACKER1234567890123456789012345678901234567890123456',
  rounds: 2,
  ledger_sequence: '1000',
};

const rawRounds = [
  {
    round_number: 1,
    attacker_scouts: 3, attacker_fighters: 1, attacker_cruisers: 0, attacker_dreadnoughts: 0,
    defender_scouts: 2, defender_fighters: 0, defender_cruisers: 0, defender_dreadnoughts: 0,
  },
  {
    round_number: 2,
    attacker_scouts: 3, attacker_fighters: 1, attacker_cruisers: 0, attacker_dreadnoughts: 0,
    defender_scouts: 0, defender_fighters: 0, defender_cruisers: 0, defender_dreadnoughts: 0,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useBattleReplay', () => {
  it('returns null replay and does not fetch when battleId is null', () => {
    vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useBattleReplay(BACKEND, null));

    expect(result.current.replay).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches replay data for a known battle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ battle: rawBattle, rounds: rawRounds }),
    } as Response);

    const { result } = renderHook(() => useBattleReplay(BACKEND, 7));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith(`${BACKEND}/battles/7/replay`);
    expect(result.current.replay?.battle.battleId).toBe(7);
    expect(result.current.replay?.rounds).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('maps snake_case fields to camelCase', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ battle: rawBattle, rounds: rawRounds }),
    } as Response);

    const { result } = renderHook(() => useBattleReplay(BACKEND, 7));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const round = result.current.replay!.rounds[0];
    expect(round.roundNumber).toBe(1);
    expect(round.attacker.scouts).toBe(3);
    expect(round.defender.scouts).toBe(2);
  });

  it('returns an empty rounds array when no per-round data has been indexed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ battle: rawBattle, rounds: [] }),
    } as Response);

    const { result } = renderHook(() => useBattleReplay(BACKEND, 7));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.replay?.rounds).toHaveLength(0);
  });

  it('sets an error when the fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useBattleReplay(BACKEND, 999));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toMatch(/failed to fetch replay/);
    expect(result.current.replay).toBeNull();
  });

  it('sets an error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useBattleReplay(BACKEND, 7));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toMatch(/network down/);
    expect(result.current.replay).toBeNull();
  });
});
