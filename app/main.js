const {app, BrowserWindow, dialog, ipcMain} = require('electron');
const path = require('path');
const {
  getDefaultOutputDir,
  listImages,
  normalizeOptions,
  processBatch,
} = require('./processor');

let win;
let sourceDir;
let working = false;
let cancelRequested = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 840,
    minHeight: 680,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
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

function send(name, message) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(name, message);
  }
}

function log(message) {
  send('proc-log', message);
}

function setState(state) {
  send('proc-state', state);
}

ipcMain.handle('proc-pick-dir', async () => {
  if (working) {
    return {ok: false, error: 'Processing is running'};
  }

  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  });

  if (result.canceled || !result.filePaths.length) {
    log('nothing selected');
    return {ok: false, canceled: true};
  }

  sourceDir = result.filePaths[0];
  const outputDir = getDefaultOutputDir(sourceDir);
  log(`selected source folder: ${sourceDir}`);
  send('proc-scan-start', {sourceDir, outputDir});
  log('listing JPEG images recursively...');

  const files = await listImages(sourceDir, {outputDir});
  const message = {sourceDir, outputDir, fileCount: files.length};
  log(`found ${files.length} files`);
  send('proc-dir-change', message);

  return {ok: true, ...message};
});

ipcMain.handle('proc-pick-output-dir', async () => {
  const result = await dialog.showOpenDialog(win, {
    defaultPath: sourceDir || app.getPath('pictures'),
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths.length) {
    return {ok: false, canceled: true};
  }

  return {ok: true, outputDir: result.filePaths[0]};
});

ipcMain.handle('proc-start', async (event, rawOptions) => {
  if (!sourceDir) {
    log('no source folder, cannot start');
    return {ok: false, error: 'Pick a source folder first'};
  }

  if (working) {
    log('already running, cannot restart');
    return {ok: false, error: 'Processing is already running'};
  }

  working = true;
  cancelRequested = false;
  setState({working: true});

  try {
    const options = normalizeOptions(rawOptions, sourceDir);
    log(`starting in ${sourceDir}`);
    if (options.outputMode === 'folder') {
      log(`writing output to ${options.outputDir}`);
    } else {
      log('overwriting original files');
    }

    const stats = await processBatch({
      sourceDir,
      rawOptions: options,
      onLog: log,
      onProgress: (progress) => send('proc-progress', progress),
      isCancelled: () => cancelRequested,
    });

    if (stats.cancelled) {
      log(`cancelled: wrote ${stats.written}, skipped ${stats.skipped}, failed ${stats.failed}`);
    } else {
      log(`done: wrote ${stats.written}, skipped ${stats.skipped}, failed ${stats.failed}`);
    }

    return {ok: true, stats};
  } catch (e) {
    log(`failed: ${e.message || e}`);
    return {ok: false, error: e.message || String(e)};
  } finally {
    working = false;
    cancelRequested = false;
    setState({working: false});
  }
});

ipcMain.on('proc-cancel', () => {
  if (working) {
    cancelRequested = true;
    log('cancel requested');
  }
});
