import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('patch-standalone.sh', () => {
  it('copies public assets into the standalone server root', () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), 'alogi-standalone-'));
    const scriptDir = path.join(projectDir, 'scripts');
    const scriptPath = path.join(scriptDir, 'patch-standalone.sh');

    mkdirSync(scriptDir, { recursive: true });
    copyFileSync(path.resolve('scripts/patch-standalone.sh'), scriptPath);

    mkdirSync(path.join(projectDir, 'node_modules', 'next'), { recursive: true });
    writeFileSync(path.join(projectDir, 'node_modules', 'next', 'package.json'), '{"name":"next"}');

    mkdirSync(path.join(projectDir, '.next', 'standalone', 'node_modules', 'next'), { recursive: true });
    mkdirSync(path.join(projectDir, 'public'), { recursive: true });
    writeFileSync(path.join(projectDir, 'public', 'logo.svg'), '<svg />');

    execFileSync('bash', [scriptPath], { cwd: projectDir, stdio: 'pipe' });

    expect(existsSync(path.join(projectDir, '.next', 'standalone', 'public', 'logo.svg'))).toBe(true);
  });
});
