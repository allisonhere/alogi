import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlogiConfig } from '../config';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alogi-config-perms-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  vi.resetModules();
  vi.doUnmock('os');
});

function modeOf(filepath: string): number {
  return fs.statSync(filepath).mode & 0o777;
}

describe('saveConfig permissions', () => {
  it('creates config directory and config file with private permissions', async () => {
    vi.resetModules();
    vi.doMock('os', async () => {
      const actual = await vi.importActual<typeof import('os')>('os');
      return {
        ...actual,
        default: {
          ...actual,
          homedir: () => tempDir,
        },
        homedir: () => tempDir,
      };
    });
    const { saveConfig } = await import('../config');
    const partialConfig: Partial<AlogiConfig> = {
      ai: {
        enabled: true,
        provider: 'gemini',
        apiKey: 'secret',
        openaiApiKey: '',
        claudeApiKey: '',
        model: 'gemini-flash-latest',
      },
    };

    saveConfig(partialConfig);

    const configDir = path.join(tempDir, '.config', 'alogi');
    const configFile = path.join(configDir, 'config.json');
    expect(modeOf(configDir)).toBe(0o700);
    expect(modeOf(configFile)).toBe(0o600);
  });
});
