const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getInputValue(id) {
  const el = document.getElementById(id);
  if (el && (el.tagName === 'SELECT' || el.type === 'number')) return el.value;
  return el ? el.value.trim() : "";
}

function getSelectedValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "";
}

function setBgImage(id, dataUrl) {
  const el = document.getElementById(id);
  if (el) el.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : "none";
}

function showMsg(type, text) {
  const box = $("#messageBox");
  if (!box) return;
  box.classList.remove("ok", "err", "warn");
  box.classList.add(type);
  box.textContent = text;
}

function clearMsg() {
  showMsg("ok", "");
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 10) return "";
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

function isPastOrToday(dateStr) {
  if (!dateStr) return true;
  const [year, month, day] = dateStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d <= today;
}

function validDuration(s) {
  if (!s) return false;
  return s.trim().length > 0;
}

function markError(el, hasError) {
  if (!el) return;
  el.classList.toggle("error", !!hasError);
}

function sanitizeFilename(name) {
    if (!name) return "card";
    return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Failed to read file."));
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
}

function isValidImageFile(file) {
  if (!file) return true;
  const okType = /^image\/(png|jpeg|jpg|webp)$/i.test(file.type);
  const okSize = file.size <= 20 * 1024 * 1024;
  return okType && okSize;
}

let logoData = "";
let photoData = "";

$("#logoFile")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  markError(e.target, false);
  if (!file) {
    logoData = "";
    updatePreview();
    return;
  }
  if (!isValidImageFile(file)) {
    markError(e.target, true);
    showMsg("err", "Logo must be PNG/JPG/WebP and ≤ 20 MB.");
    return;
  }
  try {
    logoData = await fileToDataURL(file);
    clearMsg();
  } catch (error) {
    console.error("File read error:", error);
    showMsg("err", "Could not read the logo file.");
    logoData = "";
  }
  updatePreview();
});

$("#photoFile")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  markError(e.target, false);
  if (!file) {
    photoData = "";
    updatePreview();
    return;
  }
  if (!isValidImageFile(file)) {
    markError(e.target, true);
    showMsg("err", "Photo must be PNG/JPG/WebP and ≤ 20 MB.");
    return;
  }
  try {
    photoData = await fileToDataURL(file);
    clearMsg();
  } catch (error) {
    console.error("File read error:", error);
    showMsg("err", "Could not read the photo file.");
    photoData = "";
  }
  updatePreview();
});

function computeTitle() {
  const type = getSelectedValue("userType");
  if (!type || type === "general") return "Identity Card";
  if (type === "custom") return getInputValue("customCardType") || "Custom Identity Card";
  return `${type[0].toUpperCase()}${type.slice(1)} Identity Card`;
}

function applyTypeVisibility() {
  const type = getSelectedValue("userType");
  $("#rollNoField")?.classList.toggle("hidden", type !== "student");
  $("#employeeIdField")?.classList.toggle("hidden", type === "student");
  const customCardTypeInput = $("#customCardType");
  const isCustom = type === "custom";
  if (customCardTypeInput) {
    $("#customCardTypeContainer")?.classList.toggle("hidden", !isCustom);
    customCardTypeInput.required = isCustom;
  }
  $("#kRoll")?.classList.toggle("hidden", type !== "student");
  $("#vRoll")?.classList.toggle("hidden", type !== "student");
  const showEmp = type !== "student";
  $("#kEmp")?.classList.toggle("hidden", !showEmp);
  $("#vEmp")?.classList.toggle("hidden", !showEmp);
  let deptLabel = "Role/Dept";
  let deptPlaceholder = "e.g., Professor / Physics";
  if (type === 'student') {
    deptLabel = "Department";
    deptPlaceholder = "e.g., Computer Science";
  } else if (type === 'general' || type === 'custom') {
    deptLabel = "Role";
    deptPlaceholder = "e.g., Visitor, Guest Speaker";
  }
  setText("kDept", deptLabel);
  const labelForDept = $("#labelForDept");
  if (labelForDept) labelForDept.textContent = deptLabel;
  const roleOrDeptInput = $("#roleOrDept");
  if (roleOrDeptInput) roleOrDeptInput.placeholder = deptPlaceholder;
}

$$('input[name="userType"]').forEach(r => {
  r.addEventListener("change", () => {
    applyTypeVisibility();
    setTextContent("cardTitle", computeTitle());
    updatePreview();
  });
});

const gradients = {
  white: "linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0))",
  blue: "linear-gradient(180deg, rgba(30,144,255,0.4), rgba(30,144,255,0))",
  indigo: "linear-gradient(180deg, rgba(99,102,241,0.32), rgba(99,102,241,0))",
  purple: "linear-gradient(180deg, rgba(168,130,255,0.32), rgba(168,130,255,0))",
  violet: "linear-gradient(180deg, rgba(139,92,246,0.32), rgba(139,92,246,0))",
  magenta: "linear-gradient(180deg, rgba(217,70,239,0.32), rgba(217,70,239,0))",
  pink: "linear-gradient(180deg, rgba(236,72,153,0.32), rgba(236,72,153,0))",
  rose: "linear-gradient(180deg, rgba(244,63,94,0.32), rgba(244,63,94,0))",
  red: "linear-gradient(180deg, rgba(255,120,120,0.32), rgba(255,120,120,0))",
  orange: "linear-gradient(180deg, rgba(255,183,77,0.32), rgba(255,183,77,0))",
  amber: "linear-gradient(180deg, rgba(251,191,36,0.32), rgba(251,191,36,0))",
  yellow: "linear-gradient(180deg, rgba(250,204,21,0.32), rgba(250,204,21,0))",
  lime: "linear-gradient(180deg, rgba(163,230,53,0.32), rgba(163,230,53,0))",
  green: "linear-gradient(180deg, rgba(34,197,94,0.32), rgba(34,197,94,0))",
  emerald: "linear-gradient(180deg, rgba(16,185,129,0.32), rgba(16,185,129,0))",
  teal: "linear-gradient(180deg, rgba(45,212,191,0.32), rgba(45,212,191,0))",
  cyan: "linear-gradient(180deg, rgba(6,182,212,0.32), rgba(6,182,212,0))",
  sky: "linear-gradient(180deg, rgba(56,189,248,0.32), rgba(56,189,248,0))",
  azure: "linear-gradient(180deg, rgba(37,99,235,0.32), rgba(37,99,235,0))",
  gold: "linear-gradient(180deg, rgba(234,179,8,0.32), rgba(234,179,8,0))",
  silver: "linear-gradient(180deg, rgba(148,163,184,0.32), rgba(148,163,184,0))",
  bronze: "linear-gradient(180deg, rgba(205,127,50,0.32), rgba(205,127,50,0))",
  graphite: "linear-gradient(180deg, rgba(100,116,139,0.32), rgba(100,116,139,0))",
};

function gradientCSS(name) {
  return gradients[name] || gradients.blue;
}

$("#gradientTheme")?.addEventListener("change", (e) => {
  const theme = e.target.value || "blue";
  const card = $("#cardPreview");
  if (card) {
    card.style.setProperty("--header-gradient", gradientCSS(theme));
    card.setAttribute("data-gradient-theme", theme);
  }
});

function updatePreview() {
  clearMsg();
  const required = [
    ["collegeName", "Institution / Company is required."],
    ["personName", "Full Name is required."],
  ];
  for (const [id] of required) {
    const el = document.getElementById(id);
    if (el) markError(el, !getInputValue(id));
  }
  const type = getSelectedValue("userType");
  const customCardType = $("#customCardType");
  if (type === 'custom' && customCardType) {
    markError(customCardType, !getInputValue("customCardType"));
  }
  const issuedOk = isPastOrToday(getInputValue("issuedOn"));
  markError($("#issuedOn"), !issuedOk);
  if (!issuedOk) {
    showMsg("warn", "Issued On date cannot be in the future.");
  }
  const duration = getInputValue("validFor");
  const durationOk = duration === "" || validDuration(duration);
  markError($("#validFor"), !durationOk);
  setText("instName", getInputValue("collegeName"));
  setText("instAddress", getInputValue("collegeAddress"));
  setTextContent("cardTitle", computeTitle());
  setText("vName", getInputValue("personName"));
  setText("vDept", getInputValue("roleOrDept"));
  setText("vDob", formatDate(getInputValue("dob")));
  setText("vIssued", formatDate(getInputValue("issuedOn")));
  setText("vValid", getInputValue("validFor"));
  setText("vRoll", getInputValue("rollNo"));
  setText("vEmp", getInputValue("employeeId"));
  setText("vAddr", getInputValue("address"));
  const fontSelect = $("#instFont");
  const fontPicker = $("#customFontPicker");
  const instNameEl = $("#instName");
  const fontSizeValue = getInputValue("instFontSize") || "1.75";
  if (instNameEl) {
    instNameEl.style.fontSize = `${fontSizeValue}rem`;
    if (fontSelect.value === 'custom') {
      fontPicker.classList.remove('hidden');
    } else {
      fontPicker.classList.add('hidden');
      instNameEl.style.fontFamily = fontSelect.value;
    }
  }
  setBgImage("cardLogoBg", logoData);
  setBgImage("wmLogo", logoData);
  setBgImage("personPhoto", photoData);
  const theme = $("#gradientTheme")?.value || "blue";
  const card = $("#cardPreview");
  if (card) {
    card.style.setProperty("--header-gradient", gradientCSS(theme));
    card.setAttribute("data-gradient-theme", theme);
  }
  applyTypeVisibility();
}

$$("input, select, textarea").forEach(el => {
  if (el.type !== "file") {
    el.addEventListener("input", updatePreview);
    el.addEventListener("change", updatePreview);
  }
});

$("#customFontPicker")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) {
    $("#instFont").value = "ui-sans-serif, system-ui, sans-serif";
    const instNameEl = $("#instName");
    if (instNameEl) instNameEl.style.fontFamily = "";
    const styleTag = $("#custom-font-style");
    if (styleTag) styleTag.remove();
    return;
  }
  const allowedTypes = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2'];
  if (!allowedTypes.includes(file.type)) {
    showMsg("err", "Invalid font file. Please use TTF, OTF, WOFF, or WOFF2.");
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const fontDataUrl = reader.result;
    const customFontName = 'CustomUserFont';
    let styleTag = $("#custom-font-style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "custom-font-style";
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = `@font-face { font-family: '${customFontName}'; src: url(${fontDataUrl}); }`;
    const instNameEl = $("#instName");
    if (instNameEl) {
      instNameEl.style.fontFamily = customFontName;
    }
  };
  reader.readAsDataURL(file);
});

$("#printBtn")?.addEventListener("click", () => {
  const cardElement = $("#cardPreview");
  if (!cardElement) return;
  showMsg("ok", "Generating PDF, please wait...");
  html2canvas(cardElement, {
    scale: 4,
    useCORS: false,
    logging: false
  }).then(cardCanvas => {
    const borderSize = cardCanvas.width * 0.03;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = cardCanvas.width + borderSize * 2;
    finalCanvas.height = cardCanvas.height + borderSize * 2;
    const ctx = finalCanvas.getContext('2d', {
      willReadFrequently: true
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.drawImage(cardCanvas, borderSize, borderSize);
    const imgData = finalCanvas.toDataURL('image/png');
    const cardWidth = 85.6;
    const cardHeight = 54;
    const pdfWidth = cardWidth * (finalCanvas.width / cardCanvas.width);
    const pdfHeight = cardHeight * (finalCanvas.height / cardCanvas.height);
    const {
      jsPDF
    } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const sanitizedName = sanitizeFilename(getInputValue("personName"));
    const fileName = `id-card-${sanitizedName}.pdf`;
    pdf.save(fileName);
    clearMsg();
  }).catch(err => {
    console.error("Error generating PDF:", err);
    showMsg("err", "Sorry, could not generate PDF.");
  });
});

$("#downloadPngBtn")?.addEventListener("click", () => {
  const cardElement = $("#cardPreview");
  if (!cardElement) return;
  showMsg("ok", "Generating PNG, please wait...");
  html2canvas(cardElement, {
    scale: 4,
    useCORS: false,
    logging: false
  }).then(cardCanvas => {
    const borderSize = cardCanvas.width * 0.03;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = cardCanvas.width + borderSize * 2;
    finalCanvas.height = cardCanvas.height + borderSize * 2;
    const ctx = finalCanvas.getContext('2d', {
      willReadFrequently: true
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.drawImage(cardCanvas, borderSize, borderSize);
    const sanitizedName = sanitizeFilename(getInputValue("personName"));
    const fileName = `id-card-${sanitizedName}.png`;
    const link = document.createElement('a');
    link.href = finalCanvas.toDataURL('image/png');
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    clearMsg();
  }).catch(err => {
    console.error("Error generating PNG:", err);
    showMsg("err", "Sorry, could not generate PNG.");
  });
});

$("#resetBtn")?.addEventListener("click", (event) => {
  event.preventDefault();
  logoData = "";
  photoData = "";
  const form = $("#cardForm");
  if (form) form.reset();
  $("#customFontPicker").value = "";
  const styleTag = $("#custom-font-style");
  if (styleTag) styleTag.remove();
  setBgImage("cardLogoBg", "");
  setBgImage("wmLogo", "");
  setBgImage("personPhoto", "");
  const instNameEl = $("#instName");
  if (instNameEl) instNameEl.style.fontFamily = "";
  clearMsg();
  applyTypeVisibility();
  updatePreview();
});

applyTypeVisibility();
updatePreview();
