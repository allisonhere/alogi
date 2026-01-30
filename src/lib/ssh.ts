import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

export function sshExec(config: SSHHostConfig, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    const usePassword = config.authMethod === 'password';
    let privateKey: Buffer | undefined;

    if (!usePassword) {
      const keyPath = resolveHome(config.keyPath || '~/.ssh/id_rsa');

      // Check if key exists
      try {
          privateKey = fs.readFileSync(keyPath);
      } catch {
          return reject(new Error(`Private key not found at ${keyPath}`));
      }
    } else if (!config.password) {
      return reject(new Error('SSH password not provided'));
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
            conn.end();
            return reject(err);
        }
        let stdout = '';
        let stderr = '';
        stream.on('close', (code: number | null, signal: string | null) => {
          conn.end();
          if (code !== 0 && stderr.trim()) {
              const signalInfo = signal ? ` (signal: ${signal})` : '';
              console.warn(`SSH command stderr (exit ${code}${signalInfo}): ${stderr.trim()}`);
          }
          if (code !== 0) {
              // reject(new Error(`SSH Command failed: ${stderr}`)); // Optional: don't fail on stderr warnings
          }
          resolve(stdout);
        }).on('data', (data: Buffer) => {
          stdout += data.toString();
        }).stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
        reject(err);
    }).connect({
      host: config.hostname,
      port: config.port || 22,
      username: config.username,
      privateKey,
      password: usePassword ? config.password : undefined
    });
  });
}
