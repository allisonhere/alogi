import { describe, expect, it, vi } from 'vitest';
import { retryRateLimited } from '../aiRetry';

describe('retryRateLimited', () => {
  it('retries 429 failures with linear backoff and returns the successful result', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ status: 429, message: 'rate limited' })
      .mockRejectedValueOnce(new Error('429 too many requests'))
      .mockResolvedValue('ok');
    const delay = vi.fn(async () => {});

    await expect(retryRateLimited(operation, { delay })).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 5000);
    expect(delay).toHaveBeenNthCalledWith(2, 10000);
  });

  it('does not retry non-rate-limit failures', async () => {
    const error = new Error('bad request');
    const operation = vi.fn().mockRejectedValue(error);
    const delay = vi.fn(async () => {});

    await expect(retryRateLimited(operation, { delay })).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});
