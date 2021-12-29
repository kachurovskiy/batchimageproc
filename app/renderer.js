const folderButton = document.getElementById('folderButton');
const startButton = document.getElementById('startButton');
const logArea = document.getElementById('logArea');
const logContainer = document.getElementById('logContainer');
const resizeCheckbox = document.getElementById('resizeCheckbox');
const resizeInput = document.getElementById('resizeInput');
const dateTimeCheckbox = document.getElementById('dateTimeCheckbox');
const invisibleContainer = document.getElementById('invisibleContainer');

logContainer.style.display = 'none';

folderButton.addEventListener('click', () => {
  window.api.ipcRendererSend('proc-pick-dir', {});
});

window.api.ipcRendererOn('proc-dir-change', (event, message) => {
  folderButton.innerText = message.dir + ' (' + message.fileCount + ' images)';
  if (message.fileCount) {
    delete startButton.removeAttribute('disabled');
  }
});

startButton.addEventListener('click', () => {
  logArea.value = '';
  logContainer.style.display = 'block';
  window.api.ipcRendererSend('proc-start', {
    resize: resizeCheckbox.checked ? Number(resizeInput.value) : 0,
    dateTime: dateTimeCheckbox.checked,
    reProcess: reProcessCheckbox.checked,
  });
});

window.api.ipcRendererOn('proc-log', (event, message) => {
  log(message);
});

function log(message) {
  logArea.value += message + '\n';
  logArea.scrollTop = logArea.scrollHeight;
}

window.api.ipcRendererOn('proc-text-to-png', async (event, message) => {
  const element = document.createElement('div');
  element.style.color = 'white';
  element.style.width = '200px';
  element.style.fontFamily = 'Verdana';
  element.style.textAlign = 'right';
  element.style.padding = '6px';
  element.innerText = String(message);
  invisibleContainer.appendChild(element);
  const canvas = await html2canvas(element, {backgroundColor: null});
  element.remove();
  canvas.toBlob(async (blob) => {
    window.api.ipcRendererSend('proc-text-as-png', {
      buffer: new Uint8Array(await blob.arrayBuffer()),
    });
  });
});
