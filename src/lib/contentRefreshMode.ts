export type ContentRefreshMode = 'once' | 'poll' | 'stream';

export function getContentRefreshMode(host: string, isLive: boolean): ContentRefreshMode {
  if (!isLive) return 'once';
  return host.startsWith('remote:') || host.startsWith('docker:') ? 'stream' : 'poll';
}
