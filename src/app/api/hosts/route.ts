import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const logsDir = process.env.LOG_ROOT_DIR || path.join(process.cwd(), 'mock-logs');
  
  try {
    if (!fs.existsSync(logsDir)) {
      return NextResponse.json({ hosts: [] });
    }

    const items = fs.readdirSync(logsDir, { withFileTypes: true });
    const hosts = items
      .filter(item => item.isDirectory())
      .map(item => item.name);

    // Add virtual host for System Journal
    hosts.unshift('(system-journal)');

    return NextResponse.json({ hosts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read hosts' }, { status: 500 });
  }
}
