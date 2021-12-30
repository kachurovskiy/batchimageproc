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
    width: 800,
    height: 800,
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
    log('listing .jpg, .jpeg, .JPG and .JPEG images recursively...');
    glob('**/*{/,+(.jpg|.jpeg|.JPG|.JPEG)}', {cwd: dir}, (err, res) => {
      if (err) {
        log('error listing images in dir: ' + err);
      } else {
        files = res;
        for (let i = res.length - 1; i >= 0; i--) {
          if (res[i].endsWith('/') || res[i].endsWith('\\')) {
            res.splice(i, 1);
          }
        }
        log(`found ${res.length} files`);
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
      if (err) {
        log('failed reading metadata for ' + fileName);
        resolve({});
        return;
      }
      if (!metadata.exif) {
        // Simply no exif attached.
        resolve({});
        return;
      }
      try {
        resolve(exifReader(metadata.exif));
      } catch (e) {
        log('failed reading exif for ' + fileName);
        resolve({});
      }
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
  if (!dir) {
    log('no dir, can\'t start');
    return;
  }
  if (working) {
    log('already running, can\'t restart');
    return;
  }
  working = true;
  log('starting in ' + dir);
  for (let i = 0; i < files.length; i++) {
    const fileName = path.join(dir, files[i]);
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