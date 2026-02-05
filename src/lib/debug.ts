const isDebug = process.env.ALOGI_DEBUG === 'true' || process.env.NODE_ENV === 'development';

export const debug = {
  log: (...args: unknown[]) => {
    if (isDebug) console.log('[alogi]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebug) console.warn('[alogi]', ...args);
  },
  error: (...args: unknown[]) => {
    if (isDebug) console.error('[alogi]', ...args);
  },
};
