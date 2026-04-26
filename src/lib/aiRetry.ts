type RetryableError = {
  message?: string;
  status?: number;
};

const defaultDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(error: unknown): boolean {
  const err = error as RetryableError;
  const message = typeof err?.message === 'string' ? err.message : '';
  return err?.status === 429 || message.includes('429');
}

export async function retryRateLimited<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    delay?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 5000;
  const delay = options.delay ?? defaultDelay;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error;
      }
      await delay(attempt * baseDelayMs);
    }
  }

  throw lastError ?? new Error('Rate limited after multiple retries');
}
