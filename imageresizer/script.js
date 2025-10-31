const imageInput = document.getElementById('imageInput');
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const qualityInput = document.getElementById('quality');
const qualityValueSpan = document.getElementById('qualityValue');
const aspectRatioCheckbox = document.getElementById('aspectRatio');
const resizeButton = document.getElementById('resizeButton');
const resetButton = document.getElementById('resetButton');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const controls = document.getElementById('controls');
const loadingIndicator = document.getElementById('loadingIndicator');
const outputFormatSelect = document.getElementById('outputFormat');
const uploadBox = document.getElementById('uploadBox');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const filesSummary = document.getElementById('filesSummary');
const fileList = document.getElementById('fileList');

let downloadUrl = null;
let zipUrl = null;
let isDownloadMode = false;
let loadedImages = [];
let lastChangedDimension = 'width';

hideProcessingIndicator();
setQualityLabel(qualityInput.value);
initDragAndDrop();

imageInput.addEventListener('change', async () => {
  if (!imageInput.files || imageInput.files.length === 0) return;
  await handleFiles([...imageInput.files]);
});

resizeButton.addEventListener('click', async (e) => {
  if (!loadedImages.length) return;

  if (isDownloadMode) {
    e.preventDefault();
    if (loadedImages.length === 1) {
      if (!downloadUrl) return;
      const a = document.createElement('a');
      a.href = downloadUrl;
      const extension = outputFormatSelect.value.split('/')[1];
      a.download = makeOutName(loadedImages[0].name, extension);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      if (!zipUrl) return;
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = 'resized-images.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    return;
  }


  if (!loadedImages.length) return;
  const quality = parseFloat(qualityInput.value);
  const outputFormat = outputFormatSelect.value;
  hideDownloadAndPreview();
  showProcessingIndicator();
  startIndeterminateProgress();

  if (loadedImages.length === 1) {
    const entry = loadedImages[0];
    const { targetW, targetH } = computeTargetSize(entry);
    const blob = await renderToBlob(entry.img, targetW, targetH, outputFormat, quality);
    const extension = outputFormat.split('/')[1];
    const outName = makeOutName(entry.name, extension);
    const originalSize = entry.size;
    const newSize = blob.size;

    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    isDownloadMode = true;
    resizeButton.textContent = 'Download Image';
    resetButton.textContent = 'Reset';

    renderFileRows([{ name: outName, originalSize, newSize }]);
  } else {
    const zip = new JSZip();
    const results = [];
    stopIndeterminateProgress();
    updateProgress(0);

    for (let i = 0; i < loadedImages.length; i++) {
      const entry = loadedImages[i];
      const { targetW, targetH } = computeTargetSize(entry);
      updateProgress(Math.round((i / loadedImages.length) * 100), `Processing ${entry.name}`);
      const blob = await renderToBlob(entry.img, targetW, targetH, outputFormat, quality);
      const extension = outputFormat.split('/')[1];
      const outName = makeOutName(entry.name, extension);
      zip.file(outName, blob);
      results.push({ name: outName, originalSize: entry.size, newSize: blob.size 
});
}
    updateProgress(100, 'Packaging ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    zipUrl = URL.createObjectURL(zipBlob);
    isDownloadMode = true;
    resizeButton.textContent = 'Download ZIP';
    resetButton.textContent = 'Reset';
    renderFileRows(results);
  }

  hideProcessingIndicator();
  stopIndeterminateProgress();
  progressContainer.classList.add('hidden');
});

resetButton.addEventListener('click', resetState);

widthInput.addEventListener('input', () => {
  lastChangedDimension = 'width';
  if (aspectRatioCheckbox.checked && loadedImages.length) {
    const ratio = loadedImages[0].aspect;
    const newWidth = parseInt(widthInput.value);
    if (newWidth > 0) heightInput.value = Math.round(newWidth / ratio);
  }
  hideDownloadAndPreview();
});

heightInput.addEventListener('input', () => {
  lastChangedDimension = 'height';
  if (aspectRatioCheckbox.checked && loadedImages.length) {
    const ratio = loadedImages[0].aspect;
    const newHeight = parseInt(heightInput.value);
    if (newHeight > 0) widthInput.value = Math.round(newHeight * ratio);
  }
  hideDownloadAndPreview();
});

qualityInput.addEventListener('input', (e) => {
  setQualityLabel(e.target.value);
  hideDownloadAndPreview();
});

aspectRatioCheckbox.addEventListener('change', hideDownloadAndPreview);
outputFormatSelect.addEventListener('change', hideDownloadAndPreview);

async function handleFiles(files) {
  resetState();
  uploadBox.classList.add('hidden');
  showProcessingIndicator();
  startIndeterminateProgress();

  controls.classList.add('hidden');
  filesSummary.classList.add('hidden');
  fileList.innerHTML = '';

  loadedImages = [];
  for (const file of files) {
    const { dataUrl, originalType } = await readFileWithProgress(file);
    const img = await loadImage(dataUrl, file, originalType);
    loadedImages.push({
      img,
      name: file.name,
      type: img.type || file.type || originalType || 'image/jpeg',
      size: file.size,
      width: img.width,
      height: img.height,
      aspect: img.width / img.height
    });
  }

  if (loadedImages.length) {
    widthInput.value = loadedImages[0].width;
    heightInput.value = loadedImages[0].height;
    controls.classList.remove('hidden');
  }

  hideProcessingIndicator();
  stopIndeterminateProgress();
  progressContainer.classList.add('hidden');

  renderFileRows(loadedImages.map(f => ({ name: f.name, originalSize: f.size, newSize: null })));
}

function readFileWithProgress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    progressContainer.classList.remove('hidden');
    updateProgress(0, `Reading ${file.name}`);

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        updateProgress(percent, `Reading ${file.name}`);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.onload = async () => {
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        startIndeterminateProgress('Converting HEIC…');
        try {
          const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
          const dataUrl = await blobToDataURL(converted);
          stopIndeterminateProgress();
          progressContainer.classList.add('hidden');
          resolve({ dataUrl, originalType: 'image/heic' });
        } catch (e) {
          stopIndeterminateProgress();
          reject(e);
        }
      } else {
        resolve({ dataUrl: reader.result, originalType: file.type });
      }
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl, file, originalType) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
    img.type = originalType || file.type;
  });
}

function computeTargetSize(entry) {
  let targetW = parseInt(widthInput.value);
  let targetH = parseInt(heightInput.value);
  const ratio = entry.aspect;

  if (aspectRatioCheckbox.checked) {
    if (lastChangedDimension === 'width' && targetW > 0) {
      targetH = Math.round(targetW / ratio);
    } else if (lastChangedDimension === 'height' && targetH > 0) {
      targetW = Math.round(targetH * ratio);
    } else {
      targetH = Math.round(targetW / ratio);
    }
  }
  return { targetW: Math.max(1, targetW || 1), targetH: Math.max(1, targetH || 1) };
}

function renderToBlob(img, w, h, type, quality) {
  return new Promise((resolve) => {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    startIndeterminateProgress('Encoding…');
    canvas.toBlob((blob) => {
      stopIndeterminateProgress();
      resolve(blob);
    }, type, quality);
  });
}

function hideDownloadAndPreview() {
  if (isDownloadMode) {
    resetDownloadState();
  }
  resetButton.textContent = 'Back';
  canvas.classList.remove('is-visible');
  canvas.classList.add('hidden');
}

function showProcessingIndicator(text) {
  if (text) loadingIndicator.textContent = text;
  loadingIndicator.classList.remove('hidden');
}

function hideProcessingIndicator() {
  loadingIndicator.classList.add('hidden');
}

function resetDownloadState() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
  if (zipUrl) {
    URL.revokeObjectURL(zipUrl);
    zipUrl = null;
  }
  isDownloadMode = false;
  resizeButton.textContent = 'Resize & Compress';
  resetButton.textContent = 'Back';
}

function resetState() {
  stopIndeterminateProgress();
  resetDownloadState();
  hideProcessingIndicator();
  controls.classList.add('hidden');
  filesSummary.classList.add('hidden');
  uploadBox.classList.remove('hidden');
  imageInput.value = '';
  canvas.classList.remove('is-visible');
  canvas.classList.add('hidden');
  loadedImages = [];
  progressContainer.classList.add('hidden');
  updateProgress(0);
  progressContainer.classList.add('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = '';
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function setQualityLabel(val) {
  const percent = Math.round((parseFloat(val) || 0) * 100);
  qualityValueSpan.textContent = `${percent}%`;
  qualityInput.style.setProperty('--percent', `${percent}%`);
}

function updateProgress(percent, text) {
  if (percent <= 0 && !text) {
    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', 0);
    progressText.textContent = '';
    return;
  }
  progressContainer.classList.remove('hidden');
  progressBar.style.width = `${percent}%`;
  progressBar.setAttribute('aria-valuenow', percent);
  progressText.textContent = `${percent}%${text ? ' • ' + text : ''}`;
}

let indeterminateTimer = null;
function startIndeterminateProgress(text) {
  progressContainer.classList.remove('hidden');
  progressBar.classList.add('indeterminate');
  if (text) progressText.textContent = text;
  if (indeterminateTimer) clearInterval(indeterminateTimer);
  let dots = 0;
  indeterminateTimer = setInterval(() => {
    dots = (dots + 1) % 4;
    progressText.textContent = (text || 'Processing') + '.'.repeat(dots);
  }, 400);
}

function stopIndeterminateProgress() {
  progressBar.classList.remove('indeterminate');
  progressText.textContent = ' ';
  if (indeterminateTimer) {
    clearInterval(indeterminateTimer);
    indeterminateTimer = null;
  }
}

function renderFileRows(rows) {
  filesSummary.classList.remove('hidden');
  fileList.innerHTML = '';
  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'file-row';
    const sizeText = row.newSize != null
      ? savingText(row.originalSize, row.newSize)
      : `${formatBytes(row.originalSize)}`;
    div.innerHTML = `
      <span class="file-name" title="${row.name}">${row.name}</span>
      <span class="file-sizes">${sizeText}</span>
    `;
    fileList.appendChild(div);
  });
}

function savingText(orig, now) {
  const diff = orig - now;
  const pct = orig > 0 ? Math.round((diff / orig) * 100) : 0;
  const sign = diff >= 0 ? 'smaller' : 'larger';
  return `${formatBytes(now)} / ${formatBytes(orig)} • ${Math.abs(pct)}% ${sign}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function makeOutName(name, extensionNoSlash) {
  const base = name.replace(/\.[^/.]+$/, '');
  return `${base}_resized.${extensionNoSlash}`;
}

function initDragAndDrop() {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => uploadBox.classList.add('is-dragover'));
  });
  ['dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => uploadBox.classList.remove('is-dragover'));
  });
  uploadBox.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;
    const files = [...dt.files].filter(f => /^image\//.test(f.type) || f.name.toLowerCase().endsWith('.heic'));
    if (files.length === 0) return;
    await handleFiles(files);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  qualityInput.dispatchEvent(new Event('input'));
});