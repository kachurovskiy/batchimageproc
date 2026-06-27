const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const sharp = require('sharp');
const {
  SOFTWARE_TAG,
  getDefaultOutputDir,
  listImages,
  parseExif,
  processOneImage,
} = require('../app/processor');

async function withTempDir(callback) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'batchimageproc-'));
  try {
    await callback(dir);
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
}

async function createJpeg(filePath, options = {}) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});

  let image = sharp({
    create: {
      width: options.width || 80,
      height: options.height || 40,
      channels: 3,
      background: options.background || '#000000',
    },
  }).jpeg();

  const ifd0 = {};
  if (options.software) {
    ifd0.Software = options.software;
  }
  if (options.dateTime) {
    ifd0.DateTime = options.dateTime;
  }
  if (Object.keys(ifd0).length) {
    image = image.withMetadata({exif: {IFD0: ifd0}});
  }

  await image.toFile(filePath);
}

async function readExif(filePath) {
  const metadata = await sharp(filePath).metadata();
  return parseExif(metadata.exif);
}

test('listImages finds JPEG files and excludes the output folder', async () => {
  await withTempDir(async (dir) => {
    await createJpeg(path.join(dir, 'a.JPG'));
    await createJpeg(path.join(dir, 'nested', 'b.jpeg'));
    await createJpeg(path.join(getDefaultOutputDir(dir), 'old.jpg'));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'not an image');

    const files = await listImages(dir, {outputDir: getDefaultOutputDir(dir)});

    assert.deepEqual(files.map((file) => file.replace(/\\/g, '/')), [
      'a.JPG',
      'nested/b.jpeg',
    ]);
  });
});

test('processOneImage writes to an output folder without changing the original', async () => {
  await withTempDir(async (dir) => {
    const inputPath = path.join(dir, 'nested', 'input.jpg');
    const outputDir = path.join(dir, 'out');
    await createJpeg(inputPath, {width: 80, height: 40, software: 'camera'});
    const original = await fs.readFile(inputPath);

    const result = await processOneImage(inputPath, dir, 'nested/input.jpg', {
      outputMode: 'folder',
      outputDir,
      resize: 20,
      dateTime: false,
    });

    assert.equal(result.status, 'written');
    assert.equal(result.destinationPath, path.join(outputDir, 'nested', 'input.jpg'));
    assert.deepEqual(await fs.readFile(inputPath), original);

    const outputMetadata = await sharp(result.destinationPath).metadata();
    const outputExif = await readExif(result.destinationPath);
    assert.equal(outputMetadata.width, 20);
    assert.equal(outputMetadata.height, 10);
    assert.equal(outputExif.Image.Software, SOFTWARE_TAG);
  });
});

test('processOneImage skips files already stamped by this app', async () => {
  await withTempDir(async (dir) => {
    const inputPath = path.join(dir, 'done.jpg');
    const outputDir = path.join(dir, 'out');
    await createJpeg(inputPath, {software: SOFTWARE_TAG});

    const result = await processOneImage(inputPath, dir, 'done.jpg', {
      outputMode: 'folder',
      outputDir,
      reProcess: false,
    });

    assert.equal(result.status, 'skipped');
    await assert.rejects(fs.access(path.join(outputDir, 'done.jpg')));
  });
});

test('processOneImage composites a date overlay from EXIF metadata', async () => {
  await withTempDir(async (dir) => {
    const inputPath = path.join(dir, 'dated.jpg');
    const outputDir = path.join(dir, 'out');
    await createJpeg(inputPath, {
      width: 240,
      height: 120,
      background: '#000000',
      dateTime: '2020:01:02 03:04:05',
    });

    const result = await processOneImage(inputPath, dir, 'dated.jpg', {
      outputMode: 'folder',
      outputDir,
      dateTime: true,
      dateTimeColor: '#FFFFFF',
      dateTimeFontSize: 24,
      locale: 'en-US',
      timeZone: 'UTC',
    });

    const pixels = await sharp(result.destinationPath).raw().toBuffer();
    assert.equal(result.status, 'written');
    assert.ok(pixels.some((value) => value > 100));
  });
});
