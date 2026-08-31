import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  factor: 2,
  jitter: true,
  shouldRetry: (error: unknown) => {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const status = (error as { statusCode?: number }).statusCode;
      // Do not retry 4xx errors except 429
      if (status && status >= 400 && status < 500 && status !== 429) {
        return false;
      }
    }
    return true;
  },
};

/**
 * Executes an async function with exponential backoff and jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  operationName: string = 'operation'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error) {
      if (attempt > opts.maxRetries || !opts.shouldRetry(error)) {
        logger.warn(
          { operation: operationName, attempt, maxRetries: opts.maxRetries, error: (error as Error).message },
          `Operation failed permanently after ${attempt} attempts`
        );
        throw error;
      }

      // Calculate exponential delay
      let delay = opts.baseDelayMs * Math.pow(opts.factor, attempt - 1);
      delay = Math.min(delay, opts.maxDelayMs);

      if (opts.jitter) {
        // Full jitter: random between 0 and delay
        delay = Math.floor(Math.random() * delay);
      }

      logger.info(
        { operation: operationName, attempt, nextDelayMs: delay, error: (error as Error).message },
        `Transient failure in ${operationName}, retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
