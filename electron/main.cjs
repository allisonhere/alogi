const { app, BrowserWindow } = require('electron');
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

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (isDev) {
    await win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const port = await startNextServer();
  await loadUrlWithRetry(win, `http://127.0.0.1:${port}`);
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
