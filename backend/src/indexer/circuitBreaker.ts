/**
 * Circuit breaker for Soroban RPC calls (#232).
 * 
 * Prevents the indexer from hammering a struggling RPC node by temporarily
 * halting requests after N consecutive failures. After a cooldown period,
 * it transitions to half-open state and allows one retry attempt.
 */

export enum CircuitState {
  Closed = 'closed',      // Normal operation
  Open = 'open',          // Blocking requests after failures
  HalfOpen = 'half_open', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Milliseconds to wait before attempting recovery */
  cooldownMs: number;
  /** Optional callback when circuit state changes */
  onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private readonly options: CircuitBreakerOptions) {}

  /**
   * Executes the given async function with circuit breaker protection.
   * Throws an error if the circuit is open, otherwise attempts the call
   * and updates the circuit state based on success/failure.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.Open) {
      if (this.shouldAttemptRecovery()) {
        this.transition(CircuitState.HalfOpen);
      } else {
        throw new Error('Circuit breaker is open: RPC calls are temporarily blocked');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt >= this.options.cooldownMs;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HalfOpen) {
      this.transition(CircuitState.Closed);
    }
    this.consecutiveFailures = 0;
  }

  private onFailure(): void {
    this.consecutiveFailures++;

    if (this.state === CircuitState.HalfOpen) {
      // Recovery attempt failed, reopen the circuit
      this.transition(CircuitState.Open);
    } else if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.transition(CircuitState.Open);
    }
  }

  private transition(newState: CircuitState): void {
    this.state = newState;

    if (newState === CircuitState.Open) {
      this.openedAt = Date.now();
    } else if (newState === CircuitState.Closed) {
      this.openedAt = null;
      this.consecutiveFailures = 0;
    }

    this.options.onStateChange?.(newState);
  }

  getState(): CircuitState {
    return this.state;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /** Manually reset the circuit to closed state (useful for testing) */
  reset(): void {
    this.transition(CircuitState.Closed);
  }
}
