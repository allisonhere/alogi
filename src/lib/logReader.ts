import fs from 'fs';
import zlib from 'zlib';

const DEFAULT_CHUNK_SIZE = 64 * 1024;
const DEFAULT_MAX_DECOMPRESSED_BYTES = 10 * 1024 * 1024;

export class LogContentTooLargeError extends Error {
  constructor() {
    super('Gzip log exceeds decompressed size limit');
    this.name = 'LogContentTooLargeError';
  }
}

export function tailLogText(content: string, tailLines: number): string {
  const lines = content.split('\n');
  return lines.slice(-tailLines).join('\n');
}

function countNewlines(buffer: Buffer): number {
  let count = 0;
  for (const byte of buffer) {
    if (byte === 10) count += 1;
  }
  return count;
}

export function readPlainLogTail(filePath: string, tailLines: number): string {
  const fd = fs.openSync(filePath, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    if (size === 0) return '';

    const chunks: Buffer[] = [];
    let position = size;
    let newlineCount = 0;

    while (position > 0 && newlineCount <= tailLines) {
      const readSize = Math.min(DEFAULT_CHUNK_SIZE, position);
      position -= readSize;
      const buffer = Buffer.allocUnsafe(readSize);
      fs.readSync(fd, buffer, 0, readSize, position);
      chunks.unshift(buffer);
      newlineCount += countNewlines(buffer);
    }

    return tailLogText(Buffer.concat(chunks).toString('utf-8'), tailLines);
  } finally {
    fs.closeSync(fd);
  }
}

export function readGzipLogTail(
  filePath: string,
  tailLines: number,
  maxDecompressedBytes = DEFAULT_MAX_DECOMPRESSED_BYTES,
): string {
  try {
    const content = zlib.gunzipSync(fs.readFileSync(filePath), {
      maxOutputLength: maxDecompressedBytes,
    }).toString('utf-8');
    return tailLogText(content, tailLines);
  } catch (error) {
    if (error instanceof RangeError || (error instanceof Error && error.message.includes('maxOutputLength'))) {
      throw new LogContentTooLargeError();
    }
    throw error;
  }
}

export function readLocalLogContent(
  filePath: string,
  tailLines: number,
  options: { maxDecompressedBytes?: number } = {},
): string {
  const safeTailLines = Math.max(1, Math.floor(tailLines));
  if (filePath.endsWith('.gz')) {
    return readGzipLogTail(filePath, safeTailLines, options.maxDecompressedBytes);
  }
  return readPlainLogTail(filePath, safeTailLines);
}
