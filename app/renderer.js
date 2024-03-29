const folderButton = document.getElementById('folderButton');
const startButton = document.getElementById('startButton');
const logArea = document.getElementById('logArea');
const logContainer = document.getElementById('logContainer');
const resizeCheckbox = document.getElementById('resizeCheckbox');
const resizeInput = document.getElementById('resizeInput');
const dateTimeCheckbox = document.getElementById('dateTimeCheckbox');
const reProcessCheckbox = document.getElementById('reProcessCheckbox');
const invisibleContainer = document.getElementById('invisibleContainer');
const dateTimeColor = document.getElementById('dateTimeColor');
const dateTimeFontSizeInput = document.getElementById('dateTimeFontSizeInput');

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

if (localStorage.getItem('resizeInput')) {
  resizeCheckbox.checked = localStorage.getItem('resizeCheckbox') == 'true';
  resizeInput.value = localStorage.getItem('resizeInput');
  dateTimeCheckbox.checked = localStorage.getItem('dateTimeCheckbox') == 'true';
  dateTimeColor.value = localStorage.getItem('dateTimeColor');
  dateTimeFontSizeInput.value = localStorage.getItem('dateTimeFontSizeInput');
  reProcessCheckbox.checked = localStorage.getItem('reProcessCheckbox') == 'true';
}

startButton.addEventListener('click', () => {
  localStorage.setItem('resizeCheckbox', resizeCheckbox.checked);
  localStorage.setItem('resizeInput', resizeInput.value);
  localStorage.setItem('dateTimeCheckbox', dateTimeCheckbox.checked);
  localStorage.setItem('dateTimeColor', dateTimeColor.value);
  localStorage.setItem('dateTimeFontSizeInput', dateTimeFontSizeInput.value);
  localStorage.setItem('reProcessCheckbox', reProcessCheckbox.checked);

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
  try {
    const element = document.createElement('div');
    element.style.color = dateTimeColor.value;
    element.style.fontFamily = 'Verdana';
    element.style.fontSize = dateTimeFontSizeInput.value + 'px';
    element.style.textAlign = 'right';
    element.style.padding = '6px';
    element.innerText = String(message);
    invisibleContainer.appendChild(element);
    const canvas = await html2canvas(element, {backgroundColor: null});
    canvas.toBlob(async (blob) => {
      window.api.ipcRendererSend('proc-text-as-png', {
        buffer: new Uint8Array(await blob.arrayBuffer()),
      });
    });
    element.remove();
  } catch (e) {
    window.api.ipcRendererSend('proc-text-as-png', {});
  }
});
