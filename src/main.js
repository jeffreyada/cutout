import { removeBackground, preload } from '@imgly/background-removal';
import './style.css';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 2048;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MODEL = 'isnet_fp16';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const dzIdle = document.getElementById('dzIdle');
const dzWorking = document.getElementById('dzWorking');
const dzResult = document.getElementById('dzResult');
const statusText = document.getElementById('statusText');
const elapsedText = document.getElementById('elapsedText');
const barFill = document.getElementById('barFill');
const firstRunHint = document.getElementById('firstRunHint');
const resultImg = document.getElementById('resultImg');
const actions = document.getElementById('actions');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const errorText = document.getElementById('errorText');

let state = 'idle';
let busy = false;
let currentUrl = null;
let currentFilename = 'cutout.png';
let modelReady = false;
let dragDepth = 0;
let timerId = null;
let preloadStarted = false;
let configPromise = null;

function showState(next) {
  state = next;
  dzIdle.classList.toggle('hidden', next !== 'idle');
  dzWorking.classList.toggle('hidden', next !== 'working');
  dzResult.classList.toggle('hidden', next !== 'result');
  actions.classList.toggle('hidden', next !== 'result');
  hideError();
}

function showError(message) {
  errorText.textContent = message;
  errorText.classList.remove('hidden');
}

function hideError() {
  errorText.classList.add('hidden');
}

function setFirstRunHint(visible) {
  firstRunHint.style.display = visible ? '' : 'none';
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

function startTimer() {
  stopTimer();
  const started = Date.now();
  elapsedText.textContent = 'Elapsed: 0s';
  timerId = setInterval(() => {
    const secs = Math.round((Date.now() - started) / 1000);
    elapsedText.textContent = 'Elapsed: ' + secs + 's';
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

async function detectConfig() {
  const forced = new URLSearchParams(location.search).get('device');
  let device = forced === 'cpu' || forced === 'gpu' ? forced : 'cpu';
  if (!forced) {
    try {
      if (navigator.gpu && (await navigator.gpu.requestAdapter())) device = 'gpu';
    } catch {
      device = 'cpu';
    }
  }
  console.info('[cutout] device:', device, '| crossOriginIsolated:', self.crossOriginIsolated);
  return { device, model: MODEL };
}

function getConfig() {
  if (!configPromise) configPromise = detectConfig();
  return configPromise;
}

async function warmUp() {
  if (preloadStarted) return;
  preloadStarted = true;
  try {
    await preload(await getConfig());
    modelReady = true;
  } catch (err) {
    console.warn('[cutout] preload failed', err);
    preloadStarted = false;
  }
}

function validate(file) {
  if (!file) return 'No file was received.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please use a JPG, PNG, or WebP photo.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'That photo is larger than 25 MB. Try a smaller version.';
  return null;
}

async function prepareImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_EDGE / longEdge);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.95));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('Could not prepare the image');
  return { input: blob, scaled: scale < 1, width: w, height: h };
}

async function opaqueRatio(blob) {
  const size = 64;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, size, size);
  bmp.close();
  const data = ctx.getImageData(0, 0, size, size).data;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 24) opaque++;
  }
  return opaque / (size * size);
}

function describeError(err, stage) {
  const text = String((err && err.message) || err || '');
  const isRange = err && err.name === 'RangeError';
  if (stage === 'prepare') {
    if (isRange) return 'This photo is too large for your device to open. Try a smaller one.';
    return 'This file could not be read as an image. It may be damaged.';
  }
  if (!navigator.onLine) {
    return 'You appear to be offline. The first run needs a connection to download the model. Reconnect and try again.';
  }
  if (isRange || /memory|allocation|out of/i.test(text)) {
    return 'Your device ran out of memory on this photo. Try a smaller one.';
  }
  if (/fetch|network|resource/i.test(text)) {
    return 'The model could not be downloaded. Check your connection and try again.';
  }
  return 'Something went wrong removing the background. Please try again.';
}

async function processFile(file, extraNote) {
  if (busy) {
    showError('Still working on your current photo. Please wait for it to finish.');
    return;
  }

  const problem = validate(file);
  if (problem) {
    showError(problem);
    return;
  }

  busy = true;
  currentFilename = 'cutout-' + file.name.replace(/\.[^.]+$/, '') + '.png';
  const notes = [];
  if (extraNote) notes.push(extraNote);
  let stage = 'prepare';
  let computing = false;

  showState('working');
  setIndeterminate('Preparing your photo…');
  elapsedText.textContent = '';
  setFirstRunHint(!modelReady);

  try {
    const t0 = performance.now();
    const prepared = await prepareImage(file);
    const t1 = performance.now();
    if (prepared.scaled) {
      notes.push('Photos larger than ' + MAX_EDGE + ' px are reduced to that size for speed.');
    }

    stage = 'remove';
    setProgress(0, 'Loading the model…');
    const config = await getConfig();

    const blob = await removeBackground(prepared.input, {
      ...config,
      progress: (key, current, total) => {
        if (key && key.toLowerCase().includes('fetch')) {
          if (total > 0) {
            const pct = (current / total) * 100;
            setProgress(pct, 'Downloading the model… ' + Math.round(pct) + '%');
          }
        } else if (!computing) {
          computing = true;
          setFirstRunHint(false);
          setIndeterminate('Removing the background…');
          startTimer();
        }
      },
    });
    const t2 = performance.now();

    console.info(
      '[cutout] timings',
      JSON.stringify({
        prepareMs: Math.round(t1 - t0),
        removeBackgroundMs: Math.round(t2 - t1),
        originalBytes: file.size,
        sentBytes: prepared.input.size,
        sentPx: prepared.width + 'x' + prepared.height,
        device: config.device,
        model: config.model,
        isolated: self.crossOriginIsolated,
      })
    );

    modelReady = true;
    stopTimer();

    let ratio = 1;
    try {
      ratio = await opaqueRatio(blob);
    } catch (checkErr) {
      console.error(checkErr);
    }
    if (ratio < 0.01) {
      notes.push('No clear subject was found, so the result is mostly empty. Cutout works best on photos with a distinct subject.');
    }

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    resultImg.src = currentUrl;
    showState('result');
    if (notes.length) showError(notes.join(' '));
    downloadBtn.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    stopTimer();
    showState('idle');
    showError(describeError(err, stage));
    dzIdle.focus({ preventScroll: true });
  } finally {
    stopTimer();
    busy = false;
  }
}

function handleFiles(fileList) {
  const files = fileList ? Array.from(fileList) : [];
  if (files.length === 0) return false;
  const note = files.length > 1 ? 'Only the first photo was used. Cutout handles one photo at a time.' : '';
  processFile(files[0], note);
  return true;
}

['pointerenter', 'focusin', 'click'].forEach((evt) => {
  dropzone.addEventListener(evt, warmUp);
});

dzIdle.addEventListener('click', () => {
  if (state === 'idle') fileInput.click();
});

dzIdle.addEventListener('keydown', (e) => {
  if (state !== 'idle') return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

dropzone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  dropzone.classList.add('dragging');
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});

dropzone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropzone.classList.remove('dragging');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove('dragging');
  const ok = handleFiles(e.dataTransfer && e.dataTransfer.files);
  if (!ok) {
    showError('Please drop an image file from your device, not a web link. Save the image first, then drop it here.');
  }
});

['dragover', 'drop'].forEach((evt) => {
  window.addEventListener(evt, (e) => e.preventDefault());
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
  resultImg.removeAttribute('src');
  showState('idle');
  dzIdle.focus({ preventScroll: true });
});
