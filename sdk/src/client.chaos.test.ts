import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from './client.js';
import { NetworkError } from './errors.js';

/**
 * Chaos tests for retry-with-backoff (#316). A mock RPC call fails a set
 * number of times with a transient error, then succeeds.
 */

const SEND_REQUEST = 'client error (SendRequest)';

function transientError(): Error {
  return new Error(SEND_REQUEST);
}

/** Deterministic pseudo-random numbers in [0, 1), so chaos runs are reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('withRetry against a flaky RPC', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recovers when the RPC fails fewer times than maxAttempts', async () => {
    const rpc = vi
      .fn()
      .mockRejectedValueOnce(transientError())
      .mockRejectedValueOnce(transientError())
      .mockResolvedValue('ledger-42');

    const result = withRetry(rpc, { maxAttempts: 3, baseDelayMs: 100 });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe('ledger-42');
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('waits baseDelayMs, then doubles the delay, between attempts', async () => {
    const rpc = vi
      .fn()
      .mockRejectedValueOnce(transientError())
      .mockRejectedValueOnce(transientError())
      .mockResolvedValue('ok');

    const result = withRetry(rpc, { maxAttempts: 3, baseDelayMs: 500 });

    await vi.advanceTimersByTimeAsync(0);
    expect(rpc).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(499);
    expect(rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(rpc).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(999);
    expect(rpc).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(rpc).toHaveBeenCalledTimes(3);

    await expect(result).resolves.toBe('ok');
  });

  it('gives up with NetworkError after maxAttempts transient failures', async () => {
    const rpc = vi.fn().mockRejectedValue(transientError());

    const result = withRetry(rpc, { maxAttempts: 4, baseDelayMs: 10 });
    const assertion = expect(result).rejects.toBeInstanceOf(NetworkError);
    await vi.runAllTimersAsync();

    await assertion;
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it('does not retry a non-transient error', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('simulation failed: contract panic'));

    await expect(withRetry(rpc, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow(
      'simulation failed: contract panic'
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('keeps every seeded flaky run within maxAttempts and only ends in success or NetworkError', async () => {
    // The loop below relies on real timers: with baseDelayMs 0 each backoff is a real setTimeout(0).
    vi.useRealTimers();
    const random = seededRandom(20240601);
    const maxAttempts = 5;
    const outcomes: Array<'ok' | 'network-error'> = [];
    let retriesUsed = 0;

    for (let operation = 0; operation < 200; operation++) {
      const rpc = vi.fn(async () => {
        if (random() < 0.5) throw transientError();
        return 'ok';
      });

      try {
        await withRetry(rpc, { maxAttempts, baseDelayMs: 0 });
        outcomes.push('ok');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        outcomes.push('network-error');
      }

      expect(rpc.mock.calls.length).toBeLessThanOrEqual(maxAttempts);
      if (rpc.mock.calls.length > 1 && outcomes[outcomes.length - 1] === 'ok') {
        retriesUsed++;
      }
    }

    expect(outcomes).toHaveLength(200);
    expect(outcomes).toContain('ok');
    expect(retriesUsed).toBeGreaterThan(0);
  });
});
