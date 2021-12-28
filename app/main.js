const {app, BrowserWindow, dialog, ipcMain} = require('electron');
const path = require('path');
const glob = require('glob');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const {readFileSync} = require('fs');

let win;
let dir;
let files;
let working = false;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1200,
    height: 1200,
    webPreferences: {preload: path.join(__dirname, "preload.js")}
  });
  win.loadFile('app/index.html');
});

app.on('window-all-closed', () => {
  app.quit();
});

function send(name, message) {
  win.webContents.send(name, message);
}

function log(message) {
  send('proc-log', message);
}

ipcMain.on('proc-pick-dir', (event, arg) => {
  log('picking directory');
  const paths = dialog.showOpenDialogSync(win, {properties: ['openDirectory']});
  if (paths) {
    log('paths selected - ' + paths);
    dir = paths[0];
    glob(path.join(dir, '**/*{/,+(.jpg|.jpeg|.JPG|.JPEG)}'), (err, res) => {
      if (err) {
        log('error listing images in dir: ' + err);
      } else {
        files = res;
        send('proc-dir-change', {dir, fileCount: files.length});
      }
    });
  } else {
    log('nothing selected');
  }
});

let pngPromiseResolve, pngPromiseReject;

async function textToPng(text) {
  return new Promise((resolve, reject) => {
    pngPromiseResolve = resolve;
    pngPromiseReject = reject;
    setTimeout(() => {
      reject('text to png timed out')
    }, 5000);
    send('proc-text-to-png', text);
  });
}

ipcMain.on('proc-text-as-png', (event, arg) => {
  if (arg.buffer) {
    pngPromiseResolve(arg.buffer);
  } else {
    pngPromiseReject();
  }
});

async function processOneImage(fileName, arg) {
  const fileContents = readFileSync(fileName);
  const metadata = await new Promise((resolve, reject) => {
    sharp(fileContents).metadata((err, metadata) => {
      resolve(exifReader(metadata.exif));
    });
  });
  let i = sharp(fileContents).rotate();
  if (metadata && metadata.image && metadata.image.Software == 'batchimageproc' && !arg.reProcess) {
    log('skipping already processed file');
    return;
  }

  if (arg.resize) {
    i = i.resize(arg.resize, arg.resize, {fit: 'inside'});
  }
  if (arg.dateTime && metadata && metadata.exif && metadata.exif.DateTimeOriginal) {
    const date = metadata.exif.DateTimeOriginal;
    i = i.composite([
      {
        input: await textToPng(date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })),
        gravity: 'southeast',
      },
    ]);
  }
  await i.withMetadata({
    exif: {
      IFD0: {
        Software: 'batchimageproc'
      }
    }
  }).toFile(fileName);
}

ipcMain.on('proc-start', async (event, arg) => {
  if (!dir || working) {
    return;
  }
  working = true;
  log('starting in ' + dir);
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    log(String(Math.round(i * 100 / files.length)) + '% ' + fileName);
    try {
      await processOneImage(fileName, arg);
    } catch (e) {
      log('failed: ' + e);
    }
  }
  log('100% done');
  working = false;
});