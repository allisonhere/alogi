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

function resolveHome(filepath: string): string {
    if (filepath.startsWith('~')) {
        return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
}

const EXEC_TIMEOUT = 30000;

export function sshExec(config: SSHHostConfig, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;

    const settle = (fn: typeof resolve | typeof reject, value: string | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn.end();
      (fn as (v: string | Error) => void)(value);
    };

    const timer = setTimeout(() => {
      settle(reject, new Error(`SSH command timed out after ${EXEC_TIMEOUT / 1000}s`));
    }, EXEC_TIMEOUT);

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
          if (code !== 0 && stderr.trim()) {
              const signalInfo = signal ? ` (signal: ${signal})` : '';
              debug.warn(`SSH command stderr (exit ${code}${signalInfo}): ${stderr.trim()}`);
              settle(reject, new Error(stderr.trim()));
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
      readyTimeout: 10000,
    });
  });
}
