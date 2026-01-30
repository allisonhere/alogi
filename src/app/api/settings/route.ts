import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getConfig, saveConfig } from '@/lib/config';

function resolveHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

export async function GET() {
  const config = getConfig();
  // Mask API key for security if needed, but for local app it's often fine to show it
  // or show it masked.
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (Array.isArray(body?.hosts)) {
      const missingKeys = body.hosts
        .map((host: any) => {
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

      if (missingKeys.length > 0) {
        return NextResponse.json(
          { error: 'SSH private key not found', missingKeys },
          { status: 400 }
        );
      }
    }

    saveConfig(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
