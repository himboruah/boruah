(() => { "use strict";

const SETS = Object.freeze({
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  nums:  "0123456789",
  syms:  "!@#$%^&*()-_=+[]{};:'\\\",.<>/?`~|\\\\"
});
const LOOKALIKE_CHARS = Object.freeze("O0o Il1|! []{}()<>`'\\\".,;:~");

function getSecureRandom(max) {
  if (!window.isSecureContext || !window.crypto?.getRandomValues) {
    throw new Error("Secure RNG unavailable (serve over HTTPS).");
  }
  if (!Number.isInteger(max) || max <= 0) throw new Error("Invalid max for RNG.");
  const range = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  while (true) {
    window.crypto.getRandomValues(buf);
    const x = buf[0];
    if (x < range) return x % max;
  }
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = getSecureRandom(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomChar(chars) {
  const idx = getSecureRandom(chars.length);
  return chars[idx];
}

const $ = (sel) => document.querySelector(sel);
const els = {
  length: $("#length"),
  lowercase: $("#lowercase"),
  uppercase: $("#uppercase"),
  numbers: $("#numbers"),
  symbols: $("#symbols"),
  exclude: $("#exclude"),
  excludeLookalikes: $("#excludeLookalikes"),
  batchCount: $("#batchCount"),
  generate: $("#generateButton"),
  copy: $("#copyButton"),
  download: $("#downloadButton"),
  reset: $("#resetButton"),
  pwToggle: $("#pwToggle"),
  password: $("#password"),
  copyStatus: $("#copyStatus"),
  strengthBar: $("#strengthBar"),
  strengthText: $("#strengthText"),
  entropyText: $("#entropyText"),
  checkLower: $("#check-lower"),
  checkUpper: $("#check-upper"),
  checkNum: $("#check-num"),
  checkSym: $("#check-sym"),
  batchList: $("#batchList"),
  envWarning: $("#envWarning"),
  starfield: $("#starfield"),
  historySection: document.querySelector(".history"),
};

function isSecureOK() {
  return !!(window.isSecureContext && window.crypto?.getRandomValues);
}
function disableInsecure() {
  const insecure = !isSecureOK();
  if (insecure) {
    els.generate?.setAttribute("disabled", "true");
    els.generate?.setAttribute("title", "Serve over HTTPS to enable secure generation");
    els.envWarning && (els.envWarning.hidden = false);
  } else {
    els.generate?.removeAttribute("disabled");
    els.generate?.removeAttribute("title");
    els.envWarning && (els.envWarning.hidden = true);
  }
}

function getExcludeString() {
  const user = els.exclude?.value || "";
  const lookalikes = els.excludeLookalikes?.checked ? LOOKALIKE_CHARS : "";
  const set = new Set((user + lookalikes).split(""));
  return Array.from(set).join("");
}

function getActiveSets() {
  const active = [];
  if (els.lowercase?.checked) active.push(SETS.lower);
  if (els.uppercase?.checked) active.push(SETS.upper);
  if (els.numbers?.checked) active.push(SETS.nums);
  if (els.symbols?.checked) active.push(SETS.syms);
  const exclude = getExcludeString();
  const filtered = active
    .map(set => set.split("").filter(ch => !exclude.includes(ch)))
    .map(a => a.join(""))
    .filter(s => s.length > 0);
  return filtered;
}

function generatePassword(len, sets) {
  const chars = [];
  for (const set of sets) chars.push(pickRandomChar(set));
  const pool = sets.join("");
  for (let i = chars.length; i < len; i++) chars.push(pickRandomChar(pool));
  return shuffleInPlace(chars).join("");
}

function analyzeInclusions(pw) {
  return {
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    num:   /[0-9]/.test(pw),
    sym:   /[^A-Za-z0-9]/.test(pw),
  };
}

function log2(x) { return Math.log(x) / Math.LN2; }
function estimateEntropy(len, sets) {
  const pool = new Set(sets.join("").split(""));
  const size = Math.max(1, pool.size);
  const bits = len * log2(size);
  return { bits, poolSize: size };
}
function strengthLabel(bits) {
  if (bits < 40) return "Weak";
  if (bits < 60) return "Fair";
  if (bits < 80) return "Strong";
  return "Excellent";
}

function updateStrengthUI(len, sets) {
  const { bits } = estimateEntropy(len, sets);
  const capped = Math.max(0, Math.min(100, Math.round(bits)));
  if (els.strengthBar) {
    els.strengthBar.style.width = `${capped}%`;
    els.strengthBar.setAttribute("aria-valuenow", String(capped));
  }
  if (els.strengthText) els.strengthText.textContent = strengthLabel(bits);
  if (els.entropyText) els.entropyText.textContent = `Entropy: ${bits.toFixed(1)} bits`;
}

function updateSetChecks(pw) {
  const inc = analyzeInclusions(pw);
  const apply = (el, ok) => {
    if (!el) return;
    el.classList.toggle("ok", ok);
    el.classList.toggle("missing", !ok);
  };
  apply(els.checkLower, inc.lower);
  apply(els.checkUpper, inc.upper);
  apply(els.checkNum,   inc.num);
  apply(els.checkSym,   inc.sym);
}

function clearSetChecks() {
  [els.checkLower, els.checkUpper, els.checkNum, els.checkSym].forEach(el => {
    if (!el) return;
    el.classList.remove("ok", "missing");
  });
}

function setCopyStatus(msg, ok = true) {
  if (!els.copyStatus) return;
  els.copyStatus.textContent = msg;
  els.copyStatus.style.color = ok ? "var(--ok)" : "var(--danger)";
  if (msg) {
    window.clearTimeout(setCopyStatus._t);
    setCopyStatus._t = window.setTimeout(() => (els.copyStatus.textContent = ""), 1800);
  }
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function downloadPasswordsTXT() {
  const inputs = Array.from(els.batchList?.querySelectorAll(".batch-item input") ?? []);
  const list = inputs.map(i => i.dataset.full || i.value).filter(Boolean);
  const data = list.length ? list : (els.password?.value ? [els.password.value] : []);
  if (!data.length) {
    setCopyStatus("Nothing to download yet — generate first.", false);
    return;
  }
  const content = data.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fname = `passwords_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.txt`;

  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setCopyStatus(`Downloaded ${data.length} password${data.length>1?"s":""} ✔`);
}

function sanitizeLength(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n)) return 16;
  return Math.min(128, Math.max(1, n));
}
function validate(len, sets) {
  if (sets.length === 0) return "Please select at least one character set (and/or adjust exclusions).";
  if (len < sets.length) return `Length must be at least ${sets.length} to include one character from each selected set.`;
  return null;
}

function maskBatch(pw) {
  const n = pw.length;
  if (n <= 4) return pw;
  return pw.slice(0, 2) + "•".repeat(n - 4) + pw.slice(-2);
}

function buildEyeToggle() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-toggle";
  btn.setAttribute("aria-label", "Show password");
  btn.setAttribute("aria-pressed", "false");

  const eyeNS = "http://www.w3.org/2000/svg";

  const eye = document.createElementNS(eyeNS, "svg");
  eye.setAttribute("class", "icon eye");
  eye.setAttribute("viewBox", "0 0 24 24"); eye.setAttribute("width", "20"); eye.setAttribute("height", "20");
  const p1 = document.createElementNS(eyeNS, "path");
  p1.setAttribute("d", "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z");
  const c1 = document.createElementNS(eyeNS, "circle");
  c1.setAttribute("cx","12"); c1.setAttribute("cy","12"); c1.setAttribute("r","3");
  eye.append(p1, c1);

  const eyeOff = document.createElementNS(eyeNS, "svg");
  eyeOff.setAttribute("class", "icon eye-off");
  eyeOff.setAttribute("viewBox", "0 0 24 24"); eyeOff.setAttribute("width", "20"); eyeOff.setAttribute("height", "20");
  const p2 = document.createElementNS(eyeNS, "path");
  p2.setAttribute("d","M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.77 21.77 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.87 5.09");
  const p3 = document.createElementNS(eyeNS, "path");
  p3.setAttribute("d","M14.12 14.12a3 3 0 1 1-4.24-4.24");
  const ln = document.createElementNS(eyeNS, "line");
  ln.setAttribute("x1","1"); ln.setAttribute("y1","1"); ln.setAttribute("x2","23"); ln.setAttribute("y2","23");
  eyeOff.append(p2, p3, ln);

  btn.append(eye, eyeOff);
  return btn;
}

function doGenerate() {
  try {
    const sets = getActiveSets();
    const len = sanitizeLength(els.length?.value);
    const err = validate(len, sets);
    updateStrengthUI(len, sets);
    if (err) { setCopyStatus(err, false); return; }

    const count = sanitizeLength(els.batchCount?.value);
    const clampedCount = Math.max(1, Math.min(20, count));

    if (els.historySection) els.historySection.hidden = clampedCount <= 1;

    const results = [];
    for (let i = 0; i < clampedCount; i++) results.push(generatePassword(len, sets));

    const pw = results[0] || "";
    if (els.password) els.password.value = pw;
    updateSetChecks(pw);

    renderBatch(results);
    setCopyStatus("Generated ✔");
  } catch (e) {
    console.error(e);
    setCopyStatus(e?.message || "Generation failed.", false);
  }
}

function renderBatch(list) {
  if (!els.batchList) return;
  els.batchList.innerHTML = "";
  list.forEach((pw, idx) => {
    const item = document.createElement("div");
    item.className = "batch-item";
    item.setAttribute("role", "listitem");

    const wrap = document.createElement("div");
    wrap.className = "pw-wrap";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "pw";
    input.readOnly = true;
    input.value = maskBatch(pw);
    input.dataset.full = pw;

    const toggle = buildEyeToggle();
    toggle.addEventListener("click", () => {
      const showing = toggle.getAttribute("aria-pressed") === "true";
      if (showing) {
        input.value = maskBatch(pw);
        toggle.setAttribute("aria-pressed", "false");
        toggle.setAttribute("aria-label", "Show password");
      } else {
        input.value = pw;
        toggle.setAttribute("aria-pressed", "true");
        toggle.setAttribute("aria-label", "Hide password");
      }
    });

    wrap.append(input, toggle);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn mini";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      const ok = await copyToClipboard(pw);
      setCopyStatus(ok ? `Copied item #${idx + 1}` : "Copy failed", ok);
    });

    item.append(wrap, btn);
    els.batchList.appendChild(item);
  });
}

let remaskTimer;
function bindEvents() {
  els.generate?.addEventListener("click", doGenerate);

  els.copy?.addEventListener("click", async () => {
    const text = els.password?.value || "";
    if (!text) return;
    const ok = await copyToClipboard(text);
    setCopyStatus(ok ? "Copied!" : "Copy failed", ok);
  });

  els.download?.addEventListener("click", downloadPasswordsTXT);

  els.pwToggle?.addEventListener("click", () => {
    if (!els.password || !els.pwToggle) return;
    const isPw = els.password.type === "password";
    els.password.type = isPw ? "text" : "password";
    const pressed = isPw ? "true" : "false";
    els.pwToggle.setAttribute("aria-pressed", pressed);
    els.pwToggle.setAttribute("aria-label", isPw ? "Hide password" : "Show password");

    clearTimeout(remaskTimer);
    if (els.password.type === "text") {
      remaskTimer = setTimeout(() => {
        els.password.type = "password";
        els.pwToggle.setAttribute("aria-pressed","false");
        els.pwToggle.setAttribute("aria-label", "Show password");
      }, 10000);
    }
  });

  els.reset?.addEventListener("click", () => {
    if (els.length) els.length.value = 16;
    if (els.lowercase) els.lowercase.checked = true;
    if (els.uppercase) els.uppercase.checked = true;
    if (els.numbers) els.numbers.checked = true;
    if (els.symbols) els.symbols.checked = true;
    if (els.exclude) els.exclude.value = "";
    if (els.excludeLookalikes) els.excludeLookalikes.checked = false;
    if (els.batchCount) els.batchCount.value = 1;
    if (els.password) { els.password.value = ""; els.password.type = "password"; }
    if (els.pwToggle) { els.pwToggle.setAttribute("aria-pressed", "false"); els.pwToggle.setAttribute("aria-label", "Show password"); }
    if (els.batchList) els.batchList.innerHTML = "";
    if (els.strengthBar) els.strengthBar.style.width = "0%";
    if (els.strengthText) els.strengthText.textContent = "—";
    if (els.entropyText) els.entropyText.textContent = "Entropy: —";
    if (els.copyStatus) els.copyStatus.textContent = "";
    if (els.historySection) els.historySection.hidden = true;
    clearSetChecks();

    const sets = getActiveSets();
    const len = sanitizeLength(els.length?.value);
    updateStrengthUI(len, sets);
  });

  [els.length, els.lowercase, els.uppercase, els.numbers, els.symbols, els.exclude, els.excludeLookalikes]
    .filter(Boolean)
    .forEach(el => el.addEventListener("input", () => {
      const sets = getActiveSets();
      const len = sanitizeLength(els.length?.value);
      updateStrengthUI(len, sets);
    }));
}

function setupEnvironmentGuard() { disableInsecure(); }

window.addEventListener("DOMContentLoaded", () => {
  setupEnvironmentGuard();
  bindEvents();
  const initSets = getActiveSets();
  const initLen = sanitizeLength(els.length?.value);
  updateStrengthUI(initLen, initSets);
  if (els.historySection) els.historySection.hidden = true;
});

})();