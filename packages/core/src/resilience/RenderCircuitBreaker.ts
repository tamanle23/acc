import { Logger } from '../logger';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal healthy operation
  OPEN = 'OPEN',         // Breaker tripped; fast-fail / fallback active
  HALF_OPEN = 'HALF_OPEN', // Probing canary request
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;     // Number of failures before opening (default: 3)
  recoveryTimeoutMs?: number;    // Wait time before entering HALF_OPEN (default: 10000ms)
  timeoutMs?: number;            // Execution timeout per attempt (default: 5000ms)
}

/**
 * RenderCircuitBreaker:
 * Fault tolerance circuit breaker providing deterministic fallback cascading for
 * neural AI inference sidecars, hardware encoders, and I/O tasks.
 */
export class RenderCircuitBreaker {
  private name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private failureThreshold: number;
  private recoveryTimeoutMs: number;
  private timeoutMs: number;
  private nextAttemptTime: number = 0;

  public constructor(name: string, config: CircuitBreakerConfig = {}) {
    this.name = name;
    this.failureThreshold = config.failureThreshold ?? 3;
    this.recoveryTimeoutMs = config.recoveryTimeoutMs ?? 10000;
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  public getState(): CircuitState {
    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
      this.state = CircuitState.HALF_OPEN;
      Logger.info('RenderCircuitBreaker', `Circuit [${this.name}] transitioned to HALF_OPEN (probing...)`);
    }
    return this.state;
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Executes primary task protected by the circuit breaker with automatic fallback on failure.
   */
  public async execute<T>(
    primaryFn: () => Promise<T>,
    fallbackFn?: (err: Error) => Promise<T> | T
  ): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      const openErr = new Error(`Circuit [${this.name}] is OPEN. Fast-failing to fallback.`);
      Logger.warn('RenderCircuitBreaker', openErr.message);
      if (fallbackFn) {
        return await fallbackFn(openErr);
      }
      throw openErr;
    }

    try {
      // Execute primary with timeout protection
      const result = await Promise.race([
        primaryFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timed out in circuit [${this.name}] after ${this.timeoutMs}ms`)), this.timeoutMs)
        ),
      ]);

      // Success restores closed state
      if (this.state === CircuitState.HALF_OPEN) {
        Logger.info('RenderCircuitBreaker', `Circuit [${this.name}] recovered! Resetting to CLOSED.`);
      }
      this.reset();
      return result;
    } catch (err: any) {
      this.failureCount++;
      Logger.warn(
        'RenderCircuitBreaker',
        `Failure in [${this.name}] (${this.failureCount}/${this.failureThreshold}): ${err.message}`
      );

      if (this.failureCount >= this.failureThreshold || this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.recoveryTimeoutMs;
        Logger.error('RenderCircuitBreaker', `Circuit [${this.name}] TRIPPED to OPEN for ${this.recoveryTimeoutMs}ms`);
      }

      if (fallbackFn) {
        Logger.info('RenderCircuitBreaker', `Executing fallback strategy for [${this.name}]`);
        return await fallbackFn(err);
      }
      throw err;
    }
  }
}
