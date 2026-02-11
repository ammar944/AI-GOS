// Circuit Breaker Pattern Implementation
// Prevents cascading failures by stopping requests when a service is failing

// =============================================================================
// Types and Interfaces
// =============================================================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 3) */
  failureThreshold: number;
  /** Milliseconds before attempting to close circuit (default: 30000) */
  resetTimeout: number;
  /** Identifier for logging */
  name: string;
}

// =============================================================================
// Custom Error
// =============================================================================

/**
 * Error thrown when circuit breaker is open.
 * Contains information about when retry is allowed.
 */
export class CircuitOpenError extends Error {
  name = "CircuitOpenError" as const;
  circuitName: string;
  nextRetryAt: Date;

  constructor(circuitName: string, nextRetryAt: Date) {
    const retryIn = Math.ceil((nextRetryAt.getTime() - Date.now()) / 1000);
    super(`Circuit breaker '${circuitName}' is open. Retry in ${retryIn}s`);
    this.circuitName = circuitName;
    this.nextRetryAt = nextRetryAt;
  }
}

// =============================================================================
// Circuit Breaker Class
// =============================================================================

/**
 * Circuit Breaker implementation for protecting against cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail immediately without executing
 * - HALF_OPEN: Testing if service recovered, one request allowed
 *
 * Transitions:
 * - CLOSED -> OPEN: When failure count reaches threshold
 * - OPEN -> HALF_OPEN: After resetTimeout expires
 * - HALF_OPEN -> CLOSED: If test request succeeds
 * - HALF_OPEN -> OPEN: If test request fails
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 3,
      resetTimeout: options.resetTimeout ?? 30000,
      name: options.name,
    };
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws CircuitOpenError if circuit is open
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === "OPEN") {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure >= this.options.resetTimeout) {
        this.transitionTo("HALF_OPEN");
      } else {
        // Still in cooldown period - reject immediately
        const nextRetryAt = new Date(this.lastFailureTime + this.options.resetTimeout);
        throw new CircuitOpenError(this.options.name, nextRetryAt);
      }
    }

    try {
      const result = await fn();

      // Success - reset on HALF_OPEN, reset failure count on CLOSED
      if (this.state === "HALF_OPEN") {
        this.transitionTo("CLOSED");
        this.failureCount = 0;
      } else if (this.state === "CLOSED") {
        // Reset failure count on success (consecutive failures reset)
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Force reset the circuit to CLOSED state
   */
  reset(): void {
    const oldState = this.state;
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;

    if (oldState !== "CLOSED") {
      console.log(`[CircuitBreaker:${this.options.name}] State changed: ${oldState} -> CLOSED (forced reset)`);
    }
  }

  /**
   * Record a failure and potentially trip the circuit
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Test request failed - back to OPEN
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED" && this.failureCount >= this.options.failureThreshold) {
      // Threshold reached - trip circuit
      this.transitionTo("OPEN");
    }
  }

  /**
   * Transition to a new state with logging
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      console.log(`[CircuitBreaker:${this.options.name}] State changed: ${this.state} -> ${newState}`);
      this.state = newState;
    }
  }
}
