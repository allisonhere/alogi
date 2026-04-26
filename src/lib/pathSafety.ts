import fs from 'fs';
import path from 'path';

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafePathError';
  }
}

function validateSegment(segment: string): void {
  if (!segment || segment === '.' || segment === '..') {
    throw new UnsafePathError('Invalid path segment');
  }
  if (segment.includes('/') || segment.includes('\\') || segment.includes('..')) {
    throw new UnsafePathError('Invalid path segment');
  }
}

export function isPathInside(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveContainedPath(baseDir: string, ...segments: string[]): string {
  for (const segment of segments) {
    validateSegment(segment);
  }

  const baseReal = fs.realpathSync(baseDir);
  const targetPath = path.resolve(baseReal, ...segments);
  const targetReal = fs.realpathSync(targetPath);

  if (!isPathInside(baseReal, targetReal)) {
    throw new UnsafePathError('Resolved path is outside the configured log directory');
  }

  return targetReal;
}
