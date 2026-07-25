import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('release.sh RPM packaging', () => {
  it('invokes electron-builder with the RPM target', () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), 'alogi-release-rpm-'));
    const scriptDir = path.join(projectDir, 'scripts');
    const builderDir = path.join(projectDir, 'node_modules', '.bin');
    const scriptPath = path.join(scriptDir, 'release.sh');
    const builderLog = path.join(projectDir, 'electron-builder.log');

    mkdirSync(scriptDir, { recursive: true });
    mkdirSync(builderDir, { recursive: true });

    const source = readFileSync(path.resolve('scripts/release.sh'), 'utf-8')
      .replace(/\n# Run\nmain_menu\s*$/, '\n');
    writeFileSync(scriptPath, source);

    const builderPath = path.join(builderDir, 'electron-builder');
    writeFileSync(builderPath, '#!/bin/bash\nprintf \'%s\\n\' "$*" > "$BUILDER_LOG"\n');
    chmodSync(builderPath, 0o755);

    const result = spawnSync(
      'bash',
      ['-c', `source "${scriptPath}"; PROJECT_DIR="${projectDir}"; DIST_DIR="${projectDir}/dist-electron"; build_rpm`],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        env: { ...process.env, BUILDER_LOG: builderLog },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(builderLog, 'utf-8')).toBe('--linux rpm --publish never\n');
  });
});

describe('release.sh Arch packaging', () => {
  it('runs makepkg in a rootless Podman Arch container', () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), 'alogi-release-arch-'));
    const scriptDir = path.join(projectDir, 'scripts');
    const builderDir = path.join(projectDir, 'node_modules', '.bin');
    const archDir = path.join(projectDir, 'packaging', 'arch');
    const distDir = path.join(projectDir, 'dist-electron');
    const binDir = path.join(projectDir, 'bin');
    const scriptPath = path.join(scriptDir, 'release.sh');
    const podmanLog = path.join(projectDir, 'podman.log');

    mkdirSync(scriptDir, { recursive: true });
    mkdirSync(builderDir, { recursive: true });
    mkdirSync(archDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    const source = readFileSync(path.resolve('scripts/release.sh'), 'utf-8')
      .replace(/\n# Run\nmain_menu\s*$/, '\n');
    writeFileSync(scriptPath, source);
    writeFileSync(path.join(archDir, 'PKGBUILD'), 'pkgver=0.0.0\n');

    const builderPath = path.join(builderDir, 'electron-builder');
    writeFileSync(builderPath, `#!/bin/bash
mkdir -p "$MOCK_PROJECT_DIR/dist-electron/linux-unpacked"
printf 'app\n' > "$MOCK_PROJECT_DIR/dist-electron/linux-unpacked/alogi"
`);
    chmodSync(builderPath, 0o755);

    const podmanPath = path.join(binDir, 'podman');
    writeFileSync(podmanPath, `#!/bin/bash
printf '%s\n' "$*" > "$PODMAN_LOG"
printf 'package\n' > "$MOCK_PROJECT_DIR/packaging/arch/alogi-0.1.71-1-x86_64.pkg.tar.zst"
`);
    chmodSync(podmanPath, 0o755);

    const result = spawnSync(
      'bash',
      [
        '-c',
        `source "${scriptPath}"; PROJECT_DIR="${projectDir}"; ARCH_DIR="${archDir}"; DIST_DIR="${distDir}"; VERSION="0.1.71"; build_arch`,
      ],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          MOCK_PROJECT_DIR: projectDir,
          PODMAN_LOG: podmanLog,
        },
      },
    );

    expect(result.status).toBe(0);
    const command = readFileSync(podmanLog, 'utf-8');
    expect(command).toContain('run --rm --userns=keep-id --user 0 --security-opt label=disable');
    expect(command).toContain(`-v ${projectDir}:/repo`);
    expect(command).toContain('archlinux:latest');
    expect(command).toContain('makepkg -f --noconfirm --needed');
    expect(existsSync(path.join(distDir, 'alogi-0.1.71-1-x86_64.pkg.tar.zst'))).toBe(true);
  });
});
