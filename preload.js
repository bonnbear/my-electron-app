// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    setStoragePath: (path) => ipcRenderer.invoke('set-storage-path', path),
    checkPassword: () => ipcRenderer.invoke('check-password'),
    setPassword: (password) => ipcRenderer.invoke('set-password', password),
    removePassword: (password) => ipcRenderer.invoke('remove-password', password),
    getData: (password) => ipcRenderer.invoke('get-data', password),
    saveData: (password, data) => ipcRenderer.invoke('save-data', { password, data }),
    importJson: () => ipcRenderer.invoke('import-json'),
    importCsv: () => ipcRenderer.invoke('import-csv'),
    importImage: () => ipcRenderer.invoke('import-image'),
    pasteImage: () => ipcRenderer.invoke('paste-image'),
});