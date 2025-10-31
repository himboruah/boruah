document.addEventListener("DOMContentLoaded", () => {
  const SAMPLES = {
    good: `From: Newsletters <news@example.com>
To: You <you@yourdomain.test>
Subject: Welcome!
Date: Tue, 6 Aug 2024 10:03:11 -0700
Message-ID: <12345@example.com>
Return-Path: <bounce@example.com>
Authentication-Results: mx.yourdomain.test; spf=pass smtp.mailfrom=example.com; dkim=pass (good) header.i=news@example.com; dmarc=pass (p=quarantine) header.from=example.com
Received: from mailout.example.com (mailout.example.com [203.0.113.5]) by mx.yourdomain.test with ESMTPS id abc123 for <you@yourdomain.test>; Tue, 06 Aug 2024 17:03:13 +0000 (UTC)
Received: from app.example.com (app.example.com [203.0.113.9]) by mailout.example.com with ESMTPS id def456; Tue, 06 Aug 2024 17:03:10 +0000 (UTC)`,
    softfail: `From: Spoofer <spoof@bad.tld>
To: you@yourdomain.test
Subject: Urgent
Date: Tue, 6 Aug 2024 10:03:11 -0700
Authentication-Results: mx.yourdomain.test; spf=softfail smtp.mailfrom=bad.tld; dkim=none; dmarc=fail (p=reject) header.from=yourbank.com
Received: from random.bad.tld (random.bad.tld [198.51.100.42]) by mx.yourdomain.test with ESMTP; Tue, 06 Aug 2024 17:03:13 +0000 (UTC)`,
    dkimfail: `From: Marketing <offers@shop.example>
To: you@yourdomain.test
Subject: Deals
Date: Tue, 6 Aug 2024 10:03:11 -0700
Authentication-Results: mx.yourdomain.test; spf=pass smtp.mailfrom=shop.example; dkim=fail (body hash mismatch) header.i=offers@shop.example; dmarc=fail (p=quarantine) header.from=shop.example
Received: from mta.shop.example (mta.shop.example [203.0.113.55]) by mx.yourdomain.test with ESMTPS; Tue, 06 Aug 2024 17:03:13 +0000 (UTC)`,
    forwarded: `From: Friend <friend@gmail.com>
To: you@yourdomain.test
Subject: Fwd: Check this
Date: Tue, 6 Aug 2024 10:03:11 -0700
Authentication-Results: mx.yourdomain.test; spf=pass smtp.mailfrom=gmail.com; dkim=pass header.i=gmail.com; dmarc=pass header.from=gmail.com
Received: from mail-io1-f44.google.com (mail-io1-f44.google.com [209.85.166.44]) by mx.yourdomain.test with ESMTPS; Tue, 06 Aug 2024 17:03:13 +0000 (UTC)
ARC-Seal: i=1; a=rsa-sha256; d=mx.yourdomain.test; s=arc; cv=pass; b=...`,
  };

  const headerInput = document.getElementById("headerInput");
  const validationMsg = document.getElementById("validationMsg");
  const resultBox = document.getElementById("result");
  const analysisTemplate = document.getElementById("analysisTemplate");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const clearBtn = document.getElementById("clearBtn");
  const sampleBtn = document.getElementById("sampleBtn");
  const sampleMenu = document.getElementById("sampleMenu");
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const copyAllBtn = document.getElementById("copyAllBtn");
  const copyMdBtn = document.getElementById("copyMdBtn");
  const downloadJsonBtn = document.getElementById("downloadJsonBtn");
  const downloadCsvBtn = document.getElementById("downloadCsvBtn");

  let lastResult = null;

  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[m]));
  const unfold = (text) => String(text).replace(/\r?\n([ \t]+)/g, " ");
  const cap = (m, i = 1) => (m && m[i] ? m[i] : null);
  const relaxedAlign = (child, parent) => {
    if (!child || !parent) return false;
    const c = child.toLowerCase().trim();
    const p = parent.toLowerCase().trim();
    return c === p || c.endsWith("." + p);
  };
  const setValidation = (msg = "") => {
    validationMsg.textContent = msg;
  };

  const getHeaderValue = (block, name) => {
    const re = new RegExp(`^${name}\\s*:\\s*(.+)$`, "im");
    return cap(block.match(re));
  };

  const parseAuthResults = (block) => {
    const joined = (block.match(/^Authentication-Results:[^\n]+$/gim) || []).join(" || ");
    return {
      spf: {
        result: cap(joined.match(/\bspf\s*=\s*([a-z-]+)/i)),
        domain: cap(joined.match(/\b(?:smtp\.mailfrom|envelope-from)\s*=\s*([^;\s]+)/i)),
        aligned: null,
        expl: cap(joined.match(/spf=[^;]+;\s*([^)]+)\)/i)),
      },
      dkim: {
        result: cap(joined.match(/\bdkim\s*=\s*([a-z-]+)/i)),
        domain: cap(joined.match(/\bd=([^;\s]+)/i)),
        selector: cap(joined.match(/\bs=([^;\s]+)/i)),
        aligned: null,
      },
      dmarc: {
        result: cap(joined.match(/\bdmarc\s*=\s*([a-z-]+)/i)),
        policy: cap(joined.match(/\bp=([^;\s]+)/i)),
        disposition: cap(joined.match(/\bdisposition\s*=\s*([^;\s]+)/i)),
        reason: cap(joined.match(/\breason\s*=\s*([^;\n]+)/i)),
      },
    };
  };

  const parseReceived = (block) => {
    const lines = block.split(/\r?\n/).filter((l) => /^Received\s*:/i.test(l));
    const timeline = [];
    const times = [];

    const ipV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
    const ipV6 = /\b(?:(?:[A-Fa-f0-9]{0,4}:){2,7}[A-Fa-f0-9]{0,4})\b/;
    const bracketIP = /\[([^\]]+)\]/;

    lines.forEach((raw) => {
      const line = raw.replace(/^Received\s*:\s*/i, "");
      const dateRaw = raw.split(";").pop().trim() || null;

      const dateMs = dateRaw ? Date.parse(dateRaw) : NaN;

      timeline.push({
        raw,
        from: cap(line.match(/\bfrom\s+([^\s(]+)|\bfrom\s+\(([^)]+)\)/i)),
        by: cap(line.match(/\bby\s+([^\s(]+)|\bby\s+\(([^)]+)\)/i)),
        ip: cap(line.match(bracketIP)) || cap(line.match(ipV4)) || cap(line.match(ipV6)),
        dateRaw,
        dateMs: Number.isFinite(dateMs) ? dateMs : null,
      });

      if (Number.isFinite(dateMs)) times.push(dateMs);
    });

    const ts = times.slice().sort((a, b) => a - b);
    const delays = [];
    for (let i = 1; i < ts.length; i++) {
      delays.push({
        hop: i,
        nextHop: i + 1,
        seconds: Math.max(0, Math.round((ts[i] - ts[i - 1]) / 1000)),
      });
    }

    return { timeline, delays, receivedRaw: lines };
  };

  const parseHeaders = (raw) => {
    const block = unfold(raw);
    const from = getHeaderValue(block, "From");
    const dateRaw = getHeaderValue(block, "Date");
    const fromDomain = cap((from || "").match(/@([^>\s]+)>?$/i));
    const auth = parseAuthResults(block);

    if (fromDomain) {
      auth.spf.aligned = auth.spf.domain ? relaxedAlign(auth.spf.domain, fromDomain) : null;
      auth.dkim.aligned = auth.dkim.domain ? relaxedAlign(auth.dkim.domain, fromDomain) : null;
    }

    let dateLocal = "";
    if (dateRaw) {
      const d = new Date(dateRaw);
      dateLocal = isNaN(+d) ? "Unrecognized format" : d.toLocaleString();
    }

    return {
      from,
      to: getHeaderValue(block, "To"),
      subject: getHeaderValue(block, "Subject"),
      dateRaw,
      dateLocal,
      messageId: getHeaderValue(block, "Message-ID") || getHeaderValue(block, "Message-Id"),
      returnPath: getHeaderValue(block, "Return-Path"),
      replyTo: getHeaderValue(block, "Reply-To"),
      fromDomain,
      auth,
      ...parseReceived(block),
    };
  };

  const badge = (el, val) => {
    el.textContent = val || "—";
    el.className = "badge";
    const v = (val || "").toLowerCase();
    if (v.includes("pass") || v === "ok") el.classList.add("pass");
    else if (v.includes("fail") || v.includes("reject") || v.includes("hardfail")) el.classList.add("fail");
    else el.classList.add("neutral");
  };

  const pill = (el, bool) => {
    if (bool === null) {
      el.textContent = "n/a";
      el.className = "pill";
    } else {
      el.textContent = bool ? "Yes" : "No";
      el.className = "pill";
    }
  };

  const renderAnalysis = (result) => {
    const tpl = analysisTemplate.content.cloneNode(true);
    const q = (sel) => tpl.querySelector(sel);

    q('[data-k="from"]').textContent = result.from || "—";
    q('[data-k="to"]').textContent = result.to || "—";
    q('[data-k="subject"]').textContent = result.subject || "—";
    q('[data-k="dateLocal"]').textContent = result.dateLocal || "—";
    q('[data-k="dateRaw"]').textContent = result.dateRaw || "—";
    q('[data-k="messageId"]').textContent = result.messageId || "—";
    q('[data-k="returnPath"]').textContent = result.returnPath || "—";
    q('[data-k="replyTo"]').textContent = result.replyTo || "—";

    badge(q('[data-k="spf.result"]'), result.auth.spf.result);
    q('[data-k="spf.domain"]').textContent = result.auth.spf.domain || "—";
    q('[data-k="spf.expl"]').textContent = result.auth.spf.expl || "—";
    pill(q('[data-k="spf.aligned"]'), result.auth.spf.aligned);

    badge(q('[data-k="dkim.result"]'), result.auth.dkim.result);
    q('[data-k="dkim.domain"]').textContent = result.auth.dkim.domain || "—";
    q('[data-k="dkim.selector"]').textContent = result.auth.dkim.selector || "—";
    pill(q('[data-k="dkim.aligned"]'), result.auth.dkim.aligned);

    badge(q('[data-k="dmarc.result"]'), result.auth.dmarc.result);
    q('[data-k="dmarc.policy"]').textContent = result.auth.dmarc.policy || "—";
    q('[data-k="dmarc.disposition"]').textContent = result.auth.dmarc.disposition || "—";
    q('[data-k="dmarc.reason"]').textContent = result.auth.dmarc.reason || "—";

    const tl = q('[data-k="timeline"]');
    if (result.timeline.length) {
      result.timeline.forEach((hop) => {
        const localDate = new Date(hop.dateMs).toLocaleString();
        const item = document.createElement("li");
        item.innerHTML = `
          <div class="item">
            <div><strong>From:</strong> ${esc(hop.from || "—")} &nbsp; <strong>By:</strong> ${esc(hop.by || "—")} &nbsp; <strong>IP:</strong> ${esc(hop.ip || "—")}</div>
            <div class="meta">${localDate !== "Invalid Date" ? localDate : ""} (raw: ${esc(hop.dateRaw)})</div>
          </div>`;
        tl.appendChild(item);
      });
    } else {
      tl.innerHTML = "<li>No Received lines found.</li>";
    }

    const delaysBox = q('[data-k="delays"]');
    if (result.delays.length) {
      result.delays.forEach((d) => {
        const p = document.createElement("div");
        p.className = "delay";
        p.textContent = `Hop ${d.hop} → Hop ${d.nextHop}: ${d.seconds} seconds`;
        delaysBox.appendChild(p);
      });
    } else {
      delaysBox.innerHTML = '<div class="delay">Not enough timestamps to compute hop delays.</div>';
    }

    const rawList = q('[data-k="receivedRaw"]');
    if (result.receivedRaw.length) {
      result.receivedRaw.forEach((line) => {
        const li = document.createElement("li");
        li.className = "mono";
        li.textContent = line;
        rawList.appendChild(li);
      });
    } else {
      rawList.innerHTML = "<li>—</li>";
    }

    resultBox.innerHTML = "";
    resultBox.appendChild(tpl);
  };

  const toPlainText = (r) =>
    [
      "=== Summary ===",
      `From: ${r.from || "—"}`,
      `To: ${r.to || "—"}`,
      `Subject: ${r.subject || "—"}`,
      `Date: ${r.dateLocal || "—"} (raw: ${r.dateRaw || "—"})`,
      `Message-ID: ${r.messageId || "—"}`,
      `Return-Path: ${r.returnPath || "—"}`,
      `Reply-To: ${r.replyTo || "—"}`,
      "\n=== Authentication ===",
      `SPF: ${r.auth.spf.result || "—"} | domain=${r.auth.spf.domain || "—"} | aligned=${r.auth.spf.aligned ?? "n/a"} | expl=${r.auth.spf.expl || "—"}`,
      `DKIM: ${r.auth.dkim.result || "—"} | d=${r.auth.dkim.domain || "—"} | s=${r.auth.dkim.selector || "—"} | aligned=${r.auth.dkim.aligned ?? "n/a"}`,
      `DMARC: ${r.auth.dmarc.result || "—"} | p=${r.auth.dmarc.policy || "—"} | disposition=${r.auth.dmarc.disposition || "—"} | reason=${r.auth.dmarc.reason || "—"}`,
      "\n=== Delivery Hops ===",
      ...r.timeline.map((h, i) => `${i + 1}. from=${h.from || "—"} by=${h.by || "—"} ip=${h.ip || "—"} date=${h.dateRaw || "—"}`),
      ...(r.delays.length ? ["Delays:", ...r.delays.map((d) => `  Hop ${d.hop} -> ${d.nextHop}: ${d.seconds}s`)] : []),
      "\n=== Raw Received ===",
      ...r.receivedRaw.map((l, i) => `${i + 1}. ${l}`),
    ].join("\n");

  const toMarkdown = (r) =>
    `# Email Header Analysis
## Summary
- **From:** ${r.from || "—"}
- **To:** ${r.to || "—"}
- **Subject:** ${r.subject || "—"}
- **Date:** ${r.dateLocal || "—"} (raw: ${r.dateRaw || "—"})
- **Message-ID:** ${r.messageId || "—"}
- **Return-Path:** ${r.returnPath || "—"}
- **Reply-To:** ${r.replyTo || "—"}

## Authentication
- **SPF:** ${r.auth.spf.result || "—"}
  - domain: ${r.auth.spf.domain || "—"}
  - aligned: ${r.auth.spf.aligned ?? "n/a"}
  - explanation: ${r.auth.spf.expl || "—"}
- **DKIM:** ${r.auth.dkim.result || "—"}
  - d=: ${r.auth.dkim.domain || "—"}
  - s=: ${r.auth.dkim.selector || "—"}
  - aligned: ${r.auth.dkim.aligned ?? "n/a"}
- **DMARC:** ${r.auth.dmarc.result || "—"}
  - policy: ${r.auth.dmarc.policy || "—"}
  - disposition: ${r.auth.dmarc.disposition || "—"}
  - reason: ${r.auth.dmarc.reason || "—"}

## Delivery Hops
${r.timeline.map((h, i) => `- Hop ${i + 1}: **from** ${h.from || "—"} **by** ${h.by || "—"} **ip** ${h.ip || "—"} **date** ${h.dateRaw || "—"}`).join("\n")}
${r.delays.length ? `\n### Hop Delays\n` + r.delays.map((d) => `- Hop ${d.hop} → Hop ${d.nextHop}: ${d.seconds} seconds`).join("\n") : ""}

## Raw Received Lines
${r.receivedRaw.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;

  const toCsv = (r) => {
    const E = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const rows = [["Section", "Key", "Value"]];
    Object.entries({
      Summary: { From: r.from, To: r.to, Subject: r.subject, "Date (local)": r.dateLocal, "Date (raw)": r.dateRaw, "Message-ID": r.messageId, "Return-Path": r.returnPath, "Reply-To": r.replyTo, },
      Auth: { "SPF result": r.auth.spf.result, "SPF domain": r.auth.spf.domain, "SPF aligned": r.auth.spf.aligned, "SPF explanation": r.auth.spf.expl, "DKIM result": r.auth.dkim.result, "DKIM domain": r.auth.dkim.domain, "DKIM selector": r.auth.dkim.selector, "DKIM aligned": r.auth.dkim.aligned, "DMARC result": r.auth.dmarc.result, "DMARC policy": r.auth.dmarc.policy, "DMARC disposition": r.auth.dmarc.disposition, "DMARC reason": r.auth.dmarc.reason, },
    }).forEach(([section, data]) => {
      Object.entries(data).forEach(([key, value]) => rows.push([section, key, value]));
    });
    rows.push([]);
    rows.push(["Hops", "Index", "Details"]);
    r.timeline.forEach((h, i) => {
      rows.push(["Hops", i + 1, `from=${h.from || "—"} | by=${h.by || "—"} | ip=${h.ip || "—"} | date=${h.dateRaw || "—"}`]);
    });
    if (r.delays.length) {
      rows.push([]);
      rows.push(["Delays", "Pair", "Seconds"]);
      r.delays.forEach((d) => rows.push(["Delays", `Hop ${d.hop}→${d.nextHop}`, d.seconds]));
    }
    return rows.map((row) => row.map(E).join(",")).join("\n");
  };

  const download = (filename, text, mime = "text/plain") => {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  };

  const analyzeNow = () => {
    const src = headerInput.value.trim();
    if (!src) {
      setValidation("Paste raw headers or load a sample/EML file first.");
      return;
    }
    setValidation("");
    lastResult = parseHeaders(src);
    renderAnalysis(lastResult);
  };

  const resetUI = () => {
    headerInput.value = "";
    resultBox.innerHTML = `<div class="empty">No analysis yet. Paste headers and click <strong>Analyze</strong>.</div>`;
    setValidation("");
    lastResult = null;
  };

  const extractHeaderBlock = (emlText) => {
    const idx = emlText.search(/\r?\n\r?\n/);
    return idx === -1 ? emlText.trim() : emlText.slice(0, idx).trim();
  };

  const loadFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    headerInput.value = extractHeaderBlock(text);
    setValidation(`Loaded ${file.name}. You can edit, then click Analyze.`);
  };

  analyzeBtn.addEventListener("click", analyzeNow);
  clearBtn.addEventListener("click", resetUI);
  headerInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      analyzeNow();
    }
  });

  sampleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sampleMenu.hidden = !sampleMenu.hidden;
  });
  document.addEventListener("click", () => (sampleMenu.hidden = true));
  sampleMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-sample]");
    if (!btn) return;
    const key = btn.dataset.sample;
    headerInput.value = SAMPLES[key] || "";
    sampleMenu.hidden = true;
    setValidation(`Loaded sample: ${key}`);
  });

  uploadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => loadFile(e.target.files?.[0]));

  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && /(\.eml|\.txt)$/i.test(file.name)) {
      loadFile(file);
    } else {
      setValidation("Please drop a .eml or .txt file.");
    }
  });

  copyAllBtn.addEventListener("click", async () => {
    if (!lastResult) return setValidation("Analyze first to get text to copy.");
    await navigator.clipboard.writeText(toPlainText(lastResult));
    setValidation("Copied plain text to clipboard.");
  });
  copyMdBtn.addEventListener("click", async () => {
    if (!lastResult) return setValidation("Analyze first to get Markdown to copy.");
    await navigator.clipboard.writeText(toMarkdown(lastResult));
    setValidation("Copied Markdown to clipboard.");
  });
  downloadJsonBtn.addEventListener("click", () => {
    if (!lastResult) return setValidation("Analyze first to get JSON to download.");
    download("email-analysis.json", JSON.stringify(lastResult, null, 2), "application/json");
  });
  downloadCsvBtn.addEventListener("click", () => {
    if (!lastResult) return setValidation("Analyze first to get CSV to download.");
    download("email-analysis.csv", toCsv(lastResult), "text/csv");
  });
});
