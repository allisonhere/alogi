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
  readyTimeoutMs?: number;
}

function resolveHome(filepath: string): string {
    if (filepath.startsWith('~')) {
        return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
}

const EXEC_TIMEOUT = 30000;
const READY_TIMEOUT = 10000;

export function sshExec(config: SSHHostConfig, command: string, options: SSHExecOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const commandTimeoutMs = options.commandTimeoutMs ?? EXEC_TIMEOUT;
    const readyTimeoutMs = options.readyTimeoutMs ?? READY_TIMEOUT;

    const settle = (fn: typeof resolve | typeof reject, value: string | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn.end();
      (fn as (v: string | Error) => void)(value);
    };

    const timer = setTimeout(() => {
      settle(reject, new Error(`SSH command timed out after ${commandTimeoutMs / 1000}s`));
    }, commandTimeoutMs);

    const usePassword = config.authMethod === 'password';
    let privateKey: Buffer | undefined;

    if (!usePassword) {
      const keyPath = resolveHome(config.keyPath || '~/.ssh/id_rsa');

      try {
          privateKey = fs.readFileSync(keyPath);
      } catch {
          clearTimeout(timer);
          return reject(new Error(`Private key not found at ${keyPath}`));
      }
    } else if (!config.password) {
      clearTimeout(timer);
      return reject(new Error('SSH password not provided'));
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
            settle(reject, err);
            return;
        }
        let stdout = '';
        let stderr = '';
        stream.on('close', (code: number | null, signal: string | null) => {
          if (code !== 0) {
              const signalInfo = signal ? ` (signal: ${signal})` : '';
              const detail = stderr.trim() || stdout.trim() || `SSH command exited with code ${code ?? 'unknown'}${signalInfo}`;
              debug.warn(`SSH command failed (exit ${code}${signalInfo}): ${detail}`);
              settle(reject, new Error(detail));
              return;
          }
          settle(resolve, stdout);
        }).on('data', (data: Buffer) => {
          stdout += data.toString();
        }).stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
        settle(reject, err);
    }).connect({
      host: config.hostname,
      port: config.port || 22,
      username: config.username,
      privateKey,
      password: usePassword ? config.password : undefined,
      readyTimeout: readyTimeoutMs,
    });
  });
}
