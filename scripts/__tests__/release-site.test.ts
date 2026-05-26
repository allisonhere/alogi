import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

function createReleaseFixture() {
  const projectDir = mkdtempSync(path.join(tmpdir(), 'alogi-release-site-'));
  const scriptDir = path.join(projectDir, 'scripts');
  const docsDir = path.join(projectDir, 'docs');
  const binDir = path.join(projectDir, 'bin');
  const scriptPath = path.join(scriptDir, 'release.sh');
  const rsyncLog = path.join(projectDir, 'rsync.log');
  const uploadList = path.join(projectDir, 'uploaded-files.log');
  const sourceModeLog = path.join(projectDir, 'source-mode.log');

  mkdirSync(scriptDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  const source = readFileSync(path.resolve('scripts/release.sh'), 'utf-8')
    .replace(/\n# Run\nmain_menu\s*$/, '\n');
  writeFileSync(scriptPath, source);

  writeFileSync(path.join(docsDir, 'v2.html'), '<html>landing page</html>\n');
  writeFileSync(path.join(docsDir, 'logo.svg'), '<svg />\n');
  writeFileSync(path.join(docsDir, 'screenshot.png'), 'image\n');

  const rsyncPath = path.join(binDir, 'rsync');
  writeFileSync(rsyncPath, `#!/bin/bash
printf '%s\n' "$*" > "$RSYNC_LOG"
if [ "\${RSYNC_FAIL:-}" = "1" ]; then
  exit 23
fi
source_dir="\${@: -2:1}"
stat -c '%a' "$source_dir" > "$SOURCE_MODE_LOG"
find "$source_dir" -maxdepth 1 -type f -printf '%f\n' | sort > "$UPLOAD_LIST"
`);
  chmodSync(rsyncPath, 0o755);

  return { projectDir, docsDir, binDir, scriptPath, rsyncLog, uploadList, sourceModeLog };
}

function runPublisher(fixture: ReturnType<typeof createReleaseFixture>, env: Record<string, string> = {}) {
  return spawnSync('bash', ['-c', `source "${fixture.scriptPath}"; PROJECT_DIR="${fixture.projectDir}"; publish_website`], {
    cwd: fixture.projectDir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${fixture.binDir}:${process.env.PATH}`,
      RSYNC_LOG: fixture.rsyncLog,
      UPLOAD_LIST: fixture.uploadList,
      SOURCE_MODE_LOG: fixture.sourceModeLog,
      ...env,
    },
  });
}

describe('release.sh website publishing', () => {
  it('publishes the landing page and assets to alliehere.com without remote deletion', () => {
    const fixture = createReleaseFixture();

    const result = runPublisher(fixture);

    expect(result.status).toBe(0);
    expect(readFileSync(fixture.uploadList, 'utf-8')).toBe('index.html\nlogo.svg\nscreenshot.png\n');
    expect(readFileSync(fixture.sourceModeLog, 'utf-8')).toBe('755\n');
    const command = readFileSync(fixture.rsyncLog, 'utf-8');
    expect(command).toContain('alliehere.com:/home/allieher/www/alogi/');
    expect(command).toContain('--chmod=D755,F644');
    expect(command).not.toContain('--delete');
  });

  it('fails before running rsync when a required website asset is missing', () => {
    const fixture = createReleaseFixture();
    const missingAsset = path.join(fixture.docsDir, 'screenshot.png');
    unlinkSync(missingAsset);

    const result = runPublisher(fixture);

    expect(result.status).not.toBe(0);
    expect(existsSync(fixture.rsyncLog)).toBe(false);
  });

  it('propagates a failed rsync deployment', () => {
    const fixture = createReleaseFixture();

    const result = runPublisher(fixture, { RSYNC_FAIL: '1' });

    expect(result.status).toBe(23);
    expect(result.stdout).toContain('Website publish failed');
  });
});
