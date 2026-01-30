import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/lib/config';

export async function GET() {
  const config = getConfig(); // Load config
  const logsDir = config.general.logPath; // Use config path instead of env if available
  
  try {
    let hosts: string[] = [];

    // 1. System Journal
    hosts.push('(system-journal)');

    // 2. Remote Hosts
    if (config.hosts && config.hosts.length > 0) {
        config.hosts.forEach(h => {
            const prefix = h.type === 'docker' ? 'docker:' : 'remote:';
            hosts.push(`${prefix}${h.alias}`);
        });
    }

    // 3. Local Folders
    if (fs.existsSync(logsDir)) {
        const items = fs.readdirSync(logsDir, { withFileTypes: true });
        const localHosts = items
        .filter(item => item.isDirectory())
        .map(item => item.name);
        hosts = hosts.concat(localHosts);
    }

    return NextResponse.json({ hosts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read hosts' }, { status: 500 });
  }
}
