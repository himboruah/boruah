const sliderTrack = document.getElementById("sliderTrack");
const openFilePanelBtn = document.getElementById("openFilePanel");
const openTextPanelBtn = document.getElementById("openTextPanel");
const viewportEl = document.querySelector(".viewport");
const textPanel = document.querySelector(".panel--text");
const filePanel = document.querySelector(".panel--file");

function setViewportTo(panel) {
  viewportEl.style.height = panel.offsetHeight + "px";
}

function showTextPanel() {
  sliderTrack.classList.remove("track--show-file");
  sliderTrack.classList.add("track--show-text");
  if ('inert' in HTMLElement.prototype) {
    filePanel.inert = true;
    textPanel.inert = false;
  }
  filePanel.setAttribute("aria-hidden", "true");
  textPanel.setAttribute("aria-hidden", "false");
  textPanel.querySelector('h2').focus({ preventScroll: true });
  requestAnimationFrame(() => setViewportTo(textPanel));
}

function showFilePanel() {
  sliderTrack.classList.remove("track--show-text");
  sliderTrack.classList.add("track--show-file");
  if ('inert' in HTMLElement.prototype) {
    textPanel.inert = true;
    filePanel.inert = false;
  }
  textPanel.setAttribute("aria-hidden", "true");
  filePanel.setAttribute("aria-hidden", "false");
  filePanel.querySelector('h2').focus({ preventScroll: true });
  requestAnimationFrame(() => setViewportTo(filePanel));
}

openFilePanelBtn.addEventListener("click", showFilePanel);
openTextPanelBtn.addEventListener("click", showTextPanel);

const ro = new ResizeObserver(() => {
  if (textPanel.getAttribute("aria-hidden") === "false") setViewportTo(textPanel);
  else if (filePanel.getAttribute("aria-hidden") === "false") setViewportTo(filePanel);
});
ro.observe(textPanel);
ro.observe(filePanel);

requestAnimationFrame(() => setViewportTo(textPanel));

const hasFileSystemAccessAPI = !!window.showSaveFilePicker;

(function checkApiSupport() {
  if (!hasFileSystemAccessAPI) {
    const filePanel = document.querySelector(".panel--file");
    filePanel.querySelector("#fileApiWarning").classList.remove("hidden");
    filePanel.querySelector("#encryptFileBtn").disabled = true;
  }
})();

(function checkLibrarySupport() {
  if (typeof argon2 === 'undefined') {
    document.getElementById("libraryError").innerHTML = "<strong>Error:</strong> Critical library 'argon2-bundled.min.js' failed to load. Please check your internet connection and refresh the page.";
    document.getElementById("libraryError").classList.remove("hidden");
    document.getElementById("encryptBtn").disabled = true;
    document.getElementById("decryptBtn").disabled = true;
    document.getElementById("encryptFileBtn").disabled = true;
    document.getElementById("decryptFileBtn").disabled = true;
  }
})();

const ARGON = { t: 3, m: 64 * 1024, p: 2, hashLen: 32 };
const SALT_LEN = 32;

async function deriveKeyArgon2id(password, salt, opts = {}) {
  try {
    const cfg = { ...ARGON, ...(opts || {}), hashLen: 32 };
    const enc = new TextEncoder();
    const res = await argon2.hash({
      pass: enc.encode(password),
      salt,
      time: cfg.t,
      mem: cfg.m,
      parallelism: cfg.p,
      hashLen: cfg.hashLen,
      type: argon2.ArgonType.Argon2id,
      hash: "binary",
    });
    return crypto.subtle.importKey("raw", res.hash, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch (e) {
    if (e.message.toLowerCase().includes('memory')) {
      throw new Error("MemoryError: Not enough memory for key derivation. Try closing other tabs or using a device with more RAM.");
    }
    throw e;
  }
}

function showResult(text, isError = false) {
  const resultEl = document.getElementById("result");
  resultEl.innerText = text;
  resultEl.style.color = isError ? "var(--error)" : "#28a745";
  document.getElementById("outputBox").classList.remove("hidden");
  requestAnimationFrame(() => setViewportTo(textPanel));
}

async function encryptText() {
  let passphrase = document.getElementById("passphrase").value;
  let key = null;

  try {
    const text = document.getElementById("text").value;
    if (!text || !passphrase) return alert("Both text and passphrase are required!");

    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    key = await deriveKeyArgon2id(passphrase, salt, ARGON);

    const meta = { kdf: "argon2id", params: { t: ARGON.t, m: ARGON.m, p: ARGON.p }, salt: Array.from(salt), iv: Array.from(iv) };
    const aad = new TextEncoder().encode("BFE-TEXT\0" + JSON.stringify(meta));
    
    let plaintext = enc.encode(text);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, plaintext);
    
    plaintext.fill(0);

    const out = btoa(JSON.stringify({ ...meta, data: Array.from(new Uint8Array(ciphertext)) }));
    showResult(out);
  } catch (e) {
    console.error("Encryption Error:", e);
    showResult(e.message.startsWith("MemoryError:") ? e.message : "An unexpected error occurred during encryption.", true);
  } finally {
    passphrase = null;
    if (key) key = null;
  }
}

async function decryptText() {
  let passphrase = document.getElementById("passphrase").value;
  let key = null;
  
  try {
    const encryptedData = document.getElementById("text").value;
    if (!encryptedData || !passphrase) return alert("Both encrypted text and passphrase are required!");

    const parsed = JSON.parse(atob(encryptedData));
    if (parsed.kdf !== "argon2id") throw new Error("Unsupported KDF");
    const salt = new Uint8Array(parsed.salt);
    const iv = new Uint8Array(parsed.iv);
    const data = new Uint8Array(parsed.data);
    key = await deriveKeyArgon2id(passphrase, salt, parsed.params || ARGON);
    const meta = { kdf: parsed.kdf, params: parsed.params, salt: parsed.salt, iv: parsed.iv };
    const aad = new TextEncoder().encode("BFE-TEXT\0" + JSON.stringify(meta));
    const plaintextBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, data);
    
    showResult(new TextDecoder().decode(plaintextBuffer));
    
    new Uint8Array(plaintextBuffer).fill(0);

  } catch (e) {
    console.error("Decryption Error:", e);
    showResult(e.message.startsWith("MemoryError:") ? e.message : "Decryption failed: wrong passphrase or corrupted input.", true);
  } finally {
    passphrase = null;
    if (key) key = null;
  }
}

document.getElementById("encryptBtn").addEventListener("click", encryptText);
document.getElementById("decryptBtn").addEventListener("click", decryptText);

let clipboardClearInterval = null;
const copyBtn = document.getElementById("copyBtn");

copyBtn.addEventListener("click", () => {
  const text = document.getElementById("result").innerText;
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const originalText = "Copy";
    copyBtn.disabled = true;

    if (clipboardClearInterval) clearInterval(clipboardClearInterval);

    let countdown = 15;
    copyBtn.innerText = `Copied! (Clears in ${countdown}s)`;

    clipboardClearInterval = setInterval(() => {
      countdown--;
      copyBtn.innerText = `Copied! (Clears in ${countdown}s)`;

      if (countdown <= 0) {
        clearInterval(clipboardClearInterval);
        clipboardClearInterval = null;
        
        navigator.clipboard.writeText("-- clipboard cleared for security --").catch(() => {
          console.warn("Could not auto-clear clipboard. Tab may have lost focus.");
        });
        
        copyBtn.innerText = originalText;
        copyBtn.disabled = false;
      }
    }, 1000);

  }).catch((err) => {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      showResult("Copy failed. Browser requires a secure context (HTTPS) or user permission.", true);
    } else {
      alert("Copy failed!");
    }
  });
});

document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("text").value = "";
  document.getElementById("passphrase").value = "";
  document.getElementById("result").innerText = "";
  document.getElementById("outputBox").classList.add("hidden");
  
  const passMeter = document.getElementById("passphraseStrength");
  const passFeedback = document.getElementById("passphraseFeedback");
  passMeter.style.width = '0%';
  passFeedback.textContent = '';
  passFeedback.classList.remove('visible');

  if (clipboardClearInterval) {
    clearInterval(clipboardClearInterval);
    clipboardClearInterval = null;
    copyBtn.innerText = "Copy";
    copyBtn.disabled = false;
  }
  requestAnimationFrame(() => setViewportTo(textPanel));
});

const togglePassBtn = document.getElementById("togglePass");
togglePassBtn.addEventListener("click", () => {
  const input = document.getElementById("passphrase");
  const eye = togglePassBtn.querySelector(".icon-eye");
  const eyeOff = togglePassBtn.querySelector(".icon-eye-off");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  eye.style.display = isPassword ? "none" : "block";
  eyeOff.style.display = isPassword ? "block" : "none";
  togglePassBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

const fileInput = document.getElementById("fileInput");
const filePass = document.getElementById("filePassphrase");
const encryptFileBtn = document.getElementById("encryptFileBtn");
const decryptFileBtn = document.getElementById("decryptFileBtn");
const toggleFilePass = document.getElementById("toggleFilePass");
const progressEl = document.getElementById("fileProgress");
const statusEl = document.getElementById("fileStatus");
const fileProgressRow = document.getElementById("fileProgressRow");
const dropZone = document.getElementById("dropZone");
const cancelBtn = document.getElementById("cancelBtn");
let cancellationController = null;
let droppedFile = null;

toggleFilePass.addEventListener("click", () => {
  const eye = toggleFilePass.querySelector(".icon-eye");
  const eyeOff = toggleFilePass.querySelector(".icon-eye-off");
  const isPassword = filePass.type === "password";
  filePass.type = isPassword ? "text" : "password";
  eye.style.display = isPassword ? "none" : "block";
  eyeOff.style.display = isPassword ? "block" : "none";
  toggleFilePass.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

document.getElementById("resetFileBtn")?.addEventListener("click", () => resetFileUI());
cancelBtn.addEventListener("click", () => {
  if (cancellationController) {
    cancellationController.abort();
    statusEl.textContent = "Cancelling…";
  }
});

["dragenter","dragover"].forEach(evt => dropZone.addEventListener(evt, e => {
  e.preventDefault(); e.stopPropagation(); dropZone.classList.add("is-dragover");
}));
["dragleave","drop"].forEach(evt => dropZone.addEventListener(evt, e => {
  e.preventDefault(); e.stopPropagation(); dropZone.classList.remove("is-dragover");
}));

dropZone.addEventListener("drop", e => {
  e.preventDefault(); e.stopPropagation();
  const f = [...e.dataTransfer.files][0];
  if (!f) return;
  try {
    const dt = new DataTransfer();
    dt.items.add(f);
    fileInput.files = dt.files;
    droppedFile = null;
  } catch {
    fileInput.value = "";
    droppedFile = f;
  }
  resetFileUI(true);
});

window.addEventListener("paste", (e) => {
  if (filePanel.getAttribute("aria-hidden") === "false") {
    const f = e.clipboardData?.files?.[0];
    if (!f) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(f);
      fileInput.files = dt.files;
      droppedFile = null;
    } catch {
      fileInput.value = "";
      droppedFile = f;
    }
    resetFileUI(true);
  }
});

function resetFileUI(keepFile = false) {
  fileProgressRow.classList.add("hidden");
  
  const fallbackBox = document.getElementById("fallbackOutputBox");
  const fallbackLink = document.getElementById("fallbackDownloadLink");
  if (fallbackLink.href) {
    URL.revokeObjectURL(fallbackLink.href);
  }
  fallbackBox.classList.add("hidden");

  if (!keepFile) {
    fileInput.value = "";
    droppedFile = null;
  }
  filePass.value = "";
  statusEl.textContent = "";
  progressEl.value = 0;
  if (cancellationController) cancellationController = null;
  
  const filePassMeter = document.getElementById("filePassphraseStrength");
  const filePassFeedback = document.getElementById("filePassphraseFeedback");
  filePassMeter.style.width = '0%';
  filePassFeedback.textContent = '';
  filePassFeedback.classList.remove('visible');
  
  requestAnimationFrame(() => setViewportTo(filePanel));
}

const V5_MAGIC = "BFE5";
const V5_VERSION = 5;
const CHUNK_SIZE_DEFAULT = 1 * 1024 * 1024;

function deriveChunkIV(ivBase, counter) {
  const iv = new Uint8Array(12);
  iv.set(ivBase);
  new DataView(iv.buffer).setUint32(8, counter, true);
  return iv;
}

async function encryptFile() {
  const file = fileInput.files?.[0] || droppedFile;
  let passphrase = filePass.value;
  let key = null;

  if (!file) return alert("Please choose a file.");
  if (!passphrase) return alert("Please enter a passphrase.");
  
  const filenameBytes = new TextEncoder().encode(file.name);
  if (filenameBytes.length > 4096) {
    return alert("Error: Filename is too long.");
  }

  resetFileUI(true);
  fileProgressRow.classList.remove("hidden");
  statusEl.textContent = "Preparing…";
  cancellationController = new AbortController();

  let writableStream;
  try {
    const safeOutputName = sanitizeFilename(file.name) + ".bfe";
    const handle = await window.showSaveFilePicker({
      suggestedName: safeOutputName,
      types: [{ description: 'Encrypted BFE File', accept: { 'application/octet-stream': ['.bfe'] } }],
    });
    writableStream = await handle.createWritable();
    
    statusEl.textContent = "Deriving key…";
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const ivBase = crypto.getRandomValues(new Uint8Array(12));
    key = await deriveKeyArgon2id(passphrase, salt, ARGON);

    const enc = new TextEncoder();
    const CHUNK_SIZE = CHUNK_SIZE_DEFAULT;

    const fixedHeader = new Uint8Array(4 + 1 + 4 + 4 + 1 + 32 + 12 + 8 + 4);
    let o = 0;
    fixedHeader.set(enc.encode(V5_MAGIC), o); o += 4;
    fixedHeader.set([V5_VERSION], o); o += 1;
    const dv = new DataView(fixedHeader.buffer);
    dv.setUint32(o, ARGON.t, true); o += 4;
    dv.setUint32(o, ARGON.m, true); o += 4;
    fixedHeader.set([ARGON.p], o); o += 1;
    fixedHeader.set(salt, o); o += 32;
    fixedHeader.set(ivBase, o); o += 12;
    dv.setBigUint64(o, BigInt(file.size), true); o += 8;
    dv.setUint32(o, CHUNK_SIZE, true); o += 4;

    const filenameIV = deriveChunkIV(ivBase, 0xFFFFFFFF);
    const encryptedFilename = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: filenameIV, additionalData: fixedHeader }, key, filenameBytes
    );
    const filenameLen = new Uint8Array(2);
    new DataView(filenameLen.buffer).setUint16(0, encryptedFilename.byteLength, true);

    await writableStream.write(fixedHeader);
    await writableStream.write(filenameLen);
    await writableStream.write(encryptedFilename);

    let processed = 0, idx = 0;
    const start = performance.now();
    
    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      if (cancellationController.signal.aborted) throw new Error("Cancelled");
      if (idx >= 0xFFFFFFFF - 1) throw new Error("File is too large: exceeds maximum number of chunks.");
      
      const plainChunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      const chunkIV = deriveChunkIV(ivBase, idx);
      const aad = new Uint8Array(fixedHeader);
      const cipherChunk = await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIV, additionalData: aad }, key, plainChunk);
      
      new Uint8Array(plainChunk).fill(0);
      
      const chunkLen = new Uint8Array(4);
      new DataView(chunkLen.buffer).setUint32(0, cipherChunk.byteLength, true);

      await writableStream.write(chunkLen);
      await writableStream.write(cipherChunk);
      
      processed += plainChunk.byteLength;
      idx++;
      
      const elapsed = (performance.now() - start) / 1000;
      const speed = processed / Math.max(elapsed, 0.001);
      const remain = Math.max(file.size - processed, 0);
      const eta = speed ? remain / speed : 0;
      progressEl.value = Math.round((processed / file.size) * 100);
      statusEl.textContent = `${formatBytes(processed)} / ${formatBytes(file.size)} • ${formatSpeed(speed)} • ETA ${formatETA(eta)}`;
    }

    await writableStream.close();
    statusEl.textContent = "Done. File saved successfully.";
    progressEl.value = 100;

  } catch (e) {
    if (writableStream) await writableStream.abort();
    console.error(e);
    if (e.name === 'AbortError' || e.message === 'Cancelled') {
      statusEl.textContent = "Cancelled.";
    } else {
      statusEl.textContent = "Error: " + (e.message.startsWith("MemoryError:") ? e.message : "Encryption failed.");
    }
  } finally {
    passphrase = null;
    if (key) key = null;
    cancellationController = null;
    setTimeout(() => fileProgressRow.classList.add("hidden"), 2000);
  }
}

async function decryptFile() {
  const file = fileInput.files?.[0] || droppedFile;
  let passphrase = filePass.value;
  let key = null;

  if (!file) return alert("Please choose a .bfe file.");
  if (!passphrase) return alert("Please enter a passphrase.");
  
  resetFileUI(true);
  fileProgressRow.classList.remove("hidden");
  statusEl.textContent = "Reading header…";
  cancellationController = new AbortController();
  
  let writableStream;
  let plainChunksForFallback = [];

  try {
    const fixedHeaderLen = 70;
    const fixedHeaderBytes = new Uint8Array(await file.slice(0, fixedHeaderLen).arrayBuffer());
    
    const dec = new TextDecoder();
    if (dec.decode(fixedHeaderBytes.subarray(0, 4)) !== V5_MAGIC) throw new Error("Not a BFE v5 file.");
    
    const dv = new DataView(fixedHeaderBytes.buffer);
    const argonParams = { t: dv.getUint32(5, true), m: dv.getUint32(9, true), p: dv.getUint8(13) };
    const salt = fixedHeaderBytes.subarray(14, 46);
    const ivBase = fixedHeaderBytes.subarray(46, 58);
    const totalSize = dv.getBigUint64(58, true);

    key = await deriveKeyArgon2id(passphrase, salt, argonParams);
    
    const filenameLenBytes = new Uint8Array(await file.slice(fixedHeaderLen, fixedHeaderLen + 2).arrayBuffer());
    const filenameLen = new DataView(filenameLenBytes.buffer).getUint16(0, true);
    
    const encryptedFilenameBytes = new Uint8Array(await file.slice(fixedHeaderLen + 2, fixedHeaderLen + 2 + filenameLen).arrayBuffer());
    const filenameIV = deriveChunkIV(ivBase, 0xFFFFFFFF);
    const plainFilenameBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: filenameIV, additionalData: fixedHeaderBytes }, key, encryptedFilenameBytes);
    
    const rawFilename = dec.decode(plainFilenameBytes);
    const decryptedFilename = sanitizeFilename(rawFilename);
    new Uint8Array(plainFilenameBytes).fill(0);

    if (hasFileSystemAccessAPI) {
      const handle = await window.showSaveFilePicker({ suggestedName: decryptedFilename });
      writableStream = await handle.createWritable();
    }

    let offset = fixedHeaderLen + 2 + filenameLen;
    let processed = 0, idx = 0;
    const start = performance.now();

    while (offset < file.size) {
      if (cancellationController.signal.aborted) throw new Error("Cancelled");
      if (idx >= 0xFFFFFFFF - 1) throw new Error("File is too large: exceeds maximum number of chunks.");
      
      const lenBytes = new Uint8Array(await file.slice(offset, offset + 4).arrayBuffer());
      const chunkLen = new DataView(lenBytes.buffer).getUint32(0, true);
      offset += 4;
      if (offset + chunkLen > file.size) throw new Error("Corrupt chunk length in file.");
      
      const cipherChunk = new Uint8Array(await file.slice(offset, offset + chunkLen).arrayBuffer());
      offset += chunkLen;
      
      const chunkIV = deriveChunkIV(ivBase, idx);
      const plainChunk = await crypto.subtle.decrypt({ name: "AES-GCM", iv: chunkIV, additionalData: fixedHeaderBytes }, key, cipherChunk);
      
      if (writableStream) {
        await writableStream.write(plainChunk);
        new Uint8Array(plainChunk).fill(0);
      } else {
        plainChunksForFallback.push(plainChunk);
      }
      
      processed += plainChunk.byteLength;
      idx++;

      const elapsed = (performance.now() - start) / 1000;
      const speed = processed / Math.max(elapsed, 0.001);
      progressEl.value = Math.round((processed / Number(totalSize)) * 100);
      statusEl.textContent = `${formatBytes(processed)} / ${formatBytes(Number(totalSize))} • ${formatSpeed(speed)}`;
    }
    
    if (writableStream) {
      await writableStream.close();
      statusEl.textContent = "Done. File saved successfully.";
    } else {
      const blob = new Blob(plainChunksForFallback, { type: 'application/octet-stream' });
      const fallbackLink = document.getElementById("fallbackDownloadLink");
      fallbackLink.href = URL.createObjectURL(blob);
      fallbackLink.download = decryptedFilename;
      document.getElementById("fallbackOutputBox").classList.remove("hidden");
      statusEl.textContent = "Done. Use the link below to download.";
      plainChunksForFallback = [];
    }
    
    progressEl.value = 100;
    
  } catch (e) {
    if (writableStream) await writableStream.abort();
    console.error(e);
    if (e.name === 'AbortError' || e.message === 'Cancelled') {
      statusEl.textContent = "Cancelled.";
    } else {
      statusEl.textContent = "Error: " + (e.message.startsWith("MemoryError:") ? e.message : "Decryption failed. Wrong passphrase or corrupt file.");
    }
  } finally {
    passphrase = null;
    if (key) key = null;
    cancellationController = null;
    setTimeout(() => fileProgressRow.classList.add("hidden"), 2000);
  }
}

document.getElementById("encryptFileBtn").addEventListener("click", encryptFile);
document.getElementById("decryptFileBtn").addEventListener("click", decryptFile);

function sanitizeFilename(name) {
  if (!name) return "decrypted.bin";
  let sanitized = name.replace(/\.\.[\/\\]/g, '');
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, '');
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  return sanitized.trim() || "decrypted.bin";
}

function formatBytes(n) {
  if (typeof n === 'bigint') n = Number(n);
  if (!Number.isFinite(n)) return "0 B";
  const k = 1024, units = ["B","KB","MB","GB","TB"];
  let i = 0; while (n >= k && i < units.length - 1) { n /= k; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}
function formatSpeed(bps) { return `${formatBytes(bps)}/s`; }
function formatETA(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

const COMMON_WORDS = [
  "password","123456","12345678","qwerty","abc123","letmein","111111",
  "password123", "password12", "password1", "iloveyou","admin","welcome","monkey","login","dragon"
];
const KEYBOARD_SEQS = ["qwerty","asdfgh","zxcvb","12345","54321", "qazwsx"];

function estimatePasswordStrength(pw) {
  if (!pw) return { score: 0, feedback: "" };

  const lower = pw.toLowerCase();
  if (COMMON_WORDS.some(w => lower.includes(w))) {
    return { score: 0, feedback: "This password is too common or easily guessable." };
  }
  if (KEYBOARD_SEQS.some(seq => lower.includes(seq))) {
    return { score: 0, feedback: "Avoid common keyboard patterns." };
  }

  let score = 0;
  const length = pw.length;
  if (length >= 8) score++;
  if (length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const uniqueChars = new Set(pw).size;
  if (uniqueChars / length > 0.7 && length >= 16) score++;

  score = Math.min(score, 5);
  
  const feedbackMap = {
      0: "Very weak. Add much more length and character variety.",
      1: "Weak. Please add more length or different character types.",
      2: "Weak. Please add more length or different character types.",
      3: "Moderate. This is acceptable, but could be stronger.",
      4: "Strong. This is a good password.",
      5: "Very strong. This is an excellent password."
  };
  const feedback = feedbackMap[score];

  return { score, feedback };
}

function updateStrengthMeterUI(meterEl, feedbackEl, result) {
  const pct = (result.score / 5) * 100;
  meterEl.style.width = `${pct}%`;

  if (pct < 40) {
      meterEl.style.backgroundColor = 'var(--error)';
  } else if (pct < 80) {
      meterEl.style.backgroundColor = '#f0ad4e';
  } else {
      meterEl.style.backgroundColor = '#28a745';
  }
  
  meterEl.title = result.feedback;
  feedbackEl.textContent = result.feedback;

  if (result.feedback) {
    feedbackEl.classList.add('visible');
  } else {
    feedbackEl.classList.remove('visible');
  }
}

const passInput = document.getElementById("passphrase");
const passMeter = document.getElementById("passphraseStrength");
const passFeedback = document.getElementById("passphraseFeedback");
passInput.addEventListener("input", () => {
    const result = estimatePasswordStrength(passInput.value);
    updateStrengthMeterUI(passMeter, passFeedback, result);
});

const filePassInput = document.getElementById("filePassphrase");
const filePassMeter = document.getElementById("filePassphraseStrength");
const filePassFeedback = document.getElementById("filePassphraseFeedback");
filePassInput.addEventListener("input", () => {
    const result = estimatePasswordStrength(filePassInput.value);
    updateStrengthMeterUI(filePassMeter, filePassFeedback, result);
});