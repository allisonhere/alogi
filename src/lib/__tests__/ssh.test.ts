import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  default: {
    ...(await importOriginal<typeof import('fs')>()),
    readFileSync: vi.fn(() => Buffer.from('private-key')),
  },
  readFileSync: vi.fn(() => Buffer.from('private-key')),
}));

vi.mock('ssh2', () => ({
  Client: vi.fn(function MockClient(this: EventEmitter & {
    exec: typeof mocks.exec;
    connect: typeof mocks.connect;
    end: typeof mocks.end;
  }) {
    const client = new EventEmitter() as EventEmitter & {
      exec: typeof mocks.exec;
      connect: typeof mocks.connect;
      end: typeof mocks.end;
    };
    client.exec = mocks.exec;
    client.connect = mocks.connect.mockImplementation(() => {
      queueMicrotask(() => client.emit('ready'));
      return client;
    });
    client.end = mocks.end;
    return client;
  }),
}));

describe('sshExec', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects non-zero exits even when stderr is empty', async () => {
    mocks.exec.mockImplementation((_command: string, callback: (err: Error | null, stream: EventEmitter & { stderr: EventEmitter }) => void) => {
      const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      stream.stderr = new EventEmitter();
      callback(null, stream);
      queueMicrotask(() => {
        stream.emit('data', Buffer.from('informational stdout'));
        stream.emit('close', 2, null);
      });
    });
    const { sshExec } = await import('../ssh');

    await expect(
      sshExec({ hostname: 'example.com', username: 'root', authMethod: 'key' }, 'false')
    ).rejects.toThrow(/informational stdout|exit 2/i);
  });
});
