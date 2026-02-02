import { execSync } from 'child_process';

let cachedPassword: string | null = null;

export function setSudoPassword(pw: string) {
  cachedPassword = pw;
}

export function clearSudoPassword() {
  cachedPassword = null;
}

export function hasSudoPassword(): boolean {
  return cachedPassword !== null;
}

export function sudoExec(command: string, encoding: BufferEncoding = 'utf-8'): string {
  if (!cachedPassword) throw new Error('No sudo password cached');
  return execSync(`sudo -S ${command}`, {
    input: cachedPassword + '\n',
    encoding,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function sudoReadFile(filePath: string): string {
  const safePath = filePath.replace(/'/g, "'\\''");
  return sudoExec(`cat '${safePath}'`);
}

export function validateSudoPassword(password: string): boolean {
  try {
    execSync('sudo -S -v', {
      input: password + '\n',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
