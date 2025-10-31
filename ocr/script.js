const imageInput = document.getElementById('imageInput');
const languageSelect = document.getElementById('languageSelect');
const extractButton = document.getElementById('extractButton');
const copyButton = document.getElementById('copyButton');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');
const controlsDiv = document.getElementById('controls');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');
const extractedTextP = document.getElementById('extractedText');
const container = document.querySelector('.container');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

const MAX_BYTES = 100 * 1024 * 1024;
const OK_TYPES = new Set([
  'image/png','image/jpeg','image/webp','image/heic','image/heif','image/gif','image/bmp'
]);

function isSecure() {
  return window.isSecureContext === true && (location.protocol === 'https:' || location.hostname === 'localhost');
}

['dragenter', 'dragover'].forEach(evt =>
  container.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    container.classList.add('dragover');
  })
);

['dragleave', 'drop'].forEach(evt =>
  container.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    if (evt === 'drop') {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) { container.classList.remove('dragover'); return; }
      const f = dt.files[0];
      if (!validateFile(f)) { killSwitch(); return; }
      imageInput.files = dt.files;
      primeUIForRun();
    }
    container.classList.remove('dragover');
  })
);

imageInput.addEventListener('change', () => {
  if (imageInput.files[0]) {
    if (!validateFile(imageInput.files[0])) { killSwitch(); return; }
    primeUIForRun();
  }
});

function primeUIForRun() {
  controlsDiv.classList.remove('hidden');
  resultDiv.classList.add('hidden');
  loadingDiv.classList.add('hidden');
  container.classList.remove('expanded');
}

function validateFile(file) {
  if (!file) return false;

  const isHeic = /\.hei(c|f)$/i.test(file.name);
  if (!OK_TYPES.has(file.type) && !isHeic) {
    toast('Unsupported file type. Please use a common image format.');
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast('Image is too large (max 100 MB).');
    return false;
  }
  return true;
}

async function downscaleIfNeeded(file, maxW = 2000, maxH = 2000) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(maxW / bmp.width, maxH / bmp.height, 1);
    if (scale >= 1) return file;

    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d', { alpha: false });
    ctx.drawImage(bmp, 0, 0, c.width, c.height);

    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.(heic|heif|png|webp|bmp|gif|jpg|jpeg)$/i, '') + '-scaled.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function setProgress(status, progress) {
  const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
  progressBar.style.width = `${pct}%`;
  progressBar.parentElement.setAttribute('aria-valuenow', String(pct));
  progressText.textContent = `${status} (${pct}%)`;
}

let worker = null;
let currentLang = 'eng';
let workerReady = false;
let isRunning = false;
let readerRef = null;
let runToken = 0;

async function preloadWorker() {
  worker = await Tesseract.createWorker({
    logger: m => {
      if (m && typeof m.progress === 'number' && m.status) {
        setProgress(m.status, m.progress);
      }
    }
  });
  try {
    await worker.loadLanguage(currentLang);
    await worker.initialize(currentLang);
    workerReady = true;
    setProgress('Ready', 0);
  } catch (e) {
    console.error('Failed to preload worker', e);
  }
}

preloadWorker();

extractButton.addEventListener('click', async () => {
  if (isRunning) return;
  if (!imageInput.files[0]) { toast('Please choose an image first.'); return; }
  await performOCR(imageInput.files[0], languageSelect.value);
});

async function performOCR(file, lang) {
  if (!validateFile(file)) { killSwitch(); return; }

  isRunning = true;
  extractButton.disabled = true;

  controlsDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');
  setProgress('Preparing', 0);

  try {
    let imageFile = file;

    if (/\.hei(c|f)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif') {
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      imageFile = new File([blob], file.name.replace(/\.hei(c|f)$/i, ".jpg"), { type: "image/jpeg" });
    }

    imageFile = await downscaleIfNeeded(imageFile);

    const reader = new FileReader();
    readerRef = reader;
    const token = ++runToken;

    reader.onload = () => {
      if (token !== runToken) return;
      runTesseract(reader.result, lang, token);
    };
    reader.onerror = () => { throw new Error('FileReader failed'); };
    reader.readAsDataURL(imageFile);

  } catch (err) {
    console.error("Image processing failed:", err);
    toast("Failed to process the image.");
    finalizeRun();
    await resetState();
  }
}

async function runTesseract(imageDataUrl, lang, token) {
  try {
    if (!worker) await preloadWorker();

    if (lang !== currentLang) {
      await worker.loadLanguage(lang);
      await worker.initialize(lang);
      currentLang = lang;
    }

    const { data: { text } } = await worker.recognize(imageDataUrl);

    if (token !== runToken) return;

    extractedTextP.textContent = text || "No text found.";
    resultDiv.classList.remove('hidden');
    container.classList.add('expanded');

    imageInput.value = '';

  } catch (err) {
    console.error("OCR error:", err);
    toast("Oops! Text extraction failed. Please try a different image.");
  } finally {
    if (token === runToken) finalizeRun();
  }
}

function finalizeRun() {
  loadingDiv.classList.add('hidden');
  isRunning = false;
  extractButton.disabled = false;
  setProgress('Ready', 0);
  readerRef = null;
}

copyButton?.addEventListener('click', async () => {
  if (!isSecure()) { toast('Copy requires HTTPS (secure context).'); return; }
  try {
    const text = extractedTextP.textContent || '';
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "Copied!";
    copyButton.disabled = true;
    setTimeout(() => {
      copyButton.textContent = "Copy Text";
      copyButton.disabled = false;
    }, 2000);
  } catch (err) {
    console.error("Copy failed", err);
    toast("Copying text failed.");
  }
});

downloadButton?.addEventListener('click', () => {
  const text = extractedTextP.textContent || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `extracted-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

async function resetState() {
  runToken++;

  try { readerRef?.abort(); } catch {}

  try { await worker?.terminate(); } catch {}
  worker = null;
  workerReady = false;
  currentLang = 'eng';

  imageInput.value = '';
  languageSelect.selectedIndex = 0;
  controlsDiv.classList.add('hidden');
  resultDiv.classList.add('hidden');
  loadingDiv.classList.add('hidden');
  extractedTextP.textContent = '';
  container.classList.remove('expanded');
  setProgress('Ready', 0);

  isRunning = false;
  extractButton.disabled = false;

  await preloadWorker();
}

resetButton?.addEventListener('click', () => { resetState(); });

function killSwitch() {
  imageInput.value = '';
  setProgress('Ready', 0);
  toast('File rejected for safety. Please choose a valid image.');
}

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.bottom = '20px';
  t.style.left = '50%';
  t.style.transform = 'translateX(-50%)';
  t.style.padding = '10px 14px';
  t.style.background = 'rgba(0,0,0,0.85)';
  t.style.color = '#fff';
  t.style.borderRadius = '8px';
  t.style.zIndex = '9999';
  t.style.maxWidth = '90vw';
  t.style.textAlign = 'center';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}