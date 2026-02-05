import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getConfig, saveConfig, type AlogiConfig } from '@/lib/config';
import { debug } from '@/lib/debug';

function resolveHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json(config);
  } catch (error) {
    debug.error('Failed to load settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<AlogiConfig>;
    const hosts = body.hosts as Array<Partial<AlogiConfig['hosts'][number]>> | undefined;

    if (Array.isArray(hosts)) {
      const missingKeys = hosts
        .map((host) => {
          const authMethod = host?.authMethod ?? 'key';
          if (authMethod === 'password') {
            return null;
          }
          const keyPathRaw = host?.keyPath || '~/.ssh/id_rsa';
          const keyPath = resolveHome(String(keyPathRaw));
          if (!fs.existsSync(keyPath)) {
            return {
              id: host?.id,
              alias: host?.alias || host?.hostname || 'unknown',
              keyPath: keyPathRaw,
            };
          }
          return null;
        })
        .filter(Boolean);

      const missingPasswords = hosts
        .map((host) => {
          const authMethod = host?.authMethod ?? 'key';
          if (authMethod !== 'password') {
            return null;
          }
          if (!host?.password) {
            return {
              id: host?.id,
              alias: host?.alias || host?.hostname || 'unknown',
            };
          }
          return null;
        })
        .filter(Boolean);

      if (missingKeys.length > 0 || missingPasswords.length > 0) {
        return NextResponse.json(
          { error: 'SSH credentials missing', missingKeys, missingPasswords },
          { status: 400 }
        );
      }
    }

    saveConfig(body);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
