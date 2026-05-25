import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { debug } from './debug';

export interface SSHHostConfig {
  hostname: string;
  username: string;
  port?: number;
  keyPath?: string;
  password?: string;
  authMethod?: 'key' | 'password';
}

export interface SSHExecOptions {
  commandTimeoutMs?: number;
}

export interface SSHStreamOptions {
  onData: (chunk: string) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number | null, signal: string | null) => void;
}

export interface SSHStreamHandle {
  close: () => void;
}

function resolveHome(filepath: string): string {
    if (filepath.startsWith('~')) {
        return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
}

const EXEC_TIMEOUT    = 30_000;
const READY_TIMEOUT   = 10_000;
const IDLE_TIMEOUT    = 60_000; // close idle connections after 60 s
const KEEPALIVE_MS    =  5_000; // SSH keepalive ping interval

// ─── Connection pool ────────────────────────────────────────────────────────

interface PoolEntry {
  client: Client;
  /** Non-null while the TCP+SSH handshake is still in progress. */
  connecting: Promise<Client> | null;
  /** Serializes exec channels so remotes with low MaxSessions do not flap. */
  queue: Promise<void>;
  /** Number of persistent stream channels currently held open. */
  activeStreams: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

// Use globalThis so the pool survives Next.js hot-module replacement and
// is shared across all route bundles in the standalone build (each route
// can get its own module instance of this file, but they all share one process).
declare global {
  var __alogiSshPool: Map<string, PoolEntry> | undefined;
}

const connectionPool: Map<string, PoolEntry> =
  globalThis.__alogiSshPool ?? (globalThis.__alogiSshPool = new Map());

function poolKey(config: SSHHostConfig): string {
  return `${config.username}@${config.hostname}:${config.port ?? 22}:${config.authMethod ?? 'key'}:${config.keyPath ?? ''}`;
}

function evict(key: string): void {
  const entry = connectionPool.get(key);
  if (!entry) return;
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  connectionPool.delete(key);
  try { entry.client.end(); } catch { /* already gone */ }
  debug.log(`SSH pool: evicted ${key}`);
}

function refreshIdle(key: string, entry: PoolEntry): void {
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.idleTimer = null;
  if (entry.activeStreams > 0) return;
  entry.idleTimer = setTimeout(() => evict(key), IDLE_TIMEOUT);
}

/**
 * Opens a new SSH connection, updates the pool entry when ready,
 * and resolves with the connected Client.
 */
function openConnection(config: SSHHostConfig, key: string): Promise<Client> {
  const usePassword = config.authMethod === 'password';
  let privateKey: Buffer | undefined;

  if (!usePassword) {
    const keyPath = resolveHome(config.keyPath || '~/.ssh/id_rsa');
    try {
      privateKey = fs.readFileSync(keyPath);
    } catch {
      connectionPool.delete(key);
      return Promise.reject(new Error(`Private key not found at ${keyPath}`));
    }
  } else if (!config.password) {
    connectionPool.delete(key);
    return Promise.reject(new Error('SSH password not provided'));
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const readyTimer = setTimeout(() => {
      connectionPool.delete(key);
      try { (conn as unknown as { destroy(): void }).destroy(); } catch { /* ignore */ }
      reject(new Error(`SSH connection timed out after ${READY_TIMEOUT / 1000}s`));
    }, READY_TIMEOUT);

    conn
      .on('ready', () => {
        clearTimeout(readyTimer);
        const idleTimer = setTimeout(() => evict(key), IDLE_TIMEOUT);
        connectionPool.set(key, { client: conn, connecting: null, queue: Promise.resolve(), activeStreams: 0, idleTimer });
        debug.log(`SSH pool: connected ${key}`);
        resolve(conn);
      })
      .on('error', (err) => {
        clearTimeout(readyTimer);
        connectionPool.delete(key);
        reject(err);
      })
      .on('close', () => {
        debug.log(`SSH pool: connection closed ${key}`);
        connectionPool.delete(key);
      })
      .connect({
        host: config.hostname,
        port: config.port || 22,
        username: config.username,
        privateKey,
        password: usePassword ? config.password : undefined,
        readyTimeout: READY_TIMEOUT,
        keepaliveInterval: KEEPALIVE_MS,
        keepaliveCountMax: 3,
      });
  });
}

/**
 * Returns the pooled connection for this host, creating one if needed.
 * Concurrent callers during an in-progress handshake all await the same
 * promise rather than each opening a new connection.
 */
function getConnection(config: SSHHostConfig): Promise<Client> {
  const key = poolKey(config);
  const entry = connectionPool.get(key);

  if (entry) {
    refreshIdle(key, entry);
    if (entry.connecting) return entry.connecting; // share in-flight handshake
    return Promise.resolve(entry.client);
  }

  const connecting = openConnection(config, key);
  connectionPool.set(key, { client: null as unknown as Client, connecting, queue: Promise.resolve(), activeStreams: 0, idleTimer: null });
  return connecting;
}

// ─── Public API ─────────────────────────────────────────────────────────────

function execOnConnection(conn: Client, command: string, commandTimeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = (fn: typeof resolve | typeof reject, value: string | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      (fn as (v: string | Error) => void)(value);
    };

    const timer = setTimeout(
      () => settle(reject, new Error(`SSH command timed out after ${commandTimeoutMs / 1000}s`)),
      commandTimeoutMs,
    );

    conn.exec(command, (err, stream) => {
      if (err) { settle(reject, err); return; }

      let stdout = '';
      let stderr = '';

      stream
        .on('close', (code: number | null, signal: string | null) => {
          if (code !== 0) {
            const signalInfo = signal ? ` (signal: ${signal})` : '';
            const detail =
              stderr.trim() ||
              stdout.trim() ||
              `SSH command exited with code ${code ?? 'unknown'}${signalInfo}`;
            debug.warn(`SSH command failed (exit ${code}${signalInfo}): ${detail}`);
            settle(reject, new Error(detail));
            return;
          }
          settle(resolve, stdout);
        })
        .on('data', (data: Buffer) => { stdout += data.toString(); })
        .stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    });
  });
}

export function sshExec(
  config: SSHHostConfig,
  command: string,
  options: SSHExecOptions = {},
): Promise<string> {
  const commandTimeoutMs = options.commandTimeoutMs ?? EXEC_TIMEOUT;
  const key = poolKey(config);

  return getConnection(config).then((conn) => {
    const entry = connectionPool.get(key);
    if (!entry) return execOnConnection(conn, command, commandTimeoutMs);

    const run = entry.queue.then(async () => {
      refreshIdle(key, entry);
      const output = await execOnConnection(conn, command, commandTimeoutMs);
      refreshIdle(key, entry);
      return output;
    });
    entry.queue = run.then(() => undefined, () => undefined);
    return run;
  });
}

export function sshStream(
  config: SSHHostConfig,
  command: string,
  options: SSHStreamOptions,
): Promise<SSHStreamHandle> {
  const key = poolKey(config);

  return getConnection(config).then((conn) => new Promise<SSHStreamHandle>((resolve, reject) => {
    const entry = connectionPool.get(key);
    if (entry) {
      entry.activeStreams += 1;
      if (entry.idleTimer) clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }

    conn.exec(command, (err, stream) => {
      if (err) {
        if (entry) {
          entry.activeStreams = Math.max(0, entry.activeStreams - 1);
          refreshIdle(key, entry);
        }
        reject(err);
        return;
      }

      let closedByCaller = false;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        if (entry) {
          entry.activeStreams = Math.max(0, entry.activeStreams - 1);
          refreshIdle(key, entry);
        }
      };
      const close = () => {
        if (closedByCaller) return;
        closedByCaller = true;
        release();
        try {
          const closable = stream as unknown as { close?: () => void; destroy?: () => void };
          if (typeof closable.close === 'function') closable.close();
          else if (typeof closable.destroy === 'function') closable.destroy();
        } catch { /* already closed */ }
      };

      stream
        .on('data', (data: Buffer) => {
          if (entry) refreshIdle(key, entry);
          options.onData(data.toString());
        })
        .on('close', (code: number | null, signal: string | null) => {
          release();
          options.onClose?.(code, signal);
        })
        .on('error', (streamError: Error) => {
          options.onError?.(streamError);
        });

      stream.stderr.on('data', (data: Buffer) => {
        options.onError?.(new Error(data.toString().trim() || 'SSH stream stderr'));
      });

      resolve({ close });
    });
  }));
}

/**
 * Closes all pooled SSH connections immediately.
 * Useful for clean shutdown or resetting state in tests.
 */
export function closeAllConnections(): void {
  for (const key of [...connectionPool.keys()]) {
    evict(key);
  }
}
