const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  printThermal: (options) => ipcRenderer.invoke('print-thermal', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
});
