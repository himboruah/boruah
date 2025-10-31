let generatedPDFs = [];
let isDownloadReady = false;
let currentMode = 'single';
let orderedFiles = [];
let groupStrategy = 'none';

const convertButton = document.getElementById('convertButton');
const resetButton = document.getElementById('resetButton');
const imageInput = document.getElementById('imageInput');
const modeRadios = document.getElementsByName('pdfMode');
const previewContainer = document.getElementById('previewContainer');
const arrangeHeading = document.getElementById('arrangeHeading');
const slider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const processingEl = document.getElementById('processingMessage');
const fileLabelText = document.getElementById('fileLabelText');
const controlsDiv = document.getElementById('controls');
const qualityGroup = document.querySelector('.quality-group');
const dropOverlay = document.getElementById('dropOverlay');
const ariaLive = document.getElementById('ariaLive');
const batchSelect = document.getElementById('batchSelect');
const protectCheckbox = document.getElementById('protectCheckbox');
const passwordInput = document.getElementById('passwordInput');

slider.addEventListener('input', () => {
  qualityValue.textContent = slider.value;
});

Array.from(modeRadios).forEach(r => r.addEventListener('change', resetDownloadState));
batchSelect.addEventListener('change', () => {
  groupStrategy = batchSelect.value;
  resetDownloadState();
});
slider.addEventListener('change', resetDownloadState);
protectCheckbox.addEventListener('change', () => {
  passwordInput.disabled = !protectCheckbox.checked;
  if (!protectCheckbox.checked) passwordInput.value = '';
  resetDownloadState();
});
passwordInput.addEventListener('input', resetDownloadState);

function announce(msg) {
  ariaLive.textContent = '';
  setTimeout(() => (ariaLive.textContent = msg), 50);
}

imageInput.addEventListener('change', async () => {
  if (!imageInput.files?.length) return;
  const files = Array.from(imageInput.files)
    .filter(f => f.type.startsWith('image/') || /\.heic$/i.test(f.name));
  if (!files.length) return;
  await ingestFiles(files, { preservePaths: false });
  imageInput.value = '';
  fileLabelText.textContent = 'Add more files or drop them';
});

let dragCounter = 0;

document.addEventListener('dragenter', e => {
  e.preventDefault(); e.stopPropagation();
  if (dragCounter === 0) dropOverlay.classList.remove('hidden');
  dragCounter++;
});

document.addEventListener('dragover', e => {
  e.preventDefault(); e.stopPropagation();
});

document.addEventListener('dragleave', e => {
  e.preventDefault(); e.stopPropagation();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) dropOverlay.classList.add('hidden');
});

document.addEventListener('drop', async e => {
  e.preventDefault(); e.stopPropagation();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');

  const items = e.dataTransfer?.items;
  if (!items) return;

  processingEl.classList.remove('hidden');
  const files = await collectDroppedFiles(items);
  const valid = files.filter(f => f.type.startsWith('image/') || /\.heic$/i.test(f.name));
  if (valid.length) await ingestFiles(valid, { preservePaths: true });
  processingEl.classList.add('hidden');
});

async function collectDroppedFiles(items) {
  const promises = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.() || null;
    if (entry) promises.push(traverseEntry(entry));
    else {
      const file = item.getAsFile?.();
      if (file) promises.push(Promise.resolve([file]));
    }
  }
  const nested = await Promise.all(promises);
  return nested.flat();
}

function traverseEntry(entry, path = '') {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file(file => {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path ? `${path}/${file.name}` : file.name,
          configurable: true
        });
        resolve([file]);
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const base = path ? `${path}/${entry.name}` : entry.name;

      const readBatch = () => {
        reader.readEntries(async entries => {
          if (!entries.length) return resolve(all.flat());
          const results = await Promise.all(entries.map(e => traverseEntry(e, base)));
          all.push(...results);
          readBatch();
        });
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

async function ingestFiles(newFiles, { preservePaths = false } = {}) {
  const startIndex = orderedFiles.length;
  processingEl.classList.remove('hidden');

  const shells = newFiles.map((file, i) => renderShellPreview(file, startIndex + i));

  for (let i = 0; i < newFiles.length; i++) {
    let file = newFiles[i];
    const shell = shells[i];

    try {
      setStatus(shell, 'reading');

      if (file.name.toLowerCase().endsWith('.heic')) {
        setStatus(shell, 'heic → jpg');
        try {
          const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
          file = new File([converted], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (err) {
          console.error('HEIC convert failed:', err);
          setStatus(shell, 'error');
          continue;
        }
      }

      const meta = {
        folder: extractFolder(file),
        dateKey: await extractDateKey(file)
      };
      file._meta = meta;

      await finalizePreviewShell(shell, file);
      orderedFiles.push(file);
      announce(`Added ${file.name}`);
    } catch (e) {
      console.error(e);
      setStatus(shell, 'error');
    }
  }

  processingEl.classList.add('hidden');
  if (orderedFiles.length > 0) {
    arrangeHeading.classList.remove('hidden');
    controlsDiv.classList.remove('hidden');
    qualityGroup.classList.remove('hidden');
  }
  resetDownloadState();
  convertButton.disabled = false;
}

function renderShellPreview(file, index) {
  const div = document.createElement('div');
  div.className = 'preview-item';
  div.dataset.index = index;

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  div.appendChild(spinner);

  const badge = document.createElement('div');
  badge.className = 'status-badge';
  badge.textContent = 'waiting';
  div.appendChild(badge);

  const del = createDeleteButton(div);
  div.appendChild(del);

  previewContainer.appendChild(div);

  if (!previewContainer.classList.contains('sortable-initialized')) {
    Sortable.create(previewContainer, {
      animation: 150,
      onEnd: () => {
        syncOrderFromDOM();
        resetDownloadState();
      }
    });
    previewContainer.classList.add('sortable-initialized');
  }
  return div;
}

function setStatus(div, text) {
  const badge = div.querySelector('.status-badge');
  if (badge) badge.textContent = text;
}

async function finalizePreviewShell(div, file) {
  setStatus(div, 'thumb');
  const imgEl = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    imgEl.onload = () => res();
    imgEl.onerror = rej;
    imgEl.src = url;
  });
  const spinner = div.querySelector('.spinner');
  spinner?.remove();
  div.insertBefore(imgEl, div.firstChild);
  setStatus(div, 'ready');

  div.fileRef = file;
  div.dataset.thumbUrl = url;
}

function createDeleteButton(div) {
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.onclick = () => {
    const name = div.fileRef?.name || 'image';
    div.classList.add('fade-out');
    setTimeout(() => {
      const idxToRemove = orderedFiles.indexOf(div.fileRef);
      if (idxToRemove > -1) orderedFiles.splice(idxToRemove, 1);
      const t = div.dataset.thumbUrl;
      if (t) URL.revokeObjectURL(t);
      div.remove();
      syncOrderFromDOM();
      resetDownloadState();
      announce(`Removed ${name}`);
      if (orderedFiles.length === 0) resetButton.click();
    }, 300);
  };
  return deleteBtn;
}

function updateIndices() {
  const items = previewContainer.querySelectorAll('.preview-item');
  items.forEach((item, i) => (item.dataset.index = i));
}

function getSelectedMode() {
  return Array.from(modeRadios).find(r => r.checked)?.value || 'single';
}

function resetDownloadState() {
  generatedPDFs.forEach(entry => {
    if (typeof entry === 'string') {
      URL.revokeObjectURL(entry);
    } else if (entry?.url) {
      URL.revokeObjectURL(entry.url);
    }
  });
  generatedPDFs = [];
  isDownloadReady = false;
  convertButton.textContent = 'Convert to PDF';
  convertButton.classList.remove('download-ready');
  convertButton.disabled = false;
}

function syncOrderFromDOM() {
  const items = previewContainer.querySelectorAll('.preview-item');
  orderedFiles = Array.from(items).map(item => item.fileRef).filter(Boolean);
  updateIndices();
}

function loadImageBlob(file, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          blob => {
            const url = URL.createObjectURL(blob);
            resolve({ blobUrl: url, width: img.width, height: img.height });
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function buildSmartName() {
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const count = orderedFiles.length;
  const first = orderedFiles[0]?.name?.replace(/\.[^/.]+$/, '') || 'photos';
  const last = orderedFiles[count - 1]?.name?.replace(/\.[^/.]+$/, '') || '';
  const base =
    count > 1 && first !== last ? `${first}—${last}` :
    count > 0 ? first : 'photos';
  return `${base}_${date}.pdf`;
}

function extractFolder(file) {
  const p = file.webkitRelativePath || '';
  if (!p) return '';
  const parts = p.split('/');
  return parts.length > 1 ? parts[0] : '';
}
async function extractDateKey(file) {
  const d = new Date(file.lastModified || Date.now());
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function groupFiles(files, strategy) {
  if (strategy === 'folder') {
    const map = new Map();
    for (const f of files) {
      const key = f._meta?.folder || '(root)';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return map;
  }
  if (strategy === 'date') {
    const map = new Map();
    for (const f of files) {
      const key = f._meta?.dateKey || 'unknown-date';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return map;
  }
  return new Map([['all', files]]);
}

convertButton.addEventListener('click', async () => {
  if (!orderedFiles.length) return;

  syncOrderFromDOM();
  currentMode = getSelectedMode();
  groupStrategy = batchSelect.value;
  const quality = parseFloat((parseInt(slider.value) / 100).toFixed(2));

  const wantProtection = protectCheckbox.checked;
  const password = wantProtection ? (passwordInput.value || '') : '';
  if (wantProtection && password.trim() === '') {
    alert('Please enter a password or uncheck "Protect with password".');
    return;
  }

  const { jsPDF } = window.jspdf;

  if (isDownloadReady && generatedPDFs.length) {
    if (currentMode === 'single') {
      const link = document.createElement('a');
      const { url } = generatedPDFs[0];
      link.href = url;
      link.download = buildSmartName();
      link.click();
    } else {
      for (let i = 0; i < generatedPDFs.length; i++) {
        const { url, name } = generatedPDFs[i];
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        await new Promise(r => setTimeout(r, 60));
      }
    }
    resetDownloadState();
    return;
  }

  convertButton.textContent = 'Converting...';
  convertButton.disabled = true;

  try {
    if (currentMode === 'multiple') {
      const results = [];

      if (groupStrategy === 'none') {
        for (const file of orderedFiles) {
          const d = await loadImageBlob(file, quality);
          const pdf = new jsPDF({
            orientation: d.width > d.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [d.width, d.height],
            ...(wantProtection ? { encryption: {
              userPassword: password,
              ownerPassword: password,
              userPermissions: ['print', 'copy', 'modify', 'annot-forms']
            }} : {})
          });
          pdf.addImage(d.blobUrl, 'JPEG', 0, 0, d.width, d.height);
          URL.revokeObjectURL(d.blobUrl);

          const base = file.name.replace(/\.[^/.]+$/, '');
          results.push({ url: pdf.output('bloburl'), name: `${base}.pdf` });
        }
      } else {
        const grouped = groupFiles(orderedFiles, groupStrategy);
        for (const [key, files] of grouped.entries()) {
          if (!files.length) continue;

          const first = await loadImageBlob(files[0], quality);
          const pdf = new jsPDF({
            orientation: first.width > first.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [first.width, first.height],
            ...(wantProtection ? { encryption: {
              userPassword: password,
              ownerPassword: password,
              userPermissions: ['print', 'copy', 'modify', 'annot-forms']
            }} : {})
          });
          pdf.addImage(first.blobUrl, 'JPEG', 0, 0, first.width, first.height);
          URL.revokeObjectURL(first.blobUrl);

          for (let i = 1; i < files.length; i++) {
            const d = await loadImageBlob(files[i], quality);
            pdf.addPage([d.width, d.height], d.width > d.height ? 'landscape' : 'portrait');
            pdf.addImage(d.blobUrl, 'JPEG', 0, 0, d.width, d.height);
            URL.revokeObjectURL(d.blobUrl);
          }

          const base = groupStrategy === 'folder' ? key : `photos_${key}`;
          results.push({ url: pdf.output('bloburl'), name: `${base}.pdf` });
        }
      }

      generatedPDFs = results;
    } else {
      const first = await loadImageBlob(orderedFiles[0], quality);
      const pdf = new jsPDF({
        orientation: first.width > first.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [first.width, first.height],
        ...(wantProtection ? { encryption: {
          userPassword: password,
          ownerPassword: password,
          userPermissions: ['print', 'copy', 'modify', 'annot-forms']
        }} : {})
      });
      pdf.addImage(first.blobUrl, 'JPEG', 0, 0, first.width, first.height);
      URL.revokeObjectURL(first.blobUrl);

      for (let i = 1; i < orderedFiles.length; i++) {
        const d = await loadImageBlob(orderedFiles[i], quality);
        pdf.addPage([d.width, d.height], d.width > d.height ? 'landscape' : 'portrait');
        pdf.addImage(d.blobUrl, 'JPEG', 0, 0, d.width, d.height);
        URL.revokeObjectURL(d.blobUrl);
      }

      generatedPDFs = [{ url: pdf.output('bloburl'), name: buildSmartName() }];
    }

    isDownloadReady = true;
    convertButton.textContent = 'Download PDF';
    convertButton.classList.add('download-ready');
    announce('Conversion complete. Ready to download.');
  } catch (e) {
    console.error(e);
    convertButton.textContent = 'Error';
    announce('Conversion failed.');
  } finally {
    convertButton.disabled = false;
  }
});

resetButton.addEventListener('click', () => {
  imageInput.value = '';
  orderedFiles = [];
  previewContainer.querySelectorAll('.preview-item').forEach(div => {
    const t = div.dataset.thumbUrl;
    if (t) URL.revokeObjectURL(t);
  });
  previewContainer.innerHTML = '';
  previewContainer.classList.remove('sortable-initialized');
  arrangeHeading.classList.add('hidden');
  controlsDiv.classList.add('hidden');
  qualityGroup.classList.add('hidden');
  resetDownloadState();
  convertButton.disabled = true;
  fileLabelText.textContent = 'Choose files or drop them here';
  announce('All images cleared.');
});
