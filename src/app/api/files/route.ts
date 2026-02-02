import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getConfig } from '@/lib/config';
import { sshExec } from '@/lib/ssh';
import { hasSudoPassword, sudoExec } from '@/lib/sudo';

function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (error as NodeJS.ErrnoException).code === 'EACCES' ||
      msg.includes('permission denied') ||
      msg.includes('eacces');
  }
  return false;
}

function parseLsOutput(stdout: string) {
  return stdout.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(/\s+/);
      // ls -la output: perms links owner group size month day time name
      if (parts.length >= 9) {
        const name = parts.slice(8).join(' ');
        const size = parseInt(parts[4], 10) || 0;
        // skip directories (perms start with 'd') and special entries
        if (parts[0].startsWith('d') || name === '.' || name === '..') return null;
        return { name, size, updated: new Date().toISOString() };
      }
      return null;
    })
    .filter(Boolean);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');

  if (!host) {
    return NextResponse.json({ error: 'Host parameter is required' }, { status: 400 });
  }

  // Handle Remote Hosts (Files or Docker)
  if (host.startsWith('remote:') || host.startsWith('docker:')) {
      const isDocker = host.startsWith('docker:');
      const alias = host.replace('remote:', '').replace('docker:', '');
      const config = getConfig();
      const hostConfig = config.hosts.find(h => h.alias === alias);

      if (!hostConfig) {
          return NextResponse.json({ error: 'Remote host not found in config' }, { status: 404 });
      }

      try {
          if (isDocker) {
              // List running containers using docker ps
              const stdout = await sshExec(hostConfig, 'docker ps --format "{{.Names}}\t{{.Status}}"');
              const files = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [name, status] = line.split('\t');
                    return {
                        name: name.trim(),
                        size: 0,
                        updated: status.trim() // Display status (e.g. "Up 2 hours") instead of date
                    };
                });
              files.unshift({ name: 'ALL_CONTAINERS', size: 0, updated: 'All running containers' });
              return NextResponse.json({ files });
          } else {
              // Standard File List (ls)
              const stdout = await sshExec(hostConfig, 'ls -p /var/log');
              const files = stdout.split('\n')
                .filter(line => line.trim() && !line.endsWith('/'))
                .map(line => ({
                    name: line.trim(),
                    size: 0,
                    updated: new Date().toISOString()
                }));
              return NextResponse.json({ files });
          }
      } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(message);
          return NextResponse.json({ error: `SSH Connection Failed: ${message}` }, { status: 500 });
      }
  }

  // Handle System Journal - List Services
  if (host === '(system-journal)') {
      const command = 'systemctl list-units --type=service --state=running --no-legend --plain';
      try {
          const stdout = execSync(command, { encoding: 'utf-8' });
          const files = stdout.split('\n')
              .filter(line => line.trim())
              .map(line => {
                  const parts = line.split(/\s+/);
                  return {
                      name: parts[0],
                      size: 0,
                      updated: new Date().toISOString()
                  };
              });

          files.unshift({ name: 'ALL_SYSTEM_LOGS', size: 0, updated: new Date().toISOString() });
          return NextResponse.json({ files });
      } catch (error) {
          if (isPermissionError(error)) {
              if (hasSudoPassword()) {
                  try {
                      const stdout = sudoExec(command, 'utf-8');
                      const files = stdout.split('\n')
                          .filter(line => line.trim())
                          .map(line => {
                              const parts = line.split(/\s+/);
                              return { name: parts[0], size: 0, updated: new Date().toISOString() };
                          });
                      files.unshift({ name: 'ALL_SYSTEM_LOGS', size: 0, updated: new Date().toISOString() });
                      return NextResponse.json({ files });
                  } catch {
                      // fall through
                  }
              }
              return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
          }
          return NextResponse.json({ error: 'Failed to list services.' }, { status: 500 });
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
    if (isPermissionError(error)) {
      if (hasSudoPassword()) {
        try {
          const stdout = sudoExec(`ls -la '${hostDir.replace(/'/g, "'\\''")}'`, 'utf-8');
          const files = parseLsOutput(stdout);
          return NextResponse.json({ files });
        } catch {
          // fall through
        }
      }
      return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to read files' }, { status: 500 });
  }
}
