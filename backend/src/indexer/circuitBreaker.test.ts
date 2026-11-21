import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from './circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  const failureThreshold = 3;
  const cooldownMs = 1000;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold,
      cooldownMs,
    });
  });

  describe('Closed state (normal operation)', () => {
    it('allows requests through when circuit is closed', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('tracks consecutive failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('RPC down'));
      
      for (let i = 0; i < failureThreshold - 1; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('RPC down');
      }
      
      expect(breaker.getState()).toBe(CircuitState.Closed);
      expect(breaker.getConsecutiveFailures()).toBe(failureThreshold - 1);
    });

    it('opens circuit after reaching failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('RPC down'));
      
      for (let i = 0; i < failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('RPC down');
      }
      
      expect(breaker.getState()).toBe(CircuitState.Open);
    });

    it('resets failure count on success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).resolves.toBe('success');
      
      expect(breaker.getConsecutiveFailures()).toBe(0);
      expect(breaker.getState()).toBe(CircuitState.Closed);
    });
  });

  describe('Open state (blocking requests)', () => {
    beforeEach(async () => {
      // Force circuit open by hitting failure threshold
      const fn = vi.fn().mockRejectedValue(new Error('RPC down'));
      for (let i = 0; i < failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }
    });

    it('rejects requests immediately when circuit is open', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is open');
      expect(fn).not.toHaveBeenCalled();
    });

    it('transitions to half-open after cooldown period', async () => {
      vi.useFakeTimers();
      
      const fn = vi.fn().mockResolvedValue('success');
      
      // Still open before cooldown
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is open');
      
      // Advance time past cooldown
      vi.advanceTimersByTime(cooldownMs + 100);
      
      // Should allow one retry attempt
      await expect(breaker.execute(fn)).resolves.toBe('success');
      expect(breaker.getState()).toBe(CircuitState.Closed);
      
      vi.useRealTimers();
    });
  });

  describe('Half-open state (testing recovery)', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      
      // Force circuit open
      const failFn = vi.fn().mockRejectedValue(new Error('RPC down'));
      for (let i = 0; i < failureThreshold; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }
      
      // Advance past cooldown to enter half-open
      vi.advanceTimersByTime(cooldownMs + 100);
    });

    it('closes circuit on successful retry', async () => {
      const fn = vi.fn().mockResolvedValue('recovery success');
      await expect(breaker.execute(fn)).resolves.toBe('recovery success');
      expect(breaker.getState()).toBe(CircuitState.Closed);
      expect(breaker.getConsecutiveFailures()).toBe(0);
      
      vi.useRealTimers();
    });

    it('reopens circuit if retry fails', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('still down'));
      await expect(breaker.execute(fn)).rejects.toThrow('still down');
      expect(breaker.getState()).toBe(CircuitState.Open);
      
      vi.useRealTimers();
    });
  });

  describe('State change notifications', () => {
    it('calls onStateChange callback when transitioning', async () => {
      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker({
        failureThreshold,
        cooldownMs,
        onStateChange,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      for (let i = 0; i < failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }
      
      expect(onStateChange).toHaveBeenCalledWith(CircuitState.Open);
    });
  });

  describe('Manual reset', () => {
    it('resets circuit to closed state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      for (let i = 0; i < failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }
      
      expect(breaker.getState()).toBe(CircuitState.Open);
      
      breaker.reset();
      
      expect(breaker.getState()).toBe(CircuitState.Closed);
      expect(breaker.getConsecutiveFailures()).toBe(0);
    });
  });
});
