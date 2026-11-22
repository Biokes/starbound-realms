import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@stellar/stellar-sdk', () => ({
  rpc: { Server: vi.fn().mockImplementation(() => ({ mock: 'server' })) },
}));

vi.mock('./eventListener', () => ({
  runIndexerPollCycle: vi.fn(),
  startEventListener: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));

vi.mock('../db/queries', () => ({
  fetchIndexerCursor: vi.fn(),
  saveIndexerCursor: vi.fn(),
}));

import { createPersistingPollCycle, startIndexer } from './indexer';
import { rpc } from '@stellar/stellar-sdk';
import { runIndexerPollCycle, startEventListener } from './eventListener';
import { fetchIndexerCursor, saveIndexerCursor } from '../db/queries';

const db = {} as any;
const contractIds = ['C1', 'C2'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(startEventListener).mockReturnValue({ stop: vi.fn() });
});

// ── createPersistingPollCycle ────────────────────────────────────────────────

describe('createPersistingPollCycle', () => {
  it('persists the ledger returned by the wrapped poll cycle', async () => {
    const runPollCycle = vi.fn().mockResolvedValue(42);
    const saveCursor = vi.fn().mockResolvedValue(undefined);

    const nextLedger = await createPersistingPollCycle(runPollCycle, saveCursor)(7);

    expect(runPollCycle).toHaveBeenCalledWith(7);
    expect(saveCursor).toHaveBeenCalledWith(42);
    expect(nextLedger).toBe(42);
  });

  it('does not persist when the poll cycle fails', async () => {
    const runPollCycle = vi.fn().mockRejectedValue(new Error('rpc down'));
    const saveCursor = vi.fn();

    await expect(createPersistingPollCycle(runPollCycle, saveCursor)(7)).rejects.toThrow('rpc down');
    expect(saveCursor).not.toHaveBeenCalled();
  });
});

// ── startIndexer ─────────────────────────────────────────────────────────────

describe('startIndexer', () => {
  it('starts the listener from the persisted cursor', async () => {
    vi.mocked(fetchIndexerCursor).mockResolvedValue(123);

    const handle = await startIndexer({ db, rpcUrl: 'https://rpc', contractIds, pollIntervalMs: 1000 });

    expect(fetchIndexerCursor).toHaveBeenCalledWith(db);
    expect(startEventListener).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 123, pollIntervalMs: 1000 })
    );
    expect(handle).toEqual({ stop: expect.any(Function) });
  });

  it('persists the ledger after each poll cycle it runs', async () => {
    vi.mocked(fetchIndexerCursor).mockResolvedValue(1);
    vi.mocked(runIndexerPollCycle).mockResolvedValue(50);

    await startIndexer({ db, rpcUrl: 'https://rpc', contractIds, pollIntervalMs: 1000 });

    const options = vi.mocked(startEventListener).mock.calls[0][0];
    await options.runPollCycle(1);

    expect(runIndexerPollCycle).toHaveBeenCalledWith(expect.anything(), db, contractIds, 1);
    expect(saveIndexerCursor).toHaveBeenCalledWith(db, 50);
  });

  it('passes allowHttp through to the RPC client, off by default', async () => {
    vi.mocked(fetchIndexerCursor).mockResolvedValue(1);

    await startIndexer({ db, rpcUrl: 'https://rpc', contractIds, pollIntervalMs: 1000 });
    await startIndexer({ db, rpcUrl: 'http://localhost:8000', contractIds, pollIntervalMs: 1000, allowHttp: true });

    expect(rpc.Server).toHaveBeenNthCalledWith(1, 'https://rpc', { allowHttp: false });
    expect(rpc.Server).toHaveBeenNthCalledWith(2, 'http://localhost:8000', { allowHttp: true });
  });

  // ── Malformed event resilience (#243) ─────────────────────────────────────

  it('continues indexing after a malformed event causes a decode error', async () => {
    vi.mocked(fetchIndexerCursor).mockResolvedValue(1);
    vi.mocked(runIndexerPollCycle)
      .mockRejectedValueOnce(new Error('decode failed: invalid XDR'))
      .mockResolvedValueOnce(50);

    const onError = vi.fn();
    await startIndexer({ db, rpcUrl: 'https://rpc', contractIds, pollIntervalMs: 1000, onError });

    const options = vi.mocked(startEventListener).mock.calls[0][0];

    // First cycle fails due to malformed event
    await options.runPollCycle(1).catch(() => {});

    // Second cycle succeeds
    const nextLedger = await options.runPollCycle(1);
    expect(nextLedger).toBe(50);
  });
});
