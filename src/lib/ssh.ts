import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SSHHostConfig {
  hostname: string;
  username: string;
  port?: number;
  keyPath?: string;
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
    
    const keyPath = resolveHome(config.keyPath || '~/.ssh/id_rsa');
    
    // Check if key exists
    let privateKey;
    try {
        privateKey = fs.readFileSync(keyPath);
    } catch (e) {
        return reject(new Error(`Private key not found at ${keyPath}`));
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
            conn.end();
            return reject(err);
        }
        let stdout = '';
        let stderr = '';
        stream.on('close', (code: any, signal: any) => {
          conn.end();
          if (code !== 0) {
              // reject(new Error(`SSH Command failed: ${stderr}`)); // Optional: don't fail on stderr warnings
          }
          resolve(stdout);
        }).on('data', (data: any) => {
          stdout += data;
        }).stderr.on('data', (data: any) => {
          stderr += data;
        });
      });
    }).on('error', (err) => {
        reject(err);
    }).connect({
      host: config.hostname,
      port: config.port || 22,
      username: config.username,
      privateKey
    });
  });
}
