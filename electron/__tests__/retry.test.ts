import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { loadUrlWithRetry } = require('../retry.cjs') as {
  loadUrlWithRetry: (
    win: { loadURL: (url: string) => Promise<void> },
    url: string,
    retries?: number,
    retryDelay?: number,
    delayFn?: (ms: number) => Promise<void>,
  ) => Promise<void>;
};

describe('loadUrlWithRetry', () => {
  it('rethrows the original loadURL error after the final retry', async () => {
    const originalError = new Error('server never became ready');
    const win = {
      loadURL: async () => {
        throw originalError;
      },
    };

    await expect(
      loadUrlWithRetry(win, 'http://127.0.0.1:3000', 2, 0, async () => {})
    ).rejects.toBe(originalError);
  });
});
