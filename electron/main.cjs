const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const net = require('net');

const isDev = !app.isPackaged && Boolean(process.env.ELECTRON_START_URL);

const getAvailablePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(() => resolve(port));
  });
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadUrlWithRetry = async (win, url, retries = 20) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await win.loadURL(url);
      return;
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      await delay(500);
    }
  }
};

const startNextServer = async () => {
  const serverRoot = app.isPackaged
    ? path.join(process.resourcesPath, '.next', 'standalone')
    : path.join(__dirname, '..', '.next', 'standalone');

  const serverPath = path.join(serverRoot, 'server.js');
  const port = await getAvailablePort();

  process.env.NODE_ENV = 'production';
  process.env.HOSTNAME = '127.0.0.1';
  process.env.PORT = String(port);

  process.chdir(serverRoot);
  require(serverPath);

  return port;
};

const attachExternalLinkHandlers = (win, appOrigin) => {
  const isExternalUrl = (url) => {
    if (!url) return false;
    if (!/^https?:/i.test(url)) return false;
    if (!appOrigin) return true;
    try {
      return new URL(url).origin !== appOrigin;
    } catch (err) {
      return true;
    }
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
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

  if (isDev) {
    const appOrigin = new URL(process.env.ELECTRON_START_URL).origin;
    attachExternalLinkHandlers(win, appOrigin);
    await win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const port = await startNextServer();
  const appOrigin = `http://127.0.0.1:${port}`;
  attachExternalLinkHandlers(win, appOrigin);
  await loadUrlWithRetry(win, appOrigin);
};

app.whenReady().then(createWindow);

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
