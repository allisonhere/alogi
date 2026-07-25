import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { debug } from '@/lib/debug';
import { buildCommands } from '@/lib/updateCommands';

type ReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
};

function normalizeVersion(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.trim().replace(/^v/i, '');
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(/[.-]/).map((part) => Number.parseInt(part, 10)).filter(Number.isFinite);
  const bParts = b.split(/[.-]/).map((part) => Number.parseInt(part, 10)).filter(Number.isFinite);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

function hasCommand(command: string): boolean {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function isPacmanPackageInstalled(name: string): boolean {
  const result = spawnSync('pacman', ['-Q', name], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function isRpmPackageInstalled(name: string): boolean {
  const result = spawnSync('rpm', ['-q', name], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function getCurrentVersion(): string {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return normalizeVersion(parsed.version) ?? '0.0.0';
  } catch (error) {
    debug.error('Failed to read package version for update check:', error);
    return '0.0.0';
  }
}

export async function GET() {
  const currentVersion = getCurrentVersion();
  const environment = {
    hasPacman: hasCommand('pacman'),
    hasParu: hasCommand('paru'),
    hasYay: hasCommand('yay'),
    hasDnf: hasCommand('dnf'),
    isAlogiInstalled: false,
  };

  if (environment.hasPacman) {
    environment.isAlogiInstalled = isPacmanPackageInstalled('alogi');
  } else if (environment.hasDnf) {
    environment.isAlogiInstalled = isRpmPackageInstalled('alogi');
  }

  try {
    const response = await fetch('https://api.github.com/repos/allisonhere/alogi/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'alogi-update-check',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`GitHub release lookup failed (${response.status})`);
    }

    const release = await response.json() as GitHubRelease;
    const latestVersion = normalizeVersion(release.tag_name);
    const archAsset = release.assets?.find((asset) => asset.name?.endsWith('.pkg.tar.zst')) ?? null;
    const rpmAsset = release.assets?.find((asset) => asset.name?.endsWith('.rpm')) ?? null;
    const archPackageUrl = archAsset?.browser_download_url ?? null;
    const rpmPackageUrl = rpmAsset?.browser_download_url ?? null;
    const notes = release.body?.trim().slice(0, 1200) ?? null;
    const commands = buildCommands({ archPackageUrl, rpmPackageUrl }, environment);
    const updateAvailable = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;

    return NextResponse.json({
      currentVersion,
      latestVersion,
      updateAvailable,
      publishedAt: release.published_at ?? null,
      releaseUrl: release.html_url ?? null,
      archPackageUrl,
      rpmPackageUrl,
      notes,
      environment,
      commands,
    });
  } catch (error) {
    debug.error('Failed to check updates:', error);
    return NextResponse.json(
      {
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        publishedAt: null,
        releaseUrl: null,
        archPackageUrl: null,
        rpmPackageUrl: null,
        notes: null,
        environment,
        commands: { primary: null, alternatives: [] },
        error: error instanceof Error ? error.message : 'Failed to check updates',
      },
      { status: 502 }
    );
  }
}
