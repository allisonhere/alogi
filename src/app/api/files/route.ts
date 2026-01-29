import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');

  if (!host) {
    return NextResponse.json({ error: 'Host parameter is required' }, { status: 400 });
  }

  // Handle System Journal - List Services
  if (host === '(system-journal)') {
      try {
          const stdout = execSync('systemctl list-units --type=service --state=running --no-legend --plain', { encoding: 'utf-8' });
          const files = stdout.split('\n')
              .filter(line => line.trim())
              .map(line => {
                  const parts = line.split(/\s+/);
                  return {
                      name: parts[0], // service name (e.g., ssh.service)
                      size: 0,        // Virtual
                      updated: new Date().toISOString()
                  };
              });
          
          // Add a "Complete System Log" option
          files.unshift({ name: 'ALL_SYSTEM_LOGS', size: 0, updated: new Date().toISOString() });

          return NextResponse.json({ files });
      } catch (error) {
          return NextResponse.json({ error: 'Failed to list services. Do you have permissions?' }, { status: 500 });
      }
  }

  // Security: prevent directory traversal
  if (host.includes('..') || host.includes('/')) {
     return NextResponse.json({ error: 'Invalid host' }, { status: 400 });
  }

  const baseDir = process.env.LOG_ROOT_DIR || path.join(process.cwd(), 'mock-logs');
  const hostDir = path.join(baseDir, host);
  
  try {
    if (!fs.existsSync(hostDir)) {
      return NextResponse.json({ error: 'Host not found' }, { status: 404 });
    }

    const items = fs.readdirSync(hostDir, { withFileTypes: true });
    const files = items
      .filter(item => item.isFile())
      .map(item => ({
        name: item.name,
        size: fs.statSync(path.join(hostDir, item.name)).size,
        updated: fs.statSync(path.join(hostDir, item.name)).mtime
      }));

    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read files' }, { status: 500 });
  }
}
