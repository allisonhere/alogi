/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, shell, ipcMain, utilityProcess } = require('electron');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

// Use xdg-open directly on Linux to avoid KDE portal issues
const openExternal = (url) => {
  if (process.platform === 'linux') {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    shell.openExternal(url);
  }
};

const isDev = !app.isPackaged && Boolean(process.env.ELECTRON_START_URL);

const getAvailablePort = (host = '127.0.0.1') => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, host, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(() => resolve(port));
  });
});

const parseArgs = (argv) => {
  const startIndex = process.defaultApp ? 2 : 1;
  const args = argv.slice(startIndex);
  const result = {
    web: false,
    desktop: false,
    host: null,
    port: null,
    open: false,
    help: false,
    version: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--web') {
      result.web = true;
      continue;
    }
    if (arg === '--desktop') {
      result.desktop = true;
      continue;
    }
    if (arg === '--open') {
      result.open = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      result.version = true;
      continue;
    }
    if (arg === '--host' && args[i + 1]) {
      result.host = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--host=')) {
      result.host = arg.slice('--host='.length);
      continue;
    }
    if (arg === '--port' && args[i + 1]) {
      result.port = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      result.port = arg.slice('--port='.length);
    }
  }

  return result;
};

const parsePort = (value) => {
  if (value == null) return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }
  return port;
};

const formatHostForUrl = (host) => {
  if (!host) return '127.0.0.1';
  if (host.includes(':') && !host.startsWith('[')) {
    return `[${host}]`;
  }
  return host;
};

const isLoopbackHost = (host) => (
  host === '127.0.0.1' || host === 'localhost' || host === '::1'
);

const toUrl = (host, port) => `http://${formatHostForUrl(host)}:${port}`;

const toOpenHost = (host) => {
  if (!host) return '127.0.0.1';
  if (host === '0.0.0.0' || host === '::') return '127.0.0.1';
  return host;
};

const printHelp = () => {
  console.log(`
Usage: alogi [options]

Options:
  --web         Run in browser-only server mode (no Electron window)
  --desktop     Force desktop mode (Electron window)
  --host <host> Bind host for web mode (default: 127.0.0.1)
  --port <port> Bind port for web mode (default: 3000)
  --open        Open the browser after starting in web mode
  --version, -v Print the app version
  --help, -h    Show help
`);
};

let serverProc = null;

const waitForPort = (host, port, { timeout = 30000, interval = 200 } = {}) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const attempt = () => {
      const sock = net.connect({ host, port });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Server did not start within ${timeout / 1000}s`));
        } else {
          setTimeout(attempt, interval);
        }
      });
    };
    attempt();
  });

const startNextServer = async ({ host, port } = {}) => {
  const serverRoot = app.isPackaged
    ? path.join(process.resourcesPath, '.next', 'standalone')
    : path.join(__dirname, '..', '.next', 'standalone');

  const serverPath = path.join(serverRoot, 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Next server not found at ${serverPath}. Run "npm run build" first.`);
  }

  const resolvedHost = host || '127.0.0.1';
  const resolvedPort = port || await getAvailablePort(resolvedHost);

  serverProc = utilityProcess.fork(serverPath, [], {
    cwd: serverRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: resolvedHost,
      PORT: String(resolvedPort),
    },
  });

  await waitForPort(resolvedHost, resolvedPort);
  return { host: resolvedHost, port: resolvedPort };
};

const attachExternalLinkHandlers = (win, appOrigin) => {
  const isExternalUrl = (url) => {
    if (!url) return false;
    if (!/^https?:/i.test(url)) return false;
    if (!appOrigin) return true;
    try {
      return new URL(url).origin !== appOrigin;
    } catch {
      return true;
    }
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  Menu.setApplicationMenu(null);

  if (isDev) {
    const appOrigin = new URL(process.env.ELECTRON_START_URL).origin;
    attachExternalLinkHandlers(win, appOrigin);
    await win.loadURL(process.env.ELECTRON_START_URL);
    return;
  }

  const { host, port } = await startNextServer({ host: '127.0.0.1' });
  const appOrigin = toUrl(host, port);
  attachExternalLinkHandlers(win, appOrigin);
  await win.loadURL(appOrigin);
};

const runWebMode = async (cli) => {
  const host = cli.host || '127.0.0.1';
  const portValue = cli.port;
  const port = portValue ? parsePort(portValue) : 3000;

  if (portValue && port == null) {
    console.error(`Invalid --port value: ${portValue}`);
    app.exit(1);
    return;
  }

  if (!isLoopbackHost(host)) {
    console.error('Refusing to bind web mode to a non-loopback host. Use 127.0.0.1, localhost, or ::1.');
    app.exit(1);
    return;
  }

  const { port: resolvedPort } = await startNextServer({ host, port });
  const serverUrl = toUrl(host, resolvedPort);
  const openUrl = toUrl(toOpenHost(host), resolvedPort);

  console.log(`Alogi web server running at ${serverUrl}`);
  if (host !== toOpenHost(host)) {
    console.log(`Local access: ${openUrl}`);
  }

  if (cli.open) {
    openExternal(openUrl);
  }
};

const cli = parseArgs(process.argv);

// Handle informational flags before Electron spins up any UI.
if (cli.help || cli.version) {
  if (cli.help) {
    printHelp();
  } else {
    console.log(app.getVersion());
  }
  app.exit(0);
  return;
}

ipcMain.handle('app:quit', () => {
  app.quit();
});

app.whenReady().then(async () => {
  if (cli.web && cli.desktop) {
    console.error('Choose either --web or --desktop (not both).');
    app.exit(1);
    return;
  }

  if (cli.web) {
    await runWebMode(cli);
    return;
  }

  await createWindow();
}).catch((err) => {
  console.error(err);
  app.exit(1);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
});
