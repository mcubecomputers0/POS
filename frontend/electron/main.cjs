const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'வியாபாரம் (VIYABARAM CLOUD) — GST Billing & Inventory Management',
    icon: path.join(__dirname, '../public/icon.png'),
    autoHideMenuBar: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows cross-origin API calls to cloud endpoints
    },
  });

  // Custom native app menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload App',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        {
          label: 'Print Current View',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.print({ silent: false, printBackground: true });
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'வியாபாரம் (VIYABARAM CLOUD) v1.0.0',
          enabled: false,
        },
        {
          label: 'About வியாபாரம் (VIYABARAM CLOUD)',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About வியாபாரம் (VIYABARAM CLOUD)',
              message: 'வியாபாரம் (VIYABARAM CLOUD)',
              detail: 'GST Billing & Inventory Management Software\n\nSoftware Developed By: MCube Computers\nLicense Rights: MCube Computers\nVersion: 1.0.0',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Error listener with automatic fallback to built index.html
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Page failed to load: ${validatedURL} (${errorCode}: ${errorDescription})`);
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath) && validatedURL.includes('5173')) {
      console.log('Dev server not reachable. Loading built dist/index.html instead...');
      mainWindow.loadFile(indexPath);
    }
  });

  // Load URL or built index.html
  const indexPath = path.join(__dirname, '../dist/index.html');
  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    mainWindow.loadURL(devUrl).catch(() => {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      }
    });
  } else if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {});
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for native thermal & desktop printing
ipcMain.handle('print-thermal', async (_event, options = {}) => {
  if (!mainWindow) return { success: false, message: 'No active window' };
  try {
    return new Promise((resolve) => {
      mainWindow.webContents.print(
        {
          silent: options.silent || false,
          printBackground: true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'none' },
          pageSize: options.pageSize || { width: 80000, height: 297000 }, // 80mm roll width in microns
        },
        (success, errorType) => {
          if (!success) {
            resolve({ success: false, error: errorType });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handler to get list of local installed printers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return mainWindow.webContents.getPrintersAsync();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
