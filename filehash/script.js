(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const textInput = $("#textInput");
  const fileInput = $("#fileInput");
  const fileMeta = $("#fileMeta");
  const hashBtn = $("#hashBtn");
  const clearBtn = $("#clearBtn");
  const resetOnRun = $("#resetOnRun");
  const resultsBody = $("#resultsBody");
  const copyAllBtn = $("#copyAllBtn");
  const downloadBtn = $("#downloadBtn");
  const knownChecksum = $("#knownChecksum");
  const progressWrap = $("#progressWrap");
  const progressBar = $("#progressBar");
  const progressLabel = $("#progressLabel");
  const cancelBtn = $("#cancelBtn");
  const sourceNote = $("#sourceNote");

  const genPbkdf2Salt = $("#genPbkdf2Salt");
  const genArgonSalt = $("#genArgonSalt");
  const pbkdf2Iter = $("#pbkdf2Iter");
  const pbkdf2Salt = $("#pbkdf2Salt");
  const pbkdf2Pepper = $("#pbkdf2Pepper");
  const argon2Time = $("#argon2Time");
  const argon2Mem = $("#argon2Mem");
  const argon2Par = $("#argon2Par");
  const argon2Salt = $("#argon2Salt");
  const argon2Pepper = $("#argon2Pepper");

  const genScryptSalt = $("#genScryptSalt");
  const scryptLn = $("#scryptLn");
  const scryptR = $("#scryptR");
  const scryptP = $("#scryptP");
  const scryptLen = $("#scryptLen");
  const scryptSalt = $("#scryptSalt");
  const scryptPepper = $("#scryptPepper");

  const bcryptCost = $("#bcryptCost");
  const bcryptPepper = $("#bcryptPepper");

  const verifyPassword = $("#verifyPassword");
  const verifyPHC = $("#verifyPHC");
  const verifyPepper = $("#verifyPepper");
  const verifyKdfBtn = $("#verifyKdfBtn");
  const verifyKdfResult = $("#verifyKdfResult");

  let currentWorker = null;
  let currentMode = null;
  let canceled = false;

  $$(".algo").forEach(cb => { cb.checked = (cb.value === "SHA-256"); });

  const seenRows = new Set();

  const hexFromBuffer = (buf) => [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const utf8ToUint8 = (str) => new TextEncoder().encode(str);

  function randomSaltHex(len = 32) {
    const b = new Uint8Array(len);
    crypto.getRandomValues(b);
    return hexFromBuffer(b.buffer);
  }

  function ensureAutoSalt(inputEl) {
    if (!/^[0-9a-fA-F]{16,}$/.test(inputEl.value)) {
      inputEl.value = randomSaltHex(32);
    }
  }

  function setProgress(pct, label) {
    progressWrap.classList.remove("hidden");
    progressWrap.setAttribute("aria-hidden", "false");
    progressBar.style.width = Math.max(0, Math.min(100, pct)) + "%";
    progressLabel.textContent = label || `${pct.toFixed(1)}%`;
  }

  function startIndeterminate(label = "Working…") {
    progressWrap.classList.remove("hidden");
    progressWrap.setAttribute("aria-hidden", "false");
    progressBar.classList.add("indeterminate");
    progressLabel.textContent = label;
  }

  function stopIndeterminate() {
    progressBar.classList.remove("indeterminate");
  }

  function endProgress() {
    stopIndeterminate();
    progressWrap.classList.add("hidden");
    progressWrap.setAttribute("aria-hidden", "true");
    progressBar.style.width = "0%";
    progressLabel.textContent = "Done";
  }

  function addResultRow(algo, hex, match) {
    const hexLower = String(hex).trim().toLowerCase();
    const key = `${algo}:${hexLower}`;

    if (seenRows.has(key)) return;

    const exists = Array.from(resultsBody.querySelectorAll("tr")).some(r => {
      const a = r.children[0]?.textContent;
      const h = r.querySelector(".hashcell")?.textContent?.trim().toLowerCase();
      return a === algo && h === hexLower;
    });
    if (exists) { seenRows.add(key); return; }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${algo}</td>
      <td class="mono hashcell">${hex}</td>
      <td class="match ${match === true ? "ok" : match === false ? "bad" : ""}">
        ${match === true ? "✔" : match === false ? "✖" : ""}
      </td>
      <td class="actions-cell">
        <button class="btn small" data-copy="${hex}">Copy</button>
      </td>
    `;
    resultsBody.appendChild(tr);
    seenRows.add(key);
  }

  function clearResults() {
    resultsBody.innerHTML = "";
    seenRows.clear();
  }

  function buildSelectedAlgos() { return $$(".algo:checked").map(x => x.value); }

  function showSourceNote(source) { sourceNote.textContent = source ? `Source: ${source}` : ""; }

  $$("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const dlg = document.getElementById(id);
      if (!dlg) return;
      if (id === "pbkdf2Modal") ensureAutoSalt(pbkdf2Salt);
      if (id === "argon2Modal") ensureAutoSalt(argon2Salt);
      if (id === "scryptModal") ensureAutoSalt(scryptSalt);
      dlg.showModal();
    });
  });

  genPbkdf2Salt?.addEventListener("click", (e) => { e.preventDefault(); pbkdf2Salt.value = randomSaltHex(32); });
  genArgonSalt?.addEventListener("click", (e) => { e.preventDefault(); argon2Salt.value = randomSaltHex(32); });
  genScryptSalt?.addEventListener("click", (e) => { e.preventDefault(); scryptSalt.value = randomSaltHex(32); });

  textInput.addEventListener("input", () => {
    if (fileInput.value) {
      fileInput.value = "";
      fileMeta.textContent = "";
    }
  });

  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) textInput.value = "";
    fileMeta.textContent = f
      ? `${f.name} • ${(f.size/1048576).toFixed(2)} MiB • ${f.type || "application/octet-stream"}`
      : "";
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-copy]");
    if (b) {
      navigator.clipboard.writeText(b.getAttribute("data-copy") || "").then(() => {
        b.textContent = "Copied!";
        setTimeout(() => (b.textContent = "Copy"), 900);
      }).catch(() => {});
    }
  });

  cancelBtn.addEventListener("click", () => {
    if (currentWorker) {
      canceled = true;
      currentWorker.terminate();
      currentWorker = null;
      endProgress();
      cancelBtn.disabled = true;
      progressLabel.textContent = "Canceled";
    }
  });

  clearBtn.addEventListener("click", () => {
    textInput.value = "";
    fileInput.value = "";
    fileMeta.textContent = "";
    knownChecksum.value = "";
    verifyPassword.value = "";
    verifyPHC.value = "";
    verifyPepper.value = "";
    verifyKdfResult.textContent = "";
    clearResults();
    showSourceNote("");
  });

  hashBtn.addEventListener("click", async () => {
    const algos = buildSelectedAlgos();
    if (algos.length === 0) return alert("Pick at least one algorithm.");
    if (resetOnRun.checked) clearResults();
    canceled = false;

    let payload;
    if (fileInput.files && fileInput.files[0]) {
      const f = fileInput.files[0];
      currentMode = "file";
      showSourceNote(`File: ${f.name}`);
      payload = { kind: "file", size: f.size };
    } else {
      currentMode = "text";
      showSourceNote("Text input");
      payload = { kind: "text", bytes: utf8ToUint8(textInput.value) };
    }

    const worker = new Worker('worker.js', { type: 'classic' });
    currentWorker = worker;
    cancelBtn.disabled = false;

    worker.onmessage = async (ev) => {
      if (canceled) return;
      const { type } = ev.data || {};

      if (type === "ready" && currentMode === "file") {
        const f = fileInput.files[0];
        const CHUNK = 4 * 1024 * 1024;
        let offset = 0;
        while (!canceled && offset < f.size) {
          const slice = f.slice(offset, Math.min(offset + CHUNK, f.size));
          const buf = await slice.arrayBuffer();
          worker.postMessage({ chunk: buf }, [buf]);
          offset += CHUNK;
        }
        if (!canceled) worker.postMessage({ done: true });
        return;
      }
      if (type === "progress") { stopIndeterminate(); setProgress(ev.data.pct, ev.data.label); return; }
      if (type === "result") {
        const algo = ev.data.algo;
        const hex = String(ev.data.hex);
        const ref = (knownChecksum.value || "").trim().toLowerCase();
        const match = ref ? (ref === hex.toLowerCase()) : null;
        addResultRow(algo, hex, match);
        return;
      }
      if (type === "error") { endProgress(); cancelBtn.disabled = true; alert("Error: " + ev.data.msg); worker.terminate(); currentWorker = null; return; }
      if (type === "done") { endProgress(); cancelBtn.disabled = true; worker.terminate(); currentWorker = null; return; }

      if (type === "verify-kdf-result") {
        verifyKdfResult.textContent = ev.data.ok
          ? `✔ Verified (${ev.data.algo})`
          : `✖ Not a match (${ev.data.algo || 'unknown'})`;
        return;
      }
    };

    const taskId = Math.random().toString(36).slice(2);
    worker.postMessage({
      taskId,
      action: "hash",
      payload: payload.kind === "text" ? payload : { kind: "file", size: payload.size },
      algos,
      kdfs: {
        pbkdf2: $(`.algo[value="PBKDF2"]`)?.checked ? {
          iter: parseInt(pbkdf2Iter.value, 10) || 600000,
          saltHex: (pbkdf2Salt.value || randomSaltHex(32)).toLowerCase(),
          pepper: pbkdf2Pepper.value || "",
        } : null,
        argon2: $(`.algo[value="Argon2id"]`)?.checked ? {
          t: parseInt(argon2Time.value, 10) || 3,
          m: parseInt(argon2Mem.value, 10) || 65536,
          p: parseInt(argon2Par.value, 10) || 1,
          saltHex: (argon2Salt.value || randomSaltHex(32)).toLowerCase(),
          pepper: argon2Pepper.value || "",
        } : null,
        scrypt: $(`.algo[value="scrypt"]`)?.checked ? {
          ln: parseInt(scryptLn.value, 10) || 15,
          r:  parseInt(scryptR.value, 10)  || 8,
          p:  parseInt(scryptP.value, 10)  || 1,
          len:parseInt(scryptLen.value,10) || 32,
          saltHex: (scryptSalt.value || randomSaltHex(32)).toLowerCase(),
          pepper: scryptPepper.value || ""
        } : null,
        bcrypt: $(`.algo[value="bcrypt"]`)?.checked ? {
          cost: parseInt(bcryptCost.value, 10) || 12,
          pepper: bcryptPepper.value || ""
        } : null
      }
    });

    if (currentMode === "file") {
      setProgress(0, "Reading file…");
    } else {
      startIndeterminate("Hashing…");
    }
  });

  copyAllBtn.addEventListener("click", () => {
    const rows = $$("#resultsBody tr");
    const out = [];
    rows.forEach(r => {
      const algo = r.children[0].textContent;
      const hex = r.querySelector(".hashcell").textContent;
      out.push({ algorithm: algo, hash: hex });
    });
    navigator.clipboard.writeText(JSON.stringify(out, null, 2)).then(() => {
      copyAllBtn.textContent = "Copied!";
      setTimeout(() => (copyAllBtn.textContent = "Copy JSON"), 900);
    });
  });

  downloadBtn.addEventListener("click", () => {
    const rows = $$("#resultsBody tr");
    if (!rows.length) return;
    let lines = [];
    rows.forEach(r => {
      const algo = r.children[0].textContent;
      const hex = r.querySelector(".hashcell").textContent;
      lines.push(`${hex}  (${algo})`);
    });
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "checksums.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  verifyKdfBtn?.addEventListener("click", () => {
    const password = verifyPassword.value || "";
    const phc = verifyPHC.value || "";
    const pepper = verifyPepper.value || "";
    if (!password || !phc) {
      verifyKdfResult.textContent = "Enter password and PHC/MCF string.";
      return;
    }
    const worker = new Worker('worker.js', { type: 'classic' });
    worker.onmessage = (ev) => {
      const { type, ok, algo, msg } = ev.data || {};
      if (type === "verify-kdf-result") {
        verifyKdfResult.textContent = ok ? `✔ Verified (${algo})` : `✖ Not a match (${algo || 'unknown'})`;
      } else if (type === "error") {
        verifyKdfResult.textContent = `Error: ${msg}`;
      }
      worker.terminate();
    };
    worker.postMessage({ action: "verifyKdf", password, phc, pepper });
    verifyKdfResult.textContent = "Verifying…";
  });

  window.addEventListener("DOMContentLoaded", () => {
  });

})();
