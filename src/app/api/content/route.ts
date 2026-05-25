import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getConfig } from '@/lib/config';
import { sshExec, sshStream, SSHStreamHandle } from '@/lib/ssh';
import { LogContentTooLargeError, readLocalLogContent } from '@/lib/logReader';
import { hasSudoPassword, sudoJournalctl, sudoReadLogTail } from '@/lib/sudo';
import { debug } from '@/lib/debug';
import { resolveContainedPath, UnsafePathError } from '@/lib/pathSafety';

export const dynamic = 'force-dynamic';

function remoteContentCommand(file: string, category: string | null, tailLines: number, follow = false): string {
  const safeFile = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');
  const followFlag = follow ? ' -f' : '';

  if (category === 'journal') {
    if (file === 'ALL_SYSTEM_LOGS') {
      return `journalctl -n ${tailLines} --no-pager${followFlag} 2>/dev/null`;
    }
    return `journalctl -n ${tailLines} --no-pager${followFlag} -u ${safeFile} 2>/dev/null`;
  }

  if (category === 'docker') {
    const followDocker = follow ? ' -f' : '';
    if (file === 'ALL_CONTAINERS') {
      const perContainer = Math.min(500, Math.floor(tailLines / 5));
      if (follow) {
        return `for c in $(docker ps --format '{{.Names}}'); do docker logs --tail ${perContainer} -f "$c" 2>&1 | sed "s/^/[$c] /" & done; wait`;
      }
      return `for c in $(docker ps --format '{{.Names}}'); do docker logs --tail ${perContainer} "$c" 2>&1 | sed "s/^/[$c] /"; done`;
    }
    return `docker logs --tail ${tailLines}${followDocker} ${safeFile} 2>&1`;
  }

  if (file.endsWith('.gz')) {
    return `zcat /var/log/${safeFile} | tail -n ${tailLines}`;
  }
  return follow
    ? `tail -n ${tailLines} -F /var/log/${safeFile}`
    : `tail -n ${tailLines} /var/log/${safeFile}`;
}

function sseEncode(event: string, data: unknown): string {
  const encoded = JSON.stringify(data);
  return `event: ${event}\ndata: ${encoded}\n\n`;
}

function streamRemoteContent(hostConfig: Parameters<typeof sshStream>[0], command: string, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  let handle: SSHStreamHandle | null = null;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const clearHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendRaw = (data: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(data));
      };
      const send = (event: string, data: unknown) => {
        sendRaw(sseEncode(event, data));
      };
      const close = (closeRemote = true) => {
        if (closed) return;
        closed = true;
        clearHeartbeat();
        if (closeRemote) handle?.close();
        controller.close();
      };

      // If the remote follow command exits, browsers will normally reconnect
      // EventSource after ~2s. Use a long retry as a safety net, and send a
      // terminal event below so the client closes intentionally instead of
      // reconnecting in a loop that creates new SSH logins.
      sendRaw('retry: 60000\n\n');
      heartbeat = setInterval(() => sendRaw(': keep-alive\n\n'), 15_000);
      const finish = (event: string, data: unknown, closeRemote = true) => {
        send(event, data);
        close(closeRemote);
      };

      signal.addEventListener('abort', () => close(), { once: true });
      sshStream(hostConfig, command, {
        onData: chunk => send('chunk', chunk),
        onError: error => finish('fatal', error.message),
        onClose: (code, signal) => finish('done', { code, signal }, false),
      }).then((nextHandle) => {
        handle = nextHandle;
        if (closed) nextHandle.close();
      }).catch((error) => {
        finish('fatal', error instanceof Error ? error.message : String(error), false);
      });
    },
    cancel() {
      closed = true;
      clearHeartbeat();
      handle?.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

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
  const live = searchParams.get('live') === '1';

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
          const command = remoteContentCommand(file, category, tailLines, live);
          if (live) {
              return streamRemoteContent(hostConfig, command, request.signal);
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
      const journalArgs = ['-n', String(tailLines), '--no-pager'];

      if (file !== 'ALL_SYSTEM_LOGS') {
          const service = file.replace(/[^a-zA-Z0-9\.\-\_\@]/g, '');
          command += ` -u ${service}`;
          journalArgs.push('-u', service);
      }

      try {
          const content = execSync(command, { encoding: 'utf-8' });
          return NextResponse.json({ content: content || "(No logs found for this period)" });
      } catch (error) {
          if (isPermissionError(error)) {
              if (hasSudoPassword()) {
                  try {
                      const content = sudoJournalctl(journalArgs);
                      return NextResponse.json({ content: content || "(No logs found for this period)" });
                  } catch {
                      // fall through to 403
                  }
              }
              return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
          }
          debug.error(error);
          return NextResponse.json({ error: 'Failed to read journal.' }, { status: 500 });
      }
  }

  // Handle Local Files
  const baseDir = config.general.logPath || path.join(process.cwd(), 'mock-logs');
  let filePath = '';

  try {
    filePath = resolveContainedPath(baseDir, host, file);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = readLocalLogContent(filePath, tailLines);

    return NextResponse.json({ content });
  } catch (error) {
    if (isPermissionError(error)) {
      if (hasSudoPassword()) {
        try {
          const content = sudoReadLogTail(filePath, tailLines);
          return NextResponse.json({ content });
        } catch {
          // fall through to 403
        }
      }
      return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
    }
    if (error instanceof LogContentTooLargeError) {
      return NextResponse.json(
        { error: 'Compressed log is too large to decompress safely. Use a smaller rotated log or read it remotely with tail.' },
        { status: 413 }
      );
    }
    if (error instanceof UnsafePathError) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to read file: ' + message }, { status: 500 });
  }
}
