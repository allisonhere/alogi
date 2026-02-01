import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { getConfig } from '@/lib/config';
import { sshExec } from '@/lib/ssh';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');
  const file = searchParams.get('file');

  if (!host || !file) {
    return NextResponse.json({ error: 'Host and file parameters are required' }, { status: 400 });
  }

  const config = getConfig();
  const tailLines = config.general.tailLines || 2000;

  // Handle Remote Hosts
  if (host.startsWith('remote:') || host.startsWith('docker:')) {
      const isDocker = host.startsWith('docker:');
      const alias = host.replace('remote:', '').replace('docker:', '');
      const hostConfig = config.hosts.find(h => h.alias === alias);

      if (!hostConfig) {
          return NextResponse.json({ error: 'Remote host not found' }, { status: 404 });
      }

      try {
          // Sanitize input
          const safeFile = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');

          let command;
          if (isDocker) {
              command = `docker logs --tail ${tailLines} ${safeFile} 2>&1`;
          } else {
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
      try {
          let command = `journalctl -n ${tailLines} --no-pager`;

          if (file !== 'ALL_SYSTEM_LOGS') {
              const service = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');
              command += ` -u ${service}`;
          }

          const content = execSync(command, { encoding: 'utf-8' });
          return NextResponse.json({ content: content || "(No logs found for this period)" });
      } catch (error) {
          console.error(error);
          return NextResponse.json({ error: 'Failed to read journal. Permissions?' }, { status: 500 });
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to read file: ' + message }, { status: 500 });
  }
}
