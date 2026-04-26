import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(() => 'ok'),
  execSync: vi.fn(() => 'ok'),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const mocked = {
    ...actual,
    execFileSync: mocks.execFileSync,
    execSync: mocks.execSync,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

describe('sudo credential handling', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const sudo = await import('../sudo');
    sudo.clearSudoPassword();
  });

  it('expires cached sudo password after five minutes', async () => {
    const sudo = await import('../sudo');

    sudo.setSudoPassword('secret');
    expect(sudo.hasSudoPassword()).toBe(true);

    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(sudo.hasSudoPassword()).toBe(false);
  });

  it('refreshes the expiration timer when password is set again', async () => {
    const sudo = await import('../sudo');

    sudo.setSudoPassword('first');
    vi.advanceTimersByTime(4 * 60 * 1000);
    sudo.setSudoPassword('second');
    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(sudo.hasSudoPassword()).toBe(true);

    vi.advanceTimersByTime(60 * 1000);

    expect(sudo.hasSudoPassword()).toBe(false);
  });

  it('passes sudo command and user arguments without shell interpolation', async () => {
    const sudo = await import('../sudo');
    const filePath = "/tmp/alogi logs/odd'name.log";

    sudo.setSudoPassword('secret');
    sudo.sudoReadLogTail(filePath, 25);

    expect(mocks.execFileSync).toHaveBeenCalledWith(
      'sudo',
      ['-S', 'tail', '-n', '25', filePath],
      expect.objectContaining({
        input: 'secret\n',
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
  });
});
