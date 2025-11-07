/**
 * Retry mechanism for external API calls
 * Handles transient failures with exponential backoff
 */

import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  delayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: (error: any) => {
    // Retry on network errors and 5xx status codes
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response?.status >= 500 && error.response?.status < 600) {
      return true;
    }
    // Retry on 429 (Rate Limit)
    if (error.response?.status === 429) {
      return true;
    }
    return false;
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.delayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = opts.retryableErrors(error);

      // Don't retry if not retryable or if this was the last attempt
      if (!isRetryable || attempt >= opts.maxAttempts) {
        throw error;
      }

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt}/${opts.maxAttempts}`, {
        attempt,
        maxAttempts: opts.maxAttempts,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt, error);
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for fetch requests
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);

      // Throw on error status to trigger retry
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.response = response;
        throw error;
      }

      return response;
    },
    {
      ...options,
      retryableErrors: (error: any) => {
        // Custom retryable check for fetch errors
        if (error.response?.status >= 500 && error.response?.status < 600) {
          return true;
        }
        if (error.response?.status === 429) {
          return true;
        }
        // Network errors
        if (error.name === 'TypeError' || error.name === 'NetworkError') {
          return true;
        }
        // Custom check from options
        if (options?.retryableErrors) {
          return options.retryableErrors(error);
        }
        return false;
      },
    }
  );
}

/**
 * Circuit breaker pattern to prevent cascading failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeout) {
        // Try to recover
        this.state = 'half-open';
        logger.info('Circuit breaker entering half-open state');
      } else {
        const error = new Error('Circuit breaker is open');
        logger.error('Circuit breaker rejected request', error);
        throw error;
      }
    }

    try {
      const result = await fn();

      // Success - reset if in half-open state
      if (this.state === 'half-open') {
        this.reset();
        logger.info('Circuit breaker recovered, returning to closed state');
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      logger.error('Circuit breaker opened due to failures', {
        failureCount: this.failureCount,
        threshold: this.threshold,
      });
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }

  getState(): string {
    return this.state;
  }
}
