import { execFileSync } from 'child_process';
import { LogContentTooLargeError, tailLogText } from './logReader';

const SUDO_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

let cachedPassword: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpiryTimer() {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

export function setSudoPassword(pw: string) {
  cachedPassword = pw;
  clearExpiryTimer();
  clearTimer = setTimeout(() => {
    clearSudoPassword();
  }, SUDO_TTL_MS);
}

export function clearSudoPassword() {
  cachedPassword = null;
  clearExpiryTimer();
}

export function hasSudoPassword(): boolean {
  return cachedPassword !== null;
}

export function sudoExecFile(
  command: string,
  args: string[],
  options: { encoding?: BufferEncoding; maxBuffer?: number } = {},
): string {
  if (!cachedPassword) throw new Error('No sudo password cached');
  return execFileSync('sudo', ['-S', command, ...args], {
    input: cachedPassword + '\n',
    encoding: options.encoding ?? 'utf-8',
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function sudoJournalctl(args: string[]): string {
  return sudoExecFile('journalctl', args);
}

export function sudoSystemctl(args: string[]): string {
  return sudoExecFile('systemctl', args);
}

export function sudoReadFile(filePath: string): string {
  return sudoExecFile('cat', [filePath]);
}

export function sudoReadLogTail(filePath: string, tailLines: number): string {
  const safeTailLines = Math.max(1, Math.floor(tailLines));
  if (!filePath.endsWith('.gz')) {
    return sudoExecFile('tail', ['-n', String(safeTailLines), filePath]);
  }

  try {
    const content = sudoExecFile('gzip', ['-cd', filePath], { maxBuffer: DEFAULT_MAX_BUFFER });
    return tailLogText(content, safeTailLines);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('maxBuffer')) {
      throw new LogContentTooLargeError();
    }
    throw error;
  }
}

export function sudoListDirectoryFiles(dirPath: string): string {
  return sudoExecFile('find', [dirPath, '-maxdepth', '1', '-type', 'f', '-printf', '%f\t%s\n']);
}

export function validateSudoPassword(password: string): boolean {
  try {
    execFileSync('sudo', ['-S', '-v'], {
      input: password + '\n',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
