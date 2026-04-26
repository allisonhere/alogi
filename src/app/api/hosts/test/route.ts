import { NextResponse } from 'next/server';
import { sshExec, type SSHHostConfig } from '@/lib/ssh';
import { debug } from '@/lib/debug';
import { getConfig, preserveSecretPlaceholders } from '@/lib/config';
import fs from 'fs';
import os from 'os';
import path from 'path';

function resolveHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

function diagnoseError(err: Error, config: SSHHostConfig): string {
  const msg = err.message || '';

  if (msg.includes('ECONNREFUSED')) {
    return `Connection refused by ${config.hostname}:${config.port || 22}. Check that the host is running an SSH server on that port.`;
  }
  if (msg.includes('ENOTFOUND')) {
    return `Hostname "${config.hostname}" could not be resolved. Check for typos.`;
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ENETUNREACH')) {
    return `Connection timed out reaching ${config.hostname}. The host may be down or blocked by a firewall.`;
  }
  if (msg.includes('authentication') || msg.includes('All configured authentication methods failed')) {
    const method = config.authMethod === 'password' ? 'password' : 'key';
    return `Authentication failed. Verify your username and ${method} are correct for ${config.hostname}.`;
  }
  if (msg.includes('Cannot parse privateKey') || msg.includes('Unsupported key format')) {
    return 'The private key could not be read. It may be in an unsupported format or passphrase-protected (passphrases are not supported).';
  }
  if (msg.includes('Private key not found')) {
    return msg; // Already descriptive from ssh.ts
  }
  if (msg.includes('EHOSTUNREACH')) {
    return `Host ${config.hostname} is unreachable. Check your network connection.`;
  }
  if (msg.includes('handshake') || msg.includes('Timed out while waiting for handshake')) {
    return `Connected to ${config.hostname}:${config.port || 22} but received no SSH response. Check that an SSH server (not another service) is listening on port ${config.port || 22}.`;
  }

  return msg || 'Unknown connection error';
}

export async function POST(req: Request) {
  const body = await req.json();
  const storedConfig = getConfig();
  const storedHost = typeof body.alias === 'string'
    ? storedConfig.hosts.find((host) => host.alias === body.alias)
    : undefined;
  const [resolvedBody] = preserveSecretPlaceholders(
    { hosts: [{ ...storedHost, ...body }] },
    storedConfig,
  ).hosts ?? [body];
  const config: SSHHostConfig = {
    hostname: resolvedBody.hostname,
    username: resolvedBody.username,
    port: resolvedBody.port ? parseInt(String(resolvedBody.port), 10) : 22,
    keyPath: resolvedBody.keyPath,
    password: resolvedBody.password,
    authMethod: resolvedBody.authMethod,
  };

  // Pre-flight validation
  if (!config.hostname || !config.username) {
    return NextResponse.json({ error: 'Hostname and username are required.' }, { status: 400 });
  }

  if (config.authMethod === 'password') {
    if (!config.password) {
      return NextResponse.json({ success: false, error: 'Password is empty. Enter a password and try again.' }, { status: 400 });
    }
  } else {
    const keyPath = resolveHome(config.keyPath || '~/.ssh/id_rsa');
    if (!fs.existsSync(keyPath)) {
      return NextResponse.json({ success: false, error: `Private key not found at ${keyPath}. Check the path and try again.` }, { status: 400 });
    }
    try {
      fs.accessSync(keyPath, fs.constants.R_OK);
    } catch {
      return NextResponse.json({ success: false, error: `Private key at ${keyPath} is not readable. Check file permissions.` }, { status: 400 });
    }
  }

  try {
    await sshExec(config, 'echo "Connection successful"');
    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown connection error');
    debug.error('SSH Connection Test Error:', err);
    return NextResponse.json({
      success: false,
      error: diagnoseError(err, config),
    }, { status: 500 });
  }
}
