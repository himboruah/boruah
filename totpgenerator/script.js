let countdownInterval;

const secretInput = document.getElementById('secret');
const digitsInput = document.getElementById('digits');
const periodInput = document.getElementById('period');
const algorithmInput = document.getElementById('algorithm');
const modeInput = document.getElementById('mode');
const totpDisplay = document.getElementById('totp');
const countdownDisplay = document.getElementById('countdown');
const generateBtn = document.getElementById('generateBtn');
const advancedToggle = document.getElementById('advancedToggle');
const advancedSection = document.getElementById('advancedSection');
const outputSection = document.querySelector('.output');
const totpLabel = document.getElementById('totpLabel');
const scanQRBtn = document.getElementById('scanQRBtn');
const qrScannerModal = document.getElementById('qrScannerModal');
const qrVideo = document.getElementById('qrVideo');
const closeScannerBtn = document.getElementById('closeScannerBtn');
let videoStream;

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function resetTOTP() {
  totpDisplay.classList.remove('visible');
  countdownDisplay.classList.remove('visible');
  totpLabel.classList.remove('visible');
  totpDisplay.innerText = "";
  countdownDisplay.innerText = "";
  clearCountdown();
  generateBtn.disabled = false;
}

function showMessage(message, isSuccess = false) {
  const msgElement = document.getElementById('errorMsg');
  outputSection.classList.remove('show');
  resetTOTP();
  msgElement.innerText = message;
  msgElement.classList.toggle('success', isSuccess);
  msgElement.classList.add('show');
  setTimeout(() => {
    msgElement.classList.remove('show');
    msgElement.classList.remove('success');
  }, 3000);
}

generateBtn.addEventListener('click', async () => {
  resetTOTP();
  const secret = secretInput.value.trim();
  const digits = parseInt(digitsInput.value);
  const period = parseInt(periodInput.value);
  const algorithm = algorithmInput.value;
  const mode = modeInput.value;

  if (!secret) {
    showMessage("Secret key cannot be empty.");
    return;
  }

  generateBtn.disabled = true;
  outputSection.classList.add('show');

  const totp = (mode === 'steam')
    ? await generateSteamTOTP(secret)
    : await generateTOTP(secret, digits, period, algorithm);

  if (totp === null) {
      showMessage("Invalid Secret Key. Check for typos or unsupported characters.");
      generateBtn.disabled = false;
      outputSection.classList.remove('show');
      return;
  }

  totpDisplay.innerText = totp;
  totpDisplay.classList.add('visible');
  countdownDisplay.classList.add('visible');
  totpLabel.classList.add('visible');
  startCountdown(secret, digits, period, algorithm, mode);
});

async function generateTOTP(secret, digits, period, algorithm) {
  try {
    const key = base32toBytes(secret);
    if (key.length === 0) return null;
    const counter = Math.floor(Date.now() / 1000 / period);
    const msg = new ArrayBuffer(8);
    new DataView(msg).setBigUint64(0, BigInt(counter));
    const cryptoKey = await crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: { name: algorithm } }, false, ["sign"]
    );
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msg));
    const offset = hmac[hmac.length - 1] & 0xf;
    const binCode = ((hmac[offset] & 0x7f) << 24) |
                    (hmac[offset + 1] << 16) |
                    (hmac[offset + 2] << 8) |
                    (hmac[offset + 3]);
    return (binCode % (10 ** digits)).toString().padStart(digits, '0');
  } catch (e) {
    console.error("TOTP Generation Error:", e);
    return null;
  }
}

async function generateSteamTOTP(secret) {
  try {
    const STEAM_CHARS = '23456789BCDFGHJKMNPQRTVWXY';
    const key = base32toBytes(secret);
    if (key.length === 0) return null;
    const counter = Math.floor(Date.now() / 1000 / 30);
    const msg = new ArrayBuffer(8);
    new DataView(msg).setBigUint64(0, BigInt(counter));
    const cryptoKey = await crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msg));
    const offset = hmac[hmac.length - 1] & 0xf;
    let codeInt = ((hmac[offset] & 0x7f) << 24) |
                  (hmac[offset + 1] << 16) |
                  (hmac[offset + 2] << 8) |
                  (hmac[offset + 3]);
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += STEAM_CHARS[codeInt % STEAM_CHARS.length];
      codeInt = Math.floor(codeInt / STEAM_CHARS.length);
    }
    return code;
  } catch(e) {
    console.error("Steam TOTP Generation Error:", e);
    return null;
  }
}

function base32toBytes(base32) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "", bytes = [];
  base32 = base32.replace(/\s+/g, '').toUpperCase();
  for (let char of base32) {
    const val = base32chars.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return new Uint8Array(bytes);
}

function startCountdown(secret, digits, period, algorithm, mode) {
  async function updateTOTP() {
      const remaining = period - (Math.floor(Date.now() / 1000) % period);
      
      if (countdownDisplay.innerText.includes(remaining)) {
          return;
      }
      
      const totp = (mode === 'steam')
        ? await generateSteamTOTP(secret)
        : await generateTOTP(secret, digits, period, algorithm);

      totpDisplay.innerText = totp || "Error";
      countdownDisplay.innerText = `New TOTP in ${remaining} seconds`;
  }

  clearInterval(countdownInterval);
  updateTOTP();
  countdownInterval = setInterval(updateTOTP, 1000);
}

totpDisplay.addEventListener('click', () => {
  if (navigator.clipboard && totpDisplay.innerText) {
    navigator.clipboard.writeText(totpDisplay.innerText)
      .then(() => showCopyBalloon(totpDisplay, 'Copied'))
      .catch(fallbackClipboardCopy);
  } else if (totpDisplay.innerText) {
    fallbackClipboardCopy();
  }
});

function fallbackClipboardCopy() {
  const range = document.createRange();
  range.selectNodeContents(totpDisplay);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("copy");
  showCopyBalloon(totpDisplay, 'Copied');
}

function showCopyBalloon(target, message) {
  const existing = document.getElementById('copyBalloon');
  if (existing) existing.remove();
  const balloon = document.createElement('div');
  balloon.id = 'copyBalloon';
  balloon.textContent = message;
  const container = target.closest('.output');
  container.appendChild(balloon);
  const balloonRect = balloon.getBoundingClientRect();
  balloon.style.left = `50%`;
  balloon.style.top = `${target.offsetTop - balloonRect.height + 10}px`;
  balloon.style.transform = `translateX(-50%)`;
  requestAnimationFrame(() => {
    balloon.style.opacity = '1';
  });
  setTimeout(() => {
    balloon.style.opacity = '0';
    balloon.addEventListener('transitionend', () => balloon.remove(), { once: true });
  }, 2000);
}

advancedToggle.addEventListener('change', () => {
  advancedSection.classList.toggle('show', advancedToggle.checked);
});

function normalizeAlgorithm(algo) {
  const upper = algo.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper === 'SHA1') return 'SHA-1';
  if (upper === 'SHA256') return 'SHA-256';
  if (upper === 'SHA512') return 'SHA-512';
  return 'SHA-1';
}

function parseOtpauthURI(uri) {
  try {
    if (!uri.startsWith("otpauth://")) return null;
    const url = new URL(uri);
    const params = url.searchParams;
    return {
      secret: params.get("secret") || "",
      digits: parseInt(params.get("digits")) || 6,
      period: parseInt(params.get("period")) || 30,
      algorithm: normalizeAlgorithm(params.get("algorithm") || "SHA1")
    };
  } catch {
    return null;
  }
}

function hideOutputOnInputChange() {
  outputSection.classList.remove('show');
  resetTOTP();
}

secretInput.addEventListener('input', () => {
  const value = secretInput.value.trim();
  const parsed = parseOtpauthURI(value);

  if (parsed) {
    secretInput.value = parsed.secret;
    digitsInput.value = parsed.digits.toString();
    periodInput.value = parsed.period.toString();
    algorithmInput.value = parsed.algorithm;
    modeInput.value = 'standard';
  } else if (value.toLowerCase().startsWith("steam://")) {
    secretInput.value = value.replace(/^steam:\/\//i, '');
    digitsInput.value = '5';
    periodInput.value = '30';
    algorithmInput.value = 'SHA-1';
    modeInput.value = 'steam';
  }

  hideOutputOnInputChange();
});

digitsInput.addEventListener('change', hideOutputOnInputChange);
periodInput.addEventListener('change', hideOutputOnInputChange);
algorithmInput.addEventListener('change', hideOutputOnInputChange);

function ensureDigitOption(value) {
  const existing = Array.from(digitsInput.options).find(opt => opt.value === value);
  if (!existing) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    digitsInput.appendChild(option);
  }
}

function removeDigitOption(value) {
  const option = Array.from(digitsInput.options).find(opt => opt.value === value && !['6', '8'].includes(opt.value));
  if (option) {
    option.remove();
  }
}

function applyModeDefaults(mode) {
  if (mode === 'steam') {
    ensureDigitOption('5');
    digitsInput.value = '5';
    periodInput.value = '30';
    algorithmInput.value = 'SHA-1';
  } else {
    removeDigitOption('5');
    digitsInput.value = '6';
    periodInput.value = '30';
    algorithmInput.value = 'SHA-1';
  }
}

modeInput.addEventListener('change', () => {
  const mode = modeInput.value;
  applyModeDefaults(mode);
  const isSteam = mode === 'steam';
  digitsInput.disabled = isSteam;
  periodInput.disabled = isSteam;
  algorithmInput.disabled = isSteam;
  hideOutputOnInputChange();
});

modeInput.dispatchEvent(new Event('change'));

window.addEventListener('DOMContentLoaded', () => {
  if (!(window.crypto && window.crypto.subtle)) {
    showMessage("This browser is not supported.");
    generateBtn.disabled = true;
    scanQRBtn.disabled = true;
  }
});

scanQRBtn.addEventListener('click', startScanner);
closeScannerBtn.addEventListener('click', stopScanner);

function startScanner() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
      videoStream = stream;
      qrVideo.srcObject = stream;
      qrVideo.setAttribute("playsinline", true);
      qrVideo.play();
      qrScannerModal.style.display = 'flex';
      requestAnimationFrame(tick);
    })
    .catch(function(err) {
      console.error("Camera Error:", err);
      showMessage("Could not access camera. Please grant permission.");
    });
}

function stopScanner() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  qrScannerModal.style.display = 'none';
}

function tick() {
  if (qrScannerModal.style.display !== 'flex') return;

  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    const canvas = document.createElement('canvas');
    canvas.width = qrVideo.videoWidth;
    canvas.height = qrVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      stopScanner();
      secretInput.value = code.data;
      secretInput.dispatchEvent(new Event('input', { bubbles: true }));
      showMessage("QR Code Scanned Successfully!", true);
      return;
    }
  }
  requestAnimationFrame(tick);
}
