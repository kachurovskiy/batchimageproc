const {contextBridge, ipcRenderer} = require('electron');

const receiveChannels = new Set([
  'proc-dir-change',
  'proc-scan-start',
  'proc-log',
  'proc-progress',
  'proc-state',
]);

function on(channel, callback) {
  if (!receiveChannels.has(channel)) {
    throw new Error(`Unsupported IPC channel: ${channel}`);
  }

  const listener = (_event, message) => callback(message);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('batchImageProc', {
  pickDirectory: () => ipcRenderer.invoke('proc-pick-dir'),
  pickOutputDirectory: () => ipcRenderer.invoke('proc-pick-output-dir'),
  startProcessing: (options) => ipcRenderer.invoke('proc-start', options),
  cancelProcessing: () => ipcRenderer.send('proc-cancel'),
  on,
});
