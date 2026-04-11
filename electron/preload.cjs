/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alogiApp', {
  quit: () => ipcRenderer.invoke('app:quit'),
});
