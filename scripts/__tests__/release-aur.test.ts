import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

function createFixture() {
  const projectDir = mkdtempSync(path.join(tmpdir(), 'alogi-release-aur-'));
  const scriptDir = path.join(projectDir, 'scripts');
  const binDir = path.join(projectDir, 'bin');
  const scriptPath = path.join(scriptDir, 'release.sh');
  const gitLog = path.join(projectDir, 'git.log');

  mkdirSync(scriptDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  const source = readFileSync(path.resolve('scripts/release.sh'), 'utf-8')
    .replace(/\n# Run\nmain_menu\s*$/, '\n');
  writeFileSync(scriptPath, source);

  const gitPath = path.join(binDir, 'git');
  writeFileSync(gitPath, `#!/bin/bash
printf '%s\n' "$*" >> "$GIT_LOG"
if [ "$1" = "clone" ]; then
  mkdir -p "$3/.git"
fi
`);
  chmodSync(gitPath, 0o755);

  return { projectDir, binDir, scriptPath, gitLog };
}

describe('release.sh AUR checkout', () => {
  it('clones a missing AUR repository inside the project', () => {
    const fixture = createFixture();
    const aurDir = path.join(fixture.projectDir, 'aur-alogi');

    const result = spawnSync(
      'bash',
      ['-c', `source "${fixture.scriptPath}"; PROJECT_DIR="${fixture.projectDir}"; AUR_DIR="${aurDir}"; ensure_aur_repo`],
      {
        cwd: fixture.projectDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH}`,
          GIT_LOG: fixture.gitLog,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(fixture.gitLog, 'utf-8')).toBe(
      `clone ssh://aur@aur.archlinux.org/alogi.git ${aurDir}\n`,
    );
    expect(existsSync(path.join(aurDir, '.git'))).toBe(true);
  });

  it('does not clone again when the AUR repository exists', () => {
    const fixture = createFixture();
    const aurDir = path.join(fixture.projectDir, 'aur-alogi');
    mkdirSync(path.join(aurDir, '.git'), { recursive: true });

    const result = spawnSync(
      'bash',
      ['-c', `source "${fixture.scriptPath}"; PROJECT_DIR="${fixture.projectDir}"; AUR_DIR="${aurDir}"; ensure_aur_repo`],
      {
        cwd: fixture.projectDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH}`,
          GIT_LOG: fixture.gitLog,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(existsSync(fixture.gitLog)).toBe(false);
  });

  it('refuses to overwrite an existing non-repository path', () => {
    const fixture = createFixture();
    const aurDir = path.join(fixture.projectDir, 'aur-alogi');
    mkdirSync(aurDir);

    const result = spawnSync(
      'bash',
      ['-c', `source "${fixture.scriptPath}"; PROJECT_DIR="${fixture.projectDir}"; AUR_DIR="${aurDir}"; ensure_aur_repo`],
      {
        cwd: fixture.projectDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH}`,
          GIT_LOG: fixture.gitLog,
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('exists but is not a Git repository');
    expect(existsSync(fixture.gitLog)).toBe(false);
  });
});
