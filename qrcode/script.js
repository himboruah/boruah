(function () {
  const generateBtn = document.getElementById('generateButton');
  const resetBtn = document.getElementById('resetButton');
  const downloadLink = document.getElementById('downloadLink');
  const downloadSvgLink = document.getElementById('downloadSvgLink');
  const qrContainer = document.getElementById('qrContainer');
  const canvas = document.getElementById('qrCanvas');
  const errorMsg = document.getElementById('errorMsg');
  
  const qrDarkColor = document.getElementById('qrDarkColor');
  const qrLightColor = document.getElementById('qrLightColor');
  const qrErrorCorrection = document.getElementById('qrErrorCorrection');
  const qrSize = document.getElementById('qrSize');
  const qrSizeValue = document.getElementById('qrSizeValue');

  const dataTypeTabs = document.querySelector('.data-type-tabs');
  let activeFormId = 'textForm';
  
  const textInput = document.getElementById('textInput');
  const wifiSsid = document.getElementById('wifiSsid');
  const wifiPass = document.getElementById('wifiPass');
  const wifiEnc = document.getElementById('wifiEnc');
  const contactName = document.getElementById('contactName');
  const contactPhone = document.getElementById('contactPhone');
  const contactEmail = document.getElementById('contactEmail');
  const contactUrl = document.getElementById('contactUrl');
  const smsPhone = document.getElementById('smsPhone');
  const smsBody = document.getElementById('smsBody');
  const geoLat = document.getElementById('geoLat');
  const geoLon = document.getElementById('geoLon');
  const eventTitle = document.getElementById('eventTitle');
  const eventLocation = document.getElementById('eventLocation');
  const eventStart = document.getElementById('eventStart');
  const eventEnd = document.getElementById('eventEnd');

  const allFormInputs = [
    textInput, wifiSsid, wifiPass, contactName, contactPhone, contactEmail, contactUrl,
    smsPhone, smsBody, geoLat, geoLon, eventTitle, eventLocation, eventStart, eventEnd
  ];

  let __lastPngUrl = null;
  let __lastSvgUrl = null;

  if (qrSize && qrSizeValue) {
    qrSize.addEventListener('input', () => {
      qrSizeValue.textContent = `${qrSize.value}px`;
    });
    qrSize.addEventListener('change', () => {
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
      }
    });
  }

  function hideQrCode() {
    if (qrContainer) qrContainer.classList.add('hidden');
    if (downloadLink) downloadLink.classList.add('hidden');
    if (downloadSvgLink) downloadSvgLink.classList.add('hidden');
    if (resetBtn) resetBtn.classList.add('hidden');

    if (__lastPngUrl) { URL.revokeObjectURL(__lastPngUrl); __lastPngUrl = null; }
    if (__lastSvgUrl) { URL.revokeObjectURL(__lastSvgUrl); __lastSvgUrl = null; }
  }

  if (dataTypeTabs) {
    dataTypeTabs.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      
      activeFormId = e.target.dataset.form;
      
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      document.querySelectorAll('.form-content').forEach(form => {
        if (!form.classList.contains('hidden')) form.classList.add('hidden');
      });
      document.getElementById(activeFormId).classList.remove('hidden');
      
      validateInputs();
    });
  }

  function validateInputs() {
    hideQrCode(); 
    if (!generateBtn) return;
    let isValid = false;
    switch (activeFormId) {
      case 'textForm': isValid = textInput.value.trim() !== ''; break;
      case 'wifiForm': isValid = wifiSsid.value.trim() !== ''; break;
      case 'contactForm': isValid = contactName.value.trim() !== '' || contactPhone.value.trim() !== '' || contactEmail.value.trim() !== ''; break;
      case 'smsForm': isValid = smsPhone.value.trim() !== ''; break;
      case 'geoForm': isValid = geoLat.value.trim() !== '' && geoLon.value.trim() !== ''; break;
      case 'calendarForm': isValid = eventTitle.value.trim() !== '' && eventStart.value !== '' && eventEnd.value !== ''; break;
    }
    generateBtn.disabled = !isValid;
  }
  
  allFormInputs.forEach(input => {
    if (input) input.addEventListener('input', validateInputs);
  });
  if (wifiEnc) wifiEnc.addEventListener('change', validateInputs);
  
  function setupAutoGenerate() {
    const options = [qrDarkColor, qrLightColor, qrErrorCorrection];
    options.forEach(option => {
      if (option) {
        option.addEventListener('change', () => {
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
          }
        });
      }
    });
  }
  setupAutoGenerate();

  function escapeWifiField(s) {
    return s.replace(/([\\;,"'])/g, '\\$1');
  }

  function buildWifiString(ssid, pass, enc) {
    const T = enc === 'nopass' ? 'nopass' : enc;
    const S = escapeWifiField(ssid || '');
    const P = enc === 'nopass' ? '' : `;P:${escapeWifiField(pass || '')}`;
    return `WIFI:T:${T};S:${S}${P};;`;
  }

  function escapeVCard(s) {
    return (s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  }

  function buildVCard({ name, phone, email, url }) {
    const trimmed = (name || '').trim();
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:;;;;',
      `FN:${escapeVCard(trimmed)}`
    ];
    if (phone && phone.trim()) lines.push(`TEL:${escapeVCard(phone.trim())}`);
    if (email && email.trim()) lines.push(`EMAIL:${escapeVCard(email.trim())}`);
    if (url && url.trim())   lines.push(`URL:${escapeVCard(url.trim())}`);
    lines.push('END:VCARD');
    return lines.join('\n');
  }

  function escapeICS(s) {
    return (s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  }

  function formatLocalToICS(dtLocal) {
    const pad = n => String(n).padStart(2, '0');
    const y = dtLocal.getFullYear();
    const m = pad(dtLocal.getMonth() + 1);
    const d = pad(dtLocal.getDate());
    const H = pad(dtLocal.getHours());
    const M = pad(dtLocal.getMinutes());
    const S = pad(dtLocal.getSeconds());
    return `${y}${m}${d}T${H}${M}${S}`;
  }

  function buildICS({ title, location, start, end }) {
    const dtStart = new Date(start);
    const dtEnd = new Date(end);

    const DTSTART = formatLocalToICS(dtStart);
    const DTEND = formatLocalToICS(dtEnd);

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const DTSTAMP = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const UID = `qr-${now.getTime()}-${Math.random().toString(16).slice(2)}@local`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//QR//Generator//EN',
      'BEGIN:VEVENT',
      `UID:${UID}`,
      `DTSTAMP:${DTSTAMP}`,
      `SUMMARY:${escapeICS(title || '')}`,
      location && location.trim() ? `LOCATION:${escapeICS(location.trim())}` : '',
      `DTSTART:${DTSTART}`,
      `DTEND:${DTEND}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean);

    return lines.join('\n');
  }

  function generateDownloads(qrText, options) {
    const size = Number(options.width) || 1000;

    if (canvas) {
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    }

    const canvasOptions = { ...options, width: size, height: size };
    const tempCanvas = document.createElement('canvas');

    QRCode.toCanvas(tempCanvas, qrText, canvasOptions, function (error) {
      if (error) {
        console.error(error);
        if (errorMsg) errorMsg.classList.remove('hidden');
        return;
      }
      if (errorMsg) errorMsg.classList.add('hidden');
      if (qrContainer) qrContainer.classList.remove('hidden');

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

      tempCanvas.toBlob(function (blob) {
        if (!blob) return;
        if (__lastPngUrl) { URL.revokeObjectURL(__lastPngUrl); __lastPngUrl = null; }
        const url = URL.createObjectURL(blob);
        __lastPngUrl = url;
        if (downloadLink) {
          downloadLink.href = url;
          downloadLink.download = 'qr-code.png';
          downloadLink.classList.remove('hidden');
        }
      }, 'image/png', 1.0);
    });

    const svgOptions = { ...options, width: size, type: 'svg' };
    QRCode.toString(qrText, svgOptions, function (error, svgString) {
      if (error) return;
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      if (__lastSvgUrl) { URL.revokeObjectURL(__lastSvgUrl); __lastSvgUrl = null; }
      const url = URL.createObjectURL(blob);
      __lastSvgUrl = url;
      if (downloadSvgLink) {
        downloadSvgLink.href = url;
        downloadSvgLink.download = 'qr-code.svg';
        downloadSvgLink.classList.remove('hidden');
      }
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      let qrText = '';
      
      switch(activeFormId) {
        case 'textForm':
          qrText = textInput.value.trim();
          break;

        case 'wifiForm': {
          const ssid = wifiSsid.value.trim();
          const pass = wifiPass.value.trim();
          const enc  = wifiEnc.value;
          qrText = buildWifiString(ssid, pass, enc);
          break;
        }

        case 'contactForm':
          qrText = buildVCard({
            name: contactName.value.trim(),
            phone: contactPhone.value.trim(),
            email: contactEmail.value.trim(),
            url: contactUrl.value.trim()
          });
          break;

        case 'smsForm':
          qrText = `SMSTO:${smsPhone.value.trim()}:${smsBody.value.trim()}`;
          break;

        case 'geoForm':
          qrText = `geo:${geoLat.value.trim()},${geoLon.value.trim()}`;
          break;

        case 'calendarForm': {
          const start = eventStart.value;
          const end = eventEnd.value;
          qrText = buildICS({
            title: eventTitle.value.trim(),
            location: eventLocation.value.trim(),
            start, end
          });
          break;
        }
      }
      
      if (!qrText) return;

      const options = {
        width: qrSize.value,
        margin: 2,
        color: {
          dark: qrDarkColor.value,
          light: qrLightColor.value,
        },
        errorCorrectionLevel: qrErrorCorrection.value
      };

      generateDownloads(qrText, options);
      if (resetBtn) resetBtn.classList.remove('hidden');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      allFormInputs.forEach(input => { if (input) input.value = ''; });
      if (wifiEnc) wifiEnc.value = 'WPA';
      if (qrSize) {
        qrSize.value = '1000';
        if (qrSizeValue) qrSizeValue.textContent = `${qrSize.value}px`;
      }
      validateInputs();
      hideQrCode();
    });
  }

  const toggleScanBtn = document.getElementById('toggleScanBtn');
  const torchBtn = document.getElementById('torchBtn');
  const imageInput = document.getElementById('imageInput');
  const continuousScan = document.getElementById('continuousScan');
  const video = document.getElementById('video');
  const videoWrap = document.getElementById('videoWrap');
  const captureCanvas = document.getElementById('captureCanvas');
  const supportNotice = document.getElementById('supportNotice');
  const copyBtn = document.getElementById('copyBtn');
  const resultDisplay = document.getElementById('resultDisplay');
  const scanResult = document.getElementById('scanResult');
  const actionBtnsContainer = document.getElementById('actionBtnsContainer');
  const readerResetBtn = document.getElementById('readerResetBtn');
  const dropZone = document.getElementById('dropZone');

  let stream = null;
  let scanning = false;
  let detector = null;
  let useJsQR = false;
  let rafId = null;
  let videoTrack = null;
  let isTorchOn = false;
  let recentScans = [];

  function showSupport(msg, isError = false) {
    if (!supportNotice) return;
    supportNotice.textContent = msg;
    supportNotice.classList.remove('hidden');
    supportNotice.style.color = isError ? 'var(--error)' : '#d1f7ff';
  }

  function hideSupport() {
    if (supportNotice) supportNotice.classList.add('hidden');
  }

  function showResult(text) {
    if (resultDisplay) resultDisplay.classList.remove('hidden');
    
    if (continuousScan.checked) {
      if (recentScans.includes(text)) return;
      recentScans.unshift(text);
      if (recentScans.length > 10) recentScans.pop();
      scanResult.value = recentScans.join('\n');
    } else {
      scanResult.value = text;
    }
  
    if (actionBtnsContainer) {
      while (actionBtnsContainer.children.length > 2) {
        actionBtnsContainer.removeChild(actionBtnsContainer.children[1]);
      }
    }
    
    function createActionButton(btnText, href = null) {
        const actionBtn = document.createElement(href ? 'a' : 'button');
        actionBtn.textContent = btnText;
        actionBtn.className = 'btn';
        if (href) {
            actionBtn.href = href;
            if (href.startsWith('http')) {
                actionBtn.target = '_blank';
                actionBtn.rel = 'noopener noreferrer';
            }
        }
        actionBtnsContainer.insertBefore(actionBtn, readerResetBtn);
        return actionBtn;
    }
  
    if (text.startsWith('http://') || text.startsWith('https://')) {
      createActionButton('Open Link', text);
    } 
    else if (text.startsWith('WIFI:')) {
      const passMatch = text.match(/P:([^;]*)/);
      if (passMatch && passMatch[1]) {
        const password = passMatch[1];
        const copyPassBtn = createActionButton('Copy Password');
        copyPassBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(password).then(() => {
            copyPassBtn.textContent = 'Copied!';
            setTimeout(() => copyPassBtn.textContent = 'Copy Password', 2000);
          });
        });
      }
    } 
    else if (text.startsWith('BEGIN:VCARD')) {
      const downloadVcfBtn = createActionButton('Add to Contacts');
      downloadVcfBtn.addEventListener('click', () => {
          const blob = new Blob([text], { type: 'text/vcard;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'contact.vcf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      });
    }
    else if (text.startsWith('SMSTO:')) {
        createActionButton('Send SMS', text);
    }
    else if (text.startsWith('geo:')) {
        createActionButton('Open in Maps', text);
    }
    else if (text.startsWith('BEGIN:VCALENDAR')) {
      const downloadIcsBtn = createActionButton('Add to Calendar');
      downloadIcsBtn.addEventListener('click', () => {
          const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'event.ics';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      });
    }
    else if (text.startsWith('mailto:')) {
        createActionButton('Send Email', text);
    }
    else if (text.startsWith('tel:')) {
        createActionButton('Call', text);
    }
  }

  function resetReaderUI() {
    if(resultDisplay) resultDisplay.classList.add('hidden');
    if(scanResult) scanResult.value = '';
    recentScans = [];
  }

  async function initDetector() {
    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return true;
      } catch (e) {
        console.error("BarcodeDetector init failed:", e);
      }
    }
    return false;
  }

  async function startScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showSupport('Camera access is not supported by this browser.', true);
      return;
    }
    hideSupport();
    const bdSupported = await initDetector();
    useJsQR = !bdSupported;
    if (useJsQR && typeof jsQR !== 'function') {
      showSupport('jsQR fallback not available. Please include jsqr.min.js.', true);
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      
      resetReaderUI(); 

      if (video) video.srcObject = stream;
      await video.play();
      
      videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();
      if (capabilities.torch) {
        if (torchBtn) torchBtn.classList.remove('hidden');
      }

      if (videoWrap) videoWrap.classList.remove('hidden');
      scanning = true;
      if (toggleScanBtn) {
        toggleScanBtn.textContent = 'Stop';
        toggleScanBtn.classList.add('active-scan');
      }
      if (useJsQR) {
        showSupport('Using jsQR fallback for live scanning.');
        scanLoopJsQR();
      } else {
        scanLoopBD();
      }
    } catch (err) {
      console.error(err);
      showSupport('Camera access failed. Please grant permission or use the image decoder.', true);
    }
  }

  function stopScanner() {
    scanning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (toggleScanBtn) {
      toggleScanBtn.textContent = 'Start Scanner';
      toggleScanBtn.classList.remove('active-scan');
    }
    
    if (isTorchOn && videoTrack) {
      videoTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(()=>{});
      isTorchOn = false;
    }
    if (torchBtn) torchBtn.classList.add('hidden');
    videoTrack = null;

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
    if (videoWrap) videoWrap.classList.add('hidden');
  }

  function handleScanSuccess(text) {
    showResult(text);
    if (!continuousScan.checked) {
      stopScanner();
    }
  }

  async function scanLoopBD() {
    if (!scanning) return;
    try {
      const barcodes = await detector.detect(video);
      if (barcodes && barcodes.length) {
        handleScanSuccess(barcodes[0].rawValue || '');
        if (continuousScan.checked) {
          rafId = requestAnimationFrame(scanLoopBD);
        }
        return;
      }
    } catch (e) { console.error("Barcode detection failed:", e); }
    rafId = requestAnimationFrame(scanLoopBD);
  }
  
  function scanLoopJsQR() {
    if (!scanning || !captureCanvas) return;
    const ctx = captureCanvas.getContext('2d', { willReadFrequently: true });
    const vw=video.videoWidth||1280;const vh=video.videoHeight||720;const maxW=1280;const scale=Math.min(1,maxW/vw);captureCanvas.width=Math.max(1,Math.floor(vw*scale));captureCanvas.height=Math.max(1,Math.floor(vh*scale));ctx.drawImage(video,0,0,captureCanvas.width,captureCanvas.height);const imgData=ctx.getImageData(0,0,captureCanvas.width,captureCanvas.height);
    try {
      const code = jsQR(imgData.data, imgData.width, imgData.height);
      if (code && code.data) {
        handleScanSuccess(code.data);
        if (continuousScan.checked) {
          rafId = requestAnimationFrame(scanLoopJsQR);
        }
        return;
      }
    } catch (e) {}
    rafId = requestAnimationFrame(scanLoopJsQR);
  }

  async function decodeImageFile(file) {
    hideSupport();
    if (!file || !captureCanvas) return;
    const ctx=captureCanvas.getContext('2d',{willReadFrequently:true});
    const bitmap=await createImageBitmap(file);
    const maxW=1600;
    const scale=Math.min(1,maxW/bitmap.width);
    captureCanvas.width=Math.max(1,Math.floor(bitmap.width*scale));
    captureCanvas.height=Math.max(1,Math.floor(bitmap.height*scale));
    ctx.clearRect(0,0,captureCanvas.width,captureCanvas.height);
    ctx.drawImage(bitmap,0,0,captureCanvas.width,captureCanvas.height);

    if (await initDetector()) {
      try {
        let bdImg;
        if (typeof captureCanvas.transferToImageBitmap === 'function') {
          bdImg = captureCanvas.transferToImageBitmap();
        } else {
          bdImg = await createImageBitmap(captureCanvas);
        }
        const r = await detector.detect(bdImg);
        if (r && r.length) {
          handleScanSuccess(r[0].rawValue || '');
          return;
        }
      } catch (e) {
      }
    }

    if (typeof jsQR === 'function') {
      try {
        const imgData = ctx.getImageData(0,0,captureCanvas.width,captureCanvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts:'attemptBoth' });
        if (code && code.data) {
          handleScanSuccess(code.data);
          return;
        }
        showSupport('No QR code found in the image.', true);
      } catch (e) {
        console.error(e);
        showSupport('Failed to decode the image.', true);
      }
    } else {
      showSupport('jsQR not found. Please include jsqr.min.js for image decoding fallback.', true);
    }
  }
  
  if (readerResetBtn) {
    readerResetBtn.addEventListener('click', resetReaderUI);
  }

  if (torchBtn) {
    torchBtn.addEventListener('click', async () => {
      if (videoTrack) {
        const next = !isTorchOn;
        try {
          await videoTrack.applyConstraints({ advanced: [{ torch: next }] });
          isTorchOn = next;
        } catch (e) {
        }
      }
    });
  }

  if (toggleScanBtn) {
    toggleScanBtn.addEventListener('click', () => {
      if (scanning) {
        stopScanner();
      } else {
        startScanner();
      }
    });
  }
  
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        resetReaderUI();
        decodeImageFile(file);
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!scanResult || !scanResult.value) return;
      try {
        await navigator.clipboard.writeText(scanResult.value);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
      } catch {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
      }
    });
  }

  if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('is-dragover');
      });
      dropZone.addEventListener('dragleave', () => {
          dropZone.classList.remove('is-dragover');
      });
      dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('is-dragover');
          const files = e.dataTransfer.files;
          if (files.length > 0) {
              const file = files[0];
              if (file.type.startsWith('image/')) {
                  decodeImageFile(file);
              } else {
                  showSupport('Please drop an image file.', true);
              }
          }
      });
  }

  (function showInitialSupport() {
    if (!('BarcodeDetector' in window)) {
      if (typeof jsQR === 'function') {
        showSupport('Live scanning will use the jsQR fallback on this browser.');
      } else {
        showSupport('Tip: This browser lacks BarcodeDetector. Add jsQR (jsqr.min.js) or use a supported browser.', true);
      }
    }
  })();

  const viewportEl = document.querySelector(".viewport");
  const sliderTrack = document.getElementById("sliderTrack");
  const panels = {
    panel1: document.getElementById("panel1"),
    panel2: document.getElementById("panel2"),
  };
  let currentPanel = "panel1";

  if (viewportEl && sliderTrack && panels.panel1 && panels.panel2) {
    const setViewportHeight = (panel) => {
      requestAnimationFrame(() => {
        viewportEl.style.height = panel.offsetHeight + "px";
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const panel = entry.target;
        setViewportHeight(panel);
      }
    });

    document.querySelectorAll(".switcher").forEach(button => {
      button.addEventListener('click', () => {
        const targetPanelId = button.dataset.target;
        if (targetPanelId === currentPanel) return;

        if (currentPanel === 'panel2' && scanning) {
          stopScanner();
        }

        const currentPanelEl = panels[currentPanel];
        const targetPanelEl = panels[targetPanelId];

        resizeObserver.unobserve(currentPanelEl);
        resizeObserver.observe(targetPanelEl);

        currentPanelEl.setAttribute("aria-hidden", "true");
        currentPanelEl.inert = true;

        targetPanelEl.setAttribute("aria-hidden", "false");
        targetPanelEl.inert = false;
        
        targetPanelEl.focus({ preventScroll: true });

        sliderTrack.classList.remove(`track--show-${currentPanel}`);
        sliderTrack.classList.add(`track--show-${targetPanelId}`);
        
        currentPanel = targetPanelId;
      });
    });

    resizeObserver.observe(panels.panel1);

    sliderTrack.classList.add('track--show-panel1');
    panels.panel2.inert = true;

    setTimeout(() => setViewportHeight(panels.panel1), 50);
  }
})();