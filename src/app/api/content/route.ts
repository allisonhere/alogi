import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { getConfig } from '@/lib/config';
import { sshExec } from '@/lib/ssh';
import { hasSudoPassword, sudoReadFile, sudoExec } from '@/lib/sudo';

export const dynamic = 'force-dynamic';

function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (error as NodeJS.ErrnoException).code === 'EACCES' ||
      msg.includes('permission denied') ||
      msg.includes('eacces');
  }
  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');
  const file = searchParams.get('file');
  const category = searchParams.get('category'); // 'journal' | 'files' | 'docker'

  if (!host || !file) {
    return NextResponse.json({ error: 'Host and file parameters are required' }, { status: 400 });
  }

  const config = getConfig();
  const tailLines = config.general.tailLines || 2000;

  // Handle Remote Hosts - route based on category
  if (host.startsWith('remote:') || host.startsWith('docker:')) {
      // Support legacy docker: prefix for backwards compatibility
      const alias = host.replace('remote:', '').replace('docker:', '');
      const hostConfig = config.hosts.find(h => h.alias === alias);

      if (!hostConfig) {
          return NextResponse.json({ error: 'Remote host not found' }, { status: 404 });
      }

      try {
          // Sanitize input
          const safeFile = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');

          let command;

          // Route based on category
          if (category === 'journal') {
              if (file === 'ALL_SYSTEM_LOGS') {
                  command = `journalctl -n ${tailLines} --no-pager 2>/dev/null`;
              } else {
                  command = `journalctl -n ${tailLines} --no-pager -u ${safeFile} 2>/dev/null`;
              }
          } else if (category === 'docker') {
              if (file === 'ALL_CONTAINERS') {
                  const perContainer = Math.min(500, Math.floor(tailLines / 5));
                  command = `for c in $(docker ps --format '{{.Names}}'); do docker logs --tail ${perContainer} "$c" 2>&1 | sed "s/^/[$c] /"; done`;
              } else {
                  command = `docker logs --tail ${tailLines} ${safeFile} 2>&1`;
              }
          } else {
              // Default: files category (also handles legacy docker: prefix without category)
              command = file.endsWith('.gz')
                ? `zcat /var/log/${safeFile} | tail -n ${tailLines}`
                : `tail -n ${tailLines} /var/log/${safeFile}`;
          }

          const content = await sshExec(hostConfig, command);
          return NextResponse.json({ content });
      } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND') || msg.includes('EHOSTUNREACH') || msg.includes('handshake') || msg.includes('authentication')) {
              return NextResponse.json({ error: `Connection failed: ${msg}` }, { status: 502 });
          }
          return NextResponse.json({ error: `Failed to read remote file: ${msg}` }, { status: 500 });
      }
  }

  // Handle System Journal - Fetch Logs
  if (host === '(system-journal)') {
      let command = `journalctl -n ${tailLines} --no-pager`;

      if (file !== 'ALL_SYSTEM_LOGS') {
          const service = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');
          command += ` -u ${service}`;
      }

      try {
          const content = execSync(command, { encoding: 'utf-8' });
          return NextResponse.json({ content: content || "(No logs found for this period)" });
      } catch (error) {
          if (isPermissionError(error)) {
              if (hasSudoPassword()) {
                  try {
                      const content = sudoExec(command, 'utf-8');
                      return NextResponse.json({ content: content || "(No logs found for this period)" });
                  } catch {
                      // fall through to 403
                  }
              }
              return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
          }
          console.error(error);
          return NextResponse.json({ error: 'Failed to read journal.' }, { status: 500 });
      }
  }

  // Handle Local Files
  if (host.includes('..') || file.includes('..') || host.includes('/') || file.includes('/')) {
     return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const baseDir = config.general.logPath || path.join(process.cwd(), 'mock-logs');
  const filePath = path.join(baseDir, host, file);

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let content;
    if (file.endsWith('.gz')) {
        const buffer = fs.readFileSync(filePath);
        content = zlib.gunzipSync(buffer).toString('utf-8');
    } else {
        content = fs.readFileSync(filePath, 'utf-8');
    }

    return NextResponse.json({ content });
  } catch (error) {
    if (isPermissionError(error)) {
      if (hasSudoPassword()) {
        try {
          const content = sudoReadFile(filePath);
          return NextResponse.json({ content });
        } catch {
          // fall through to 403
        }
      }
      return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to read file: ' + message }, { status: 500 });
  }
}
