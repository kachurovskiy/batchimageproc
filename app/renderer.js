const screens = {
  source: document.getElementById('sourceScreen'),
  options: document.getElementById('optionsScreen'),
  output: document.getElementById('outputScreen'),
  processing: document.getElementById('processingScreen'),
  result: document.getElementById('resultScreen'),
};

const stepLabel = document.getElementById('stepLabel');
const screenTitle = document.getElementById('screenTitle');
const folderButton = document.getElementById('folderButton');
const sourceResult = document.getElementById('sourceResult');
const sourcePath = document.getElementById('sourcePath');
const imageCountText = document.getElementById('imageCountText');
const sourceActions = document.getElementById('sourceActions');
const sourceNextButton = document.getElementById('sourceNextButton');
const changeSourceButton = document.getElementById('changeSourceButton');
const optionsScopeText = document.getElementById('optionsScopeText');
const optionsBackButton = document.getElementById('optionsBackButton');
const optionsNextButton = document.getElementById('optionsNextButton');
const resizeCheckbox = document.getElementById('resizeCheckbox');
const resizeDetails = document.getElementById('resizeDetails');
const resizeInput = document.getElementById('resizeInput');
const dateTimeCheckbox = document.getElementById('dateTimeCheckbox');
const dateTimeDetails = document.getElementById('dateTimeDetails');
const dateTimeColor = document.getElementById('dateTimeColor');
const dateTimeFontSizeInput = document.getElementById('dateTimeFontSizeInput');
const localeInput = document.getElementById('localeInput');
const timeZoneInput = document.getElementById('timeZoneInput');
const reProcessCheckbox = document.getElementById('reProcessCheckbox');
const outputSummaryText = document.getElementById('outputSummaryText');
const editActionsButton = document.getElementById('editActionsButton');
const outputFolderRadio = document.getElementById('outputFolderRadio');
const overwriteRadio = document.getElementById('overwriteRadio');
const outputFolderControls = document.getElementById('outputFolderControls');
const outputDirInput = document.getElementById('outputDirInput');
const outputFolderButton = document.getElementById('outputFolderButton');
const overwriteOutputCheckbox = document.getElementById('overwriteOutputCheckbox');
const overwriteNotice = document.getElementById('overwriteNotice');
const outputBackButton = document.getElementById('outputBackButton');
const startButton = document.getElementById('startButton');
const processingTitle = document.getElementById('processingTitle');
const cancelButton = document.getElementById('cancelButton');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const currentFileText = document.getElementById('currentFileText');
const resultTitle = document.getElementById('resultTitle');
const resultSummary = document.getElementById('resultSummary');
const logArea = document.getElementById('logArea');
const newBatchButton = document.getElementById('newBatchButton');
const sameFolderButton = document.getElementById('sameFolderButton');

let sourceDir = '';
let fileCount = 0;
let working = false;

const storedFields = [
  ['outputMode', () => getOutputMode(), (value) => setOutputMode(value)],
  ['overwriteOutputCheckbox', () => overwriteOutputCheckbox.checked, (value) => overwriteOutputCheckbox.checked = value === 'true'],
  ['resizeCheckbox', () => resizeCheckbox.checked, (value) => resizeCheckbox.checked = value === 'true'],
  ['resizeInput', () => resizeInput.value, (value) => resizeInput.value = value],
  ['dateTimeCheckbox', () => dateTimeCheckbox.checked, (value) => dateTimeCheckbox.checked = value === 'true'],
  ['dateTimeColor', () => dateTimeColor.value, (value) => dateTimeColor.value = value || '#FFD7A8'],
  ['dateTimeFontSizeInput', () => dateTimeFontSizeInput.value, (value) => dateTimeFontSizeInput.value = value],
  ['localeInput', () => localeInput.value, (value) => localeInput.value = value],
  ['timeZoneInput', () => timeZoneInput.value, (value) => timeZoneInput.value = value || 'UTC'],
  ['reProcessCheckbox', () => reProcessCheckbox.checked, (value) => reProcessCheckbox.checked = value === 'true'],
];

const titles = {
  source: ['Step 1 of 3', 'Batch image processing'],
  options: ['Step 2 of 3', 'Choose what to do'],
  output: ['Step 3 of 3', 'Choose where to write output'],
  processing: ['Running', 'Processing images'],
  result: ['Finished', 'Processing result'],
};

function pluralizeImages(count) {
  return `${count} image${count === 1 ? '' : 's'}`;
}

function getOutputMode() {
  return overwriteRadio.checked ? 'overwrite' : 'folder';
}

function setOutputMode(value) {
  if (value === 'overwrite') {
    overwriteRadio.checked = true;
  } else {
    outputFolderRadio.checked = true;
  }
  updateOutputMode();
}

function saveSettings() {
  for (const [key, getter] of storedFields) {
    localStorage.setItem(key, String(getter()));
  }
}

function loadSettings() {
  for (const [key, , setter] of storedFields) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      setter(value);
    }
  }
}

function setScreen(name) {
  for (const [screenName, element] of Object.entries(screens)) {
    element.hidden = screenName !== name;
  }

  const [step, title] = titles[name];
  stepLabel.textContent = step;
  screenTitle.textContent = title;
  updateSummaries();
  updateControls();
}

function setWorking(nextWorking) {
  working = nextWorking;
  updateControls();
}

function updateControls() {
  const canContinueFromSource = Boolean(sourceDir) && fileCount > 0 && !working;

  folderButton.disabled = working;
  sourceActions.hidden = !canContinueFromSource;
  sourceNextButton.disabled = !canContinueFromSource;
  outputFolderButton.disabled = working || getOutputMode() !== 'folder';
  startButton.disabled = working || !sourceDir || fileCount === 0 || (getOutputMode() === 'folder' && !outputDirInput.value);
  cancelButton.disabled = !working;
  outputFolderRadio.disabled = working;
  overwriteRadio.disabled = working;
  sameFolderButton.disabled = !sourceDir || fileCount === 0;

  updateOptionDetails();
  updateOutputMode();
}

function updateOptionDetails() {
  resizeDetails.hidden = !resizeCheckbox.checked;
  dateTimeDetails.hidden = !dateTimeCheckbox.checked;
}

function updateOutputMode() {
  const folderMode = getOutputMode() === 'folder';
  outputFolderControls.hidden = !folderMode;
  overwriteNotice.hidden = folderMode;
  outputFolderButton.disabled = working || !folderMode;
}

function updateSource(message) {
  sourceDir = message.sourceDir;
  fileCount = message.fileCount;
  outputDirInput.value = message.outputDir;
  sourcePath.textContent = sourceDir;
  imageCountText.textContent = fileCount
    ? `${pluralizeImages(fileCount)} in scope`
    : 'No JPEG images found';
  sourceResult.hidden = false;
  updateSummaries();
  updateControls();
}

function showScanStarted(message) {
  sourceDir = message.sourceDir;
  fileCount = 0;
  outputDirInput.value = message.outputDir;
  sourcePath.textContent = sourceDir;
  imageCountText.textContent = 'Scanning...';
  sourceResult.hidden = false;
  updateSummaries();
  updateControls();
}

function describeActions() {
  const actions = [];
  if (resizeCheckbox.checked) {
    actions.push(`resize to ${resizeInput.value || 0}px`);
  }
  if (dateTimeCheckbox.checked) {
    actions.push('add date/time');
  }
  if (reProcessCheckbox.checked) {
    actions.push('include already processed files');
  }
  return actions.length ? actions.join(', ') : 'bake in EXIF rotation only';
}

function updateSummaries() {
  if (sourceDir) {
    optionsScopeText.textContent = `${pluralizeImages(fileCount)} selected from ${sourceDir}`;
    outputSummaryText.textContent = `${pluralizeImages(fileCount)} - ${describeActions()}`;
  } else {
    optionsScopeText.textContent = '';
    outputSummaryText.textContent = '';
  }
}

function collectOptions() {
  return {
    outputMode: getOutputMode(),
    outputDir: outputDirInput.value,
    overwriteOutput: overwriteOutputCheckbox.checked,
    resize: resizeCheckbox.checked ? Number(resizeInput.value) : 0,
    dateTime: dateTimeCheckbox.checked,
    dateTimeColor: dateTimeColor.value,
    dateTimeFontSize: Number(dateTimeFontSizeInput.value),
    locale: localeInput.value.trim(),
    timeZone: timeZoneInput.value.trim(),
    reProcess: reProcessCheckbox.checked,
  };
}

function log(message) {
  logArea.value += `${message}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

function resetProgress() {
  progressBar.value = 0;
  processingTitle.textContent = 'Preparing images';
  statusText.textContent = 'Starting';
  currentFileText.textContent = '';
}

function showResult(result) {
  const stats = result.stats || {};
  if (!result.ok) {
    resultTitle.textContent = 'Processing failed';
    resultSummary.textContent = result.error || 'The batch could not be completed.';
  } else if (stats.cancelled) {
    resultTitle.textContent = 'Processing cancelled';
    resultSummary.textContent = `Wrote ${stats.written || 0}, skipped ${stats.skipped || 0}, failed ${stats.failed || 0}.`;
  } else {
    resultTitle.textContent = 'Processing complete';
    resultSummary.textContent = `Wrote ${stats.written || 0}, skipped ${stats.skipped || 0}, failed ${stats.failed || 0}.`;
  }
  setScreen('result');
}

folderButton.addEventListener('click', async () => {
  folderButton.disabled = true;

  const result = await window.batchImageProc.pickDirectory();
  if (result.ok) {
    updateSource(result);
  } else {
    updateControls();
  }
});

sourceNextButton.addEventListener('click', () => setScreen('options'));
changeSourceButton.addEventListener('click', () => setScreen('source'));
optionsBackButton.addEventListener('click', () => setScreen('source'));
optionsNextButton.addEventListener('click', () => setScreen('output'));
editActionsButton.addEventListener('click', () => setScreen('options'));
outputBackButton.addEventListener('click', () => setScreen('options'));
newBatchButton.addEventListener('click', () => {
  sourceDir = '';
  fileCount = 0;
  sourceResult.hidden = true;
  sourcePath.textContent = '';
  imageCountText.textContent = '';
  setScreen('source');
});
sameFolderButton.addEventListener('click', () => setScreen('options'));

outputFolderButton.addEventListener('click', async () => {
  const result = await window.batchImageProc.pickOutputDirectory();
  if (result.ok) {
    outputDirInput.value = result.outputDir;
    updateControls();
  }
});

resizeCheckbox.addEventListener('change', () => {
  updateOptionDetails();
  updateSummaries();
});
resizeInput.addEventListener('input', updateSummaries);
dateTimeCheckbox.addEventListener('change', () => {
  updateOptionDetails();
  updateSummaries();
});
reProcessCheckbox.addEventListener('change', updateSummaries);
outputFolderRadio.addEventListener('change', updateOutputMode);
overwriteRadio.addEventListener('change', updateOutputMode);

startButton.addEventListener('click', async () => {
  saveSettings();
  logArea.value = '';
  resetProgress();
  setWorking(true);
  setScreen('processing');

  const result = await window.batchImageProc.startProcessing(collectOptions());
  setWorking(false);
  showResult(result);
});

cancelButton.addEventListener('click', () => {
  window.batchImageProc.cancelProcessing();
  cancelButton.disabled = true;
  statusText.textContent = 'Cancelling after the current file finishes';
});

window.batchImageProc.on('proc-dir-change', updateSource);
window.batchImageProc.on('proc-scan-start', showScanStarted);

window.batchImageProc.on('proc-log', (message) => {
  log(message);
});

window.batchImageProc.on('proc-progress', (message) => {
  const stats = message.stats || {};
  progressBar.value = message.percent;
  processingTitle.textContent = `${message.percent}% complete`;
  statusText.textContent = `Wrote ${stats.written || 0}, skipped ${stats.skipped || 0}, failed ${stats.failed || 0}`;
  currentFileText.textContent = message.file || '';
});

window.batchImageProc.on('proc-state', (message) => {
  setWorking(Boolean(message.working));
});

loadSettings();
updateOptionDetails();
updateOutputMode();
setScreen('source');
