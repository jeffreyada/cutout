import { removeBackground } from '@imgly/background-removal';
import './style.css';


const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const dzIdle = document.getElementById('dzIdle');
const dzWorking = document.getElementById('dzWorking');
const dzResult = document.getElementById('dzResult');
const statusText = document.getElementById('statusText');
const barFill = document.getElementById('barFill');
const firstRunHint = document.getElementById('firstRunHint');
const resultImg = document.getElementById('resultImg');
const actions = document.getElementById('actions');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const errorText = document.getElementById('errorText');

let currentUrl = null;
let currentFilename = 'cutout.png';
let modelWarmed = false;

function showState(state) {
  dzIdle.classList.toggle('hidden', state !== 'idle');
  dzWorking.classList.toggle('hidden', state !== 'working');
  dzResult.classList.toggle('hidden', state !== 'result');
  actions.classList.toggle('hidden', state !== 'result');
  errorText.classList.add('hidden');
}

function setProgress(pct, label) {
  barFill.classList.remove('indeterminate');
  barFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  if (label) statusText.textContent = label;
}

function setIndeterminate(label) {
  barFill.classList.add('indeterminate');
  if (label) statusText.textContent = label;
}

async function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    errorText.textContent = "That doesn't look like an image — try a JPG, PNG, or WebP.";
    errorText.classList.remove('hidden');
    return;
  }

  currentFilename = 'cutout-' + file.name.replace(/\.[^.]+$/, '') + '.png';
  showState('working');
  setProgress(0, 'Loading the model…');
  firstRunHint.classList.toggle('hidden', modelWarmed);

  try {
    const blob = await removeBackground(file, {
      progress: (key, current, total) => {
        modelWarmed = true;
        if (total > 0) {
          const pct = (current / total) * 100;
          if (key && key.toLowerCase().includes('fetch')) {
            setProgress(pct, 'Downloading the model… ' + Math.round(pct) + '%');
          } else {
            setProgress(pct, 'Removing the background…');
          }
        } else {
          setIndeterminate('Removing the background…');
        }
      },
    });

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    resultImg.src = currentUrl;
    showState('result');
  } catch (err) {
    console.error(err);
    showState('idle');
    errorText.textContent = 'Something went wrong removing the background. Mind trying again?';
    errorText.classList.remove('hidden');
  }
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processFile(file);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

downloadBtn.addEventListener('click', () => {
  if (!currentUrl) return;
  const a = document.createElement('a');
  a.href = currentUrl;
  a.download = currentFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

resetBtn.addEventListener('click', () => {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
  showState('idle');
});
