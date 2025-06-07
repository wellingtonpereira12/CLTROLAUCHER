const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  iniciarPatch: () => ipcRenderer.send('iniciar-patch'),
  abrirConfiguracoes: () => ipcRenderer.send('abrir-configuracoes'),
  onStatus: (callback) => ipcRenderer.on('status', callback),
  onProgresso: (callback) => ipcRenderer.on('progresso', callback),
  onErro: (callback) => ipcRenderer.on('erro', callback),
});
