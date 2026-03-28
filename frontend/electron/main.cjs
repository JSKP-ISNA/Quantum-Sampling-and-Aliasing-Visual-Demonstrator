const path = require('path');
const { app, BrowserWindow, shell } = require('electron');

const isDev = !app.isPackaged;
const devServerUrl = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5173';
const productionEntry = path.join(__dirname, '..', 'dist', 'index.html');

function createWindow() {
  const window = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1240,
    minHeight: 760,
    backgroundColor: '#0a1016',
    title: 'Quantum Signal Studio',
    autoHideMenuBar: true,
    show: false,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(productionEntry);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
