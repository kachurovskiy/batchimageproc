const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {glob} = require('glob');
const sharp = require('sharp');
const exifReader = require('exif-reader');

const SOFTWARE_TAG = 'batchimageproc';
const DEFAULT_OUTPUT_DIR_NAME = 'batchimageproc-output';
const IMAGE_GLOB = '**/*.{jpg,jpeg}';

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function isSubPath(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function getDefaultOutputDir(sourceDir) {
  return path.join(sourceDir, DEFAULT_OUTPUT_DIR_NAME);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeTimeZone(value) {
  const timeZone = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';
  try {
    new Intl.DateTimeFormat(undefined, {timeZone});
    return timeZone;
  } catch (e) {
    return 'UTC';
  }
}

function normalizeLocale(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const locale = value.trim();
  try {
    new Intl.DateTimeFormat(locale);
    return locale;
  } catch (e) {
    return undefined;
  }
}

function normalizeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#FFD7A8';
}

function getDefaultWorkerCount() {
  if (typeof os.availableParallelism === 'function') {
    return Math.max(1, os.availableParallelism());
  }

  return Math.max(1, os.cpus().length || 1);
}

function normalizeOptions(rawOptions = {}, sourceDir) {
  const outputMode = rawOptions.outputMode === 'overwrite' ? 'overwrite' : 'folder';
  const outputDir = rawOptions.outputDir
    ? path.resolve(rawOptions.outputDir)
    : sourceDir
      ? getDefaultOutputDir(sourceDir)
      : undefined;

  if (outputMode === 'folder' && sourceDir && path.resolve(sourceDir) === outputDir) {
    throw new Error('Output folder must be different from the source folder');
  }

  return {
    outputMode,
    outputDir,
    overwriteOutput: Boolean(rawOptions.overwriteOutput),
    resize: rawOptions.resize ? clampNumber(rawOptions.resize, 10, 10000, 0) : 0,
    dateTime: Boolean(rawOptions.dateTime),
    dateTimeColor: normalizeColor(rawOptions.dateTimeColor),
    dateTimeFontSize: clampNumber(rawOptions.dateTimeFontSize, 10, 100, 20),
    locale: normalizeLocale(rawOptions.locale),
    timeZone: normalizeTimeZone(rawOptions.timeZone),
    reProcess: Boolean(rawOptions.reProcess),
  };
}

async function listImages(sourceDir, options = {}) {
  const ignore = [];
  const outputDir = options.outputDir || getDefaultOutputDir(sourceDir);

  if (isSubPath(sourceDir, outputDir)) {
    ignore.push(`${normalizeSlashes(path.relative(sourceDir, outputDir))}/**`);
  }

  const files = await glob(IMAGE_GLOB, {
    cwd: sourceDir,
    nodir: true,
    nocase: true,
    windowsPathsNoEscape: true,
    ignore,
  });

  return files.sort((a, b) => a.localeCompare(b));
}

function parseExif(buffer) {
  if (!buffer) {
    return {};
  }

  try {
    return exifReader(buffer) || {};
  } catch (e) {
    return {};
  }
}

function isProcessedByThisApp(exif) {
  return exif && exif.Image && exif.Image.Software === SOFTWARE_TAG;
}

function getExifDateValue(exif) {
  if (!exif) {
    return null;
  }

  return (
    exif.Photo && exif.Photo.DateTimeOriginal ||
    exif.Photo && exif.Photo.DateTimeDigitized ||
    exif.Image && exif.Image.DateTimeOriginal ||
    exif.Image && exif.Image.DateTime ||
    null
  );
}

function formatDateTime(value, options) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    try {
      return value.toLocaleString(options.locale, {timeZone: options.timeZone});
    } catch (e) {
      return value.toISOString().replace('T', ' ').slice(0, 19);
    }
  }

  return String(value);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function measureTextOverlay(text, fontSize) {
  const padding = Math.ceil(fontSize * 0.35);
  return {
    padding,
    width: Math.ceil(text.length * fontSize * 0.62 + padding * 2),
    height: Math.ceil(fontSize * 1.45 + padding * 2),
  };
}

function textToSvgBuffer(text, options, bounds = {}) {
  let fontSize = options.dateTimeFontSize;
  let size = measureTextOverlay(text, fontSize);
  const maxWidth = bounds.width || size.width;
  const maxHeight = bounds.height || size.height;

  if (size.width > maxWidth || size.height > maxHeight) {
    const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
    fontSize = Math.max(8, Math.floor(fontSize * scale));
    size = measureTextOverlay(text, fontSize);
  }

  const padding = size.padding;
  const width = Math.min(size.width, maxWidth);
  const height = Math.min(size.height, maxHeight);
  const baseline = height - padding - Math.ceil(fontSize * 0.18);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<text x="${width - padding}" y="${baseline}" text-anchor="end"`,
    ` fill="${options.dateTimeColor}" font-family="Verdana, Arial, sans-serif"`,
    ` font-size="${fontSize}" font-weight="400">${escapeXml(text)}</text>`,
    '</svg>',
  ].join('');

  return Buffer.from(svg);
}

function getTargetDimensions(metadata, options) {
  let width = metadata.width || 1;
  let height = metadata.height || 1;

  if (metadata.orientation >= 5 && metadata.orientation <= 8) {
    [width, height] = [height, width];
  }

  if (options.resize) {
    const scale = Math.min(options.resize / width, options.resize / height, 1);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  return {width, height};
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
}

async function resolveAvailablePath(filePath) {
  if (!await fileExists(filePath)) {
    return filePath;
  }

  const parsed = path.parse(filePath);
  for (let i = 1; i < 10000; i++) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an available output filename for ${filePath}`);
}

function getDestinationPath(inputPath, sourceDir, relativePath, options) {
  if (options.outputMode === 'overwrite') {
    return inputPath;
  }

  const safeRelativePath = relativePath || path.relative(sourceDir, inputPath);
  if (!safeRelativePath || safeRelativePath.startsWith('..') || path.isAbsolute(safeRelativePath)) {
    throw new Error(`Invalid relative image path: ${safeRelativePath}`);
  }

  return path.join(options.outputDir, safeRelativePath);
}

async function writeBufferAtomically(destinationPath, buffer) {
  const directory = path.dirname(destinationPath);
  const parsed = path.parse(destinationPath);
  const tempPath = path.join(
    directory,
    `.${parsed.name}.batchimageproc-${process.pid}-${Date.now()}${parsed.ext}.tmp`
  );

  await fs.mkdir(directory, {recursive: true});
  await fs.writeFile(tempPath, buffer);

  try {
    await fs.rename(tempPath, destinationPath);
  } catch (e) {
    await fs.unlink(tempPath).catch(() => {});
    throw e;
  }
}

async function processOneImage(inputPath, sourceDir, relativePath, rawOptions = {}) {
  const options = normalizeOptions(rawOptions, sourceDir);
  const inputBuffer = await fs.readFile(inputPath);
  const metadata = await sharp(inputBuffer).metadata();
  const exif = parseExif(metadata.exif);

  if (isProcessedByThisApp(exif) && !options.reProcess) {
    return {
      status: 'skipped',
      inputPath,
      reason: 'already-processed',
    };
  }

  let image = sharp(inputBuffer).rotate();

  if (options.resize) {
    image = image.resize(options.resize, options.resize, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (options.dateTime) {
    const dateText = formatDateTime(getExifDateValue(exif), options);
    if (dateText) {
      const targetDimensions = getTargetDimensions(metadata, options);
      image = image.composite([
        {
          input: textToSvgBuffer(dateText, options, targetDimensions),
          gravity: 'southeast',
        },
      ]);
    }
  }

  const baseDestinationPath = getDestinationPath(inputPath, sourceDir, relativePath, options);
  const destinationPath = options.outputMode === 'folder' && !options.overwriteOutput
    ? await resolveAvailablePath(baseDestinationPath)
    : baseDestinationPath;

  const outputBuffer = await image
    .withMetadata({
      exif: {
        IFD0: {
          Software: SOFTWARE_TAG,
        },
      },
    })
    .toBuffer();

  await writeBufferAtomically(destinationPath, outputBuffer);

  return {
    status: 'written',
    inputPath,
    destinationPath,
  };
}

async function processBatch({sourceDir, rawOptions, onLog, onProgress, isCancelled}) {
  const options = normalizeOptions(rawOptions, sourceDir);
  const files = await listImages(sourceDir, {
    outputDir: options.outputMode === 'folder' ? options.outputDir : undefined,
  });

  const stats = {
    total: files.length,
    written: 0,
    skipped: 0,
    failed: 0,
    cancelled: false,
  };

  const workerCount = Math.min(files.length || 1, getDefaultWorkerCount());
  let nextIndex = 0;
  let completed = 0;

  onLog && onLog(`processing with ${workerCount} worker${workerCount === 1 ? '' : 's'}`);
  onProgress && onProgress({
    index: 0,
    total: files.length,
    percent: files.length ? 0 : 100,
    file: '',
    stats: {...stats},
  });

  async function worker() {
    while (nextIndex < files.length) {
      if (isCancelled && isCancelled()) {
        stats.cancelled = true;
        return;
      }

      const index = nextIndex++;
      const relativePath = files[index];
      const inputPath = path.join(sourceDir, relativePath);

      onProgress && onProgress({
        index: completed,
        total: files.length,
        percent: files.length ? Math.round(completed * 100 / files.length) : 100,
        file: inputPath,
        stats: {...stats},
      });

      try {
        const result = await processOneImage(inputPath, sourceDir, relativePath, options);
        if (result.status === 'skipped') {
          stats.skipped++;
          onLog && onLog(`skipped already processed file: ${inputPath}`);
        } else {
          stats.written++;
          onLog && onLog(`wrote: ${result.destinationPath}`);
        }
      } catch (e) {
        stats.failed++;
        onLog && onLog(`failed: ${inputPath}: ${e.message || e}`);
      } finally {
        completed++;
        onProgress && onProgress({
          index: completed,
          total: files.length,
          percent: files.length ? Math.round(completed * 100 / files.length) : 100,
          file: inputPath,
          stats: {...stats},
        });
      }
    }
  }

  await Promise.all(Array.from({length: workerCount}, () => worker()));

  if (isCancelled && isCancelled()) {
    stats.cancelled = true;
  }

  onProgress && onProgress({
    index: completed,
    total: files.length,
    percent: 100,
    file: '',
    stats: {...stats},
  });

  return stats;
}

module.exports = {
  DEFAULT_OUTPUT_DIR_NAME,
  SOFTWARE_TAG,
  formatDateTime,
  getDefaultWorkerCount,
  getDefaultOutputDir,
  listImages,
  normalizeOptions,
  parseExif,
  processBatch,
  processOneImage,
  textToSvgBuffer,
};
