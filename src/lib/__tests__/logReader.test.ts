import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLocalLogContent } from '../logReader';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alogi-log-reader-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('readLocalLogContent', () => {
  it('returns only the requested tail lines for plain log files', () => {
    const filePath = path.join(tempDir, 'app.log');
    fs.writeFileSync(
      filePath,
      Array.from({ length: 100 }, (_, index) => `line-${index + 1}`).join('\n'),
      'utf-8',
    );

    expect(readLocalLogContent(filePath, 5)).toBe('line-96\nline-97\nline-98\nline-99\nline-100');
  });

  it('rejects gzip files whose decompressed content exceeds the configured limit', () => {
    const filePath = path.join(tempDir, 'app.log.gz');
    fs.writeFileSync(filePath, zlib.gzipSync('x'.repeat(128)));

    expect(() => readLocalLogContent(filePath, 10, { maxDecompressedBytes: 64 })).toThrow(
      /decompressed size limit/i,
    );
  });
});
