import { execFileSync, spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('release.sh workflow waiting', () => {
  it('dispatches the release workflow when a pushed tag produces no run', () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), 'alogi-release-wait-'));
    const scriptDir = path.join(projectDir, 'scripts');
    const binDir = path.join(projectDir, 'bin');
    const scriptPath = path.join(scriptDir, 'release.sh');
    const ghLog = path.join(projectDir, 'gh.log');
    const ghState = path.join(projectDir, 'dispatched');

    mkdirSync(scriptDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    const source = readFileSync(path.resolve('scripts/release.sh'), 'utf-8')
      .replace(/\n# Run\nmain_menu\s*$/, '\n');
    writeFileSync(scriptPath, source);

    execFileSync('git', ['init', '-q'], { cwd: projectDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: projectDir });
    writeFileSync(path.join(projectDir, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: projectDir });
    execFileSync('git', ['commit', '-q', '-m', 'fixture'], { cwd: projectDir });
    execFileSync('git', ['tag', 'v0.1.63'], { cwd: projectDir });

    const ghPath = path.join(binDir, 'gh');
    writeFileSync(ghPath, `#!/bin/bash
echo "$*" >> "$GH_LOG"
if [ "$1 $2" = "run list" ]; then
  if [ -f "$GH_STATE" ] && [[ " $* " != *" --event push "* ]]; then
    echo "123 completed success"
  fi
  exit 0
fi
if [ "$1 $2" = "workflow run" ]; then
  touch "$GH_STATE"
  exit 0
fi
exit 1
`);
    chmodSync(ghPath, 0o755);

    const sleepPath = path.join(binDir, 'sleep');
    writeFileSync(sleepPath, '#!/bin/bash\nexit 0\n');
    chmodSync(sleepPath, 0o755);

    const result = spawnSync(
      'bash',
      ['-c', `source "${scriptPath}"; PROJECT_DIR="${projectDir}"; wait_for_release_workflow v0.1.63`],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          GH_LOG: ghLog,
          GH_STATE: ghState,
          RELEASE_WORKFLOW_START_TIMEOUT_SECONDS: '1',
          RELEASE_WORKFLOW_TIMEOUT_SECONDS: '3',
          RELEASE_WORKFLOW_POLL_INTERVAL_SECONDS: '1',
        },
      },
    );

    expect(result.status).toBe(0);
    const commands = readFileSync(ghLog, 'utf-8');
    expect(commands).toContain('workflow run release.yml');
    expect(commands).not.toContain('--event push');
  });
});
