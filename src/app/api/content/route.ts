import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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

  // Handle Remote Hosts
  if (host.startsWith('remote:')) {
      const alias = host.replace('remote:', '');
      const config = getConfig();
      const hostConfig = config.hosts.find(h => h.alias === alias);

      if (!hostConfig) {
          return NextResponse.json({ error: 'Remote host not found' }, { status: 404 });
      }

      try {
          // Fetch last 2000 lines
          const safeFile = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, ''); 
          const content = await sshExec(hostConfig, `tail -n 2000 /var/log/${safeFile}`);
          return NextResponse.json({ content });
      } catch (error: any) {
          return NextResponse.json({ error: `SSH Read Failed: ${error.message}` }, { status: 500 });
      }
  }

  // Handle System Journal - Fetch Logs
  if (host === '(system-journal)') {
      try {
          let command = 'journalctl -n 200 --no-pager';
          
          if (file !== 'ALL_SYSTEM_LOGS') {
              // file is the service name (e.g. ssh.service)
              // Sanitize input slightly to prevent injection (though only select from list)
              const service = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');
              command += ` -u ${service}`;
          }

          // Execute
          const content = execSync(command, { encoding: 'utf-8' });
          return NextResponse.json({ content: content || "(No logs found for this period)" });
      } catch (error) {
          console.error(error);
          return NextResponse.json({ error: 'Failed to read journal. Permissions?' }, { status: 500 });
      }
  }

  // Security: prevent directory traversal
  if (host.includes('..') || file.includes('..') || host.includes('/') || file.includes('/')) {
     return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const config = getConfig();
  const baseDir = config.general.logPath || path.join(process.cwd(), 'mock-logs');
  const filePath = path.join(baseDir, host, file);
  
  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
