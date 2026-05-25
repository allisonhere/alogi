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

// Helper: make exec succeed with a given stdout value.
function mockExecSuccess(stdout: string) {
  mocks.exec.mockImplementation((_cmd: string, cb: (err: Error | null, stream: EventEmitter & { stderr: EventEmitter }) => void) => {
    const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
    stream.stderr = new EventEmitter();
    cb(null, stream);
    queueMicrotask(() => {
      stream.emit('data', Buffer.from(stdout));
      stream.emit('close', 0, null);
    });
  });
}

// Helper: make exec fail with exit code and optional stderr.
function mockExecFail(code: number, stdout = '', stderr = '') {
  mocks.exec.mockImplementation((_cmd: string, cb: (err: Error | null, stream: EventEmitter & { stderr: EventEmitter }) => void) => {
    const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
    stream.stderr = new EventEmitter();
    cb(null, stream);
    queueMicrotask(() => {
      if (stdout) stream.emit('data', Buffer.from(stdout));
      if (stderr) stream.stderr.emit('data', Buffer.from(stderr));
      stream.emit('close', code, null);
    });
  });
}

const HOST = { hostname: 'example.com', username: 'root', authMethod: 'key' as const };

// Shared beforeEach: reset modules AND the globalThis pool so each test
// gets a genuinely empty connection pool regardless of test ordering.
function resetAll() {
  vi.resetModules();
  vi.clearAllMocks();
  // The pool lives on globalThis to survive Next.js module isolation in
  // production; tests must clear it explicitly since vi.resetModules()
  // only resets the module registry, not globalThis.
  (globalThis as Record<string, unknown>)['__alogiSshPool'] = undefined;
}

describe('sshExec', () => {
  beforeEach(resetAll);

  it('rejects non-zero exits even when stderr is empty', async () => {
    mockExecFail(2, 'informational stdout');
    const { sshExec } = await import('../ssh');

    await expect(
      sshExec(HOST, 'false')
    ).rejects.toThrow(/informational stdout|exit 2/i);
  });

  it('resolves with stdout on success', async () => {
    mockExecSuccess('hello\n');
    const { sshExec } = await import('../ssh');

    await expect(sshExec(HOST, 'echo hello')).resolves.toBe('hello\n');
  });

  it('rejects with stderr message when available', async () => {
    mockExecFail(1, '', 'permission denied');
    const { sshExec } = await import('../ssh');

    await expect(sshExec(HOST, 'cat /root/secret')).rejects.toThrow('permission denied');
  });
});

describe('connection pool', () => {
  beforeEach(resetAll);

  it('reuses one connection for multiple calls to the same host', async () => {
    mockExecSuccess('ok');
    const { sshExec } = await import('../ssh');

    await sshExec(HOST, 'cmd1');
    await sshExec(HOST, 'cmd2');
    await sshExec(HOST, 'cmd3');

    // Only one TCP+SSH handshake regardless of how many exec calls are made.
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.exec).toHaveBeenCalledTimes(3);
  });

  it('shares the in-flight connection among concurrent callers', async () => {
    mockExecSuccess('pong');
    const { sshExec } = await import('../ssh');

    // Fire three requests at once — none should trigger a second handshake.
    const [a, b, c] = await Promise.all([
      sshExec(HOST, 'ping'),
      sshExec(HOST, 'ping'),
      sshExec(HOST, 'ping'),
    ]);

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(['pong', 'pong', 'pong']);
  });

  it('serializes commands on a pooled connection', async () => {
    const streams: Array<EventEmitter & { stderr: EventEmitter }> = [];
    mocks.exec.mockImplementation((_cmd: string, cb: (err: Error | null, stream: EventEmitter & { stderr: EventEmitter }) => void) => {
      const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      stream.stderr = new EventEmitter();
      streams.push(stream);
      cb(null, stream);
    });
    const { sshExec } = await import('../ssh');

    const first = sshExec(HOST, 'cmd1');
    const second = sshExec(HOST, 'cmd2');
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.exec).toHaveBeenCalledTimes(1);

    streams[0].emit('data', Buffer.from('first'));
    streams[0].emit('close', 0, null);
    await expect(first).resolves.toBe('first');
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(mocks.exec).toHaveBeenCalledTimes(2);
    streams[1].emit('data', Buffer.from('second'));
    streams[1].emit('close', 0, null);
    await expect(second).resolves.toBe('second');
  });

  it('reconnects after the connection drops', async () => {
    mockExecSuccess('first');
    const { sshExec } = await import('../ssh');
    const { Client } = await import('ssh2');

    // First call establishes the connection.
    await sshExec(HOST, 'cmd1');
    expect(mocks.connect).toHaveBeenCalledTimes(1);

    // Simulate the remote end closing the connection.
    const instance = (Client as unknown as ReturnType<typeof vi.fn>).mock.results[0].value as EventEmitter;
    instance.emit('close');

    // Next call must open a fresh connection.
    mockExecSuccess('second');
    await sshExec(HOST, 'cmd2');
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  it('closeAllConnections ends every pooled client', async () => {
    mockExecSuccess('ok');
    const { sshExec, closeAllConnections } = await import('../ssh');

    await sshExec(HOST, 'cmd');
    closeAllConnections();

    expect(mocks.end).toHaveBeenCalledTimes(1);
  });
});

describe('persistent ssh streams', () => {
  beforeEach(resetAll);

  it('keeps a command stream open until the caller closes it', async () => {
    const stream = new EventEmitter() as EventEmitter & { stderr: EventEmitter; close: ReturnType<typeof vi.fn> };
    stream.stderr = new EventEmitter();
    stream.close = vi.fn();
    mocks.exec.mockImplementation((_cmd: string, cb: (err: Error | null, stream: EventEmitter & { stderr: EventEmitter }) => void) => {
      cb(null, stream);
    });
    const { sshStream } = await import('../ssh');
    const onData = vi.fn();
    const onClose = vi.fn();

    const handle = await sshStream(HOST, 'journalctl -f', { onData, onClose });
    stream.emit('data', Buffer.from('line one\n'));
    stream.emit('data', Buffer.from('line two\n'));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.exec).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith('line one\n');
    expect(onData).toHaveBeenCalledWith('line two\n');
    expect(mocks.end).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    handle.close();
    expect(stream.close).toHaveBeenCalledTimes(1);
  });
});
