import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveContainedPath } from '../pathSafety';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alogi-path-safety-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('resolveContainedPath', () => {
  it('resolves a normal path inside the base directory', () => {
    const baseDir = path.join(tempDir, 'logs');
    const hostDir = path.join(baseDir, 'host-a');
    const filePath = path.join(hostDir, 'app.log');
    fs.mkdirSync(hostDir, { recursive: true });
    fs.writeFileSync(filePath, 'hello');

    expect(resolveContainedPath(baseDir, 'host-a', 'app.log')).toBe(fs.realpathSync(filePath));
  });

  it('rejects parent traversal segments', () => {
    const baseDir = path.join(tempDir, 'logs');
    fs.mkdirSync(baseDir);

    expect(() => resolveContainedPath(baseDir, '..', 'secret.log')).toThrow(/invalid path segment/i);
  });

  it('rejects separator-containing segments', () => {
    const baseDir = path.join(tempDir, 'logs');
    fs.mkdirSync(baseDir);

    expect(() => resolveContainedPath(baseDir, 'host-a/app.log')).toThrow(/invalid path segment/i);
  });

  it('rejects symlink escapes outside the base directory', () => {
    const baseDir = path.join(tempDir, 'logs');
    const outsideDir = path.join(tempDir, 'outside');
    fs.mkdirSync(baseDir);
    fs.mkdirSync(outsideDir);
    fs.writeFileSync(path.join(outsideDir, 'secret.log'), 'secret');
    fs.symlinkSync(outsideDir, path.join(baseDir, 'linked-host'));

    expect(() => resolveContainedPath(baseDir, 'linked-host', 'secret.log')).toThrow(/outside/i);
  });
});
