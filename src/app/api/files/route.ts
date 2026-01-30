import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getConfig } from '@/lib/config';
import { sshExec } from '@/lib/ssh';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');

  if (!host) {
    return NextResponse.json({ error: 'Host parameter is required' }, { status: 400 });
  }

  // Handle Remote Hosts
  if (host.startsWith('remote:')) {
      const alias = host.replace('remote:', '');
      const config = getConfig();
      const hostConfig = config.hosts.find(h => h.alias === alias);

      if (!hostConfig) {
          return NextResponse.json({ error: 'Remote host not found in config' }, { status: 404 });
      }

      try {
          // List /var/log (simple ls for now, could be improved to find .log files recursively)
          // Using -p to put / at end of dirs
          const stdout = await sshExec(hostConfig, 'ls -p /var/log');
          
          const files = stdout.split('\n')
            .filter(line => line.trim() && !line.endsWith('/')) // Filter dirs for now (simple viewer)
            .map(line => ({
                name: line.trim(),
                size: 0,
                updated: new Date().toISOString() // Unknown without parsing ls -l
            }));
          
          return NextResponse.json({ files });
      } catch (error: any) {
          console.error(error);
          return NextResponse.json({ error: `SSH Connection Failed: ${error.message}` }, { status: 500 });
      }
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

  const config = getConfig();
  const baseDir = config.general.logPath || path.join(process.cwd(), 'mock-logs');
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
