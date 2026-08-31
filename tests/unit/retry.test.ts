import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';

describe('Exponential Backoff & Retry Module', () => {
  it('should return result immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient failures and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Transient 503'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, jitter: false });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after exceeding max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Persistent DB Error'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10, jitter: false })
    ).rejects.toThrow('Persistent DB Error');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
