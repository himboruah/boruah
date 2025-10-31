let themeToggle = null;
let settingsToggle = null;
let settingsModal = null;
let closeSettingsModalBtn = null;
let localTimeDisplay = null;
let localTimezoneName = null;
let localTimezoneIndicators = null;
let referenceDatetimeInput = null;
let setReferenceToCurrentBtn = null;
let timezoneSearchInput = null;
let timezoneSuggestions = null;
let addTimezoneBtn = null;
let timezoneCardsContainer = null;
let noTimezonesMessage = null;
let openMeetingPlannerBtn = null;
let meetingPlannerModal = null;
let closeMeetingPlannerBtn = null;
let meetingTimeGrid = null;
let meetingPlannerDateInput = null;
let meetingDurationHoursInput = null;
let meetingDurationMinutesInput = null;
let meetingTimeInterval = null;

let localTimeZone = '';
let allTimezones = [];
let selectedTimezones = [];
let referenceTime = null;
let draggedItem = null;
let timeFormatPreference = localStorage.getItem('timeFormat') || '12';
let activeFilterStatus = null;
let sortableInstance = null;

const el = id => document.getElementById(id);
function setThemeToggle(elm) { themeToggle = elm; }
function setSettingsToggle(elm) { settingsToggle = elm; }
function setSettingsModal(elm) { settingsModal = elm; }
function setCloseSettingsModalBtn(elm) { closeSettingsModalBtn = elm; }
function setLocalTimeDisplay(elm) { localTimeDisplay = elm; }
function setLocalTimezoneName(elm) { localTimezoneName = elm; }
function setLocalTimezoneIndicators(elm) { localTimezoneIndicators = elm; }
function setReferenceDatetimeInput(elm) { referenceDatetimeInput = elm; }
function setSetReferenceToCurrentBtn(elm) { setReferenceToCurrentBtn = elm; }
function setTimezoneSearchInput(elm) { timezoneSearchInput = elm; }
function setTimezoneSuggestions(elm) { timezoneSuggestions = elm; }
function setAddTimezoneBtn(elm) { addTimezoneBtn = elm; }
function setTimezoneCardsContainer(elm) { timezoneCardsContainer = elm; }
function setNoTimezonesMessage(elm) { noTimezonesMessage = elm; }
function setOpenMeetingPlannerBtn(elm) { openMeetingPlannerBtn = elm; }
function setMeetingPlannerModal(elm) { meetingPlannerModal = elm; }
function setCloseMeetingPlannerBtn(elm) { closeMeetingPlannerBtn = elm; }
function setMeetingTimeGrid(elm) { meetingTimeGrid = elm; }
function setMeetingPlannerDateInput(elm) { meetingPlannerDateInput = elm; }
function setMeetingDurationHoursInput(elm) { meetingDurationHoursInput = elm; }
function setMeetingDurationMinutesInput(elm) { meetingDurationMinutesInput = elm; }
function setMeetingTimeInterval(elm) { meetingTimeInterval = elm; }
function setLocalTimeZone(val) { localTimeZone = val; }
function setAllTimezones(val) { allTimezones = val; }
function setSelectedTimezones(val) { selectedTimezones = val; }
function setReferenceTime(val) { referenceTime = val; }
function setDraggedItem(val) { draggedItem = val; }

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const notificationMessage = document.getElementById('notificationMessage');
let notificationTimeout;
function showNotification(message, type = 'success', duration = 1500) {
  if (!notificationMessage) return;
  clearTimeout(notificationTimeout);
  void notificationMessage.offsetWidth;
  notificationMessage.textContent = message;
  notificationMessage.className = `notification-message show ${type}`;
  notificationTimeout = setTimeout(() => {
    notificationMessage.className = 'notification-message';
    notificationMessage.textContent = '';
  }, duration);
}

const THEME_KEY = 'theme';
const DARK = 'dark-mode';
const LIGHT = 'light-mode';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || DARK;
  document.body.classList.toggle(DARK, saved === DARK);
  document.body.classList.toggle(LIGHT, saved !== DARK);
  if (themeToggle) {
    themeToggle.innerHTML = saved === DARK ? '<i class="fas fa-cloud-moon"></i>' : '<i class="fas fa-cloud-sun"></i>';
    themeToggle.setAttribute('aria-pressed', saved === DARK ? 'true' : 'false');
  }
}
function toggleTheme() {
  const isDark = document.body.classList.contains(DARK);
  document.body.classList.toggle(DARK, !isDark);
  document.body.classList.toggle(LIGHT, isDark);
  localStorage.setItem(THEME_KEY, !isDark ? DARK : LIGHT);
  if (themeToggle) {
    themeToggle.innerHTML = !isDark ? '<i class="fas fa-cloud-moon"></i>' : '<i class="fas fa-cloud-sun"></i>';
    themeToggle.setAttribute('aria-pressed', (!isDark).toString());
  }
}

function getCurrentTimeFormat() { return timeFormatPreference === '24' ? 'HH:mm:ss' : 'hh:mm:ss a'; }

function updateLocalTimeDisplay() {
  const now = luxon.DateTime.local();
  const zoneName = now.zoneName;
  const offset = now.toFormat('ZZ');
  localTimeDisplay.textContent = now.toFormat(getCurrentTimeFormat());
  localTimezoneName.textContent = `${now.toFormat('EEEE, LLLL dd, yyyy')} (${zoneName}) (${offset})`;
  if (!localTimeZone || localTimeZone !== zoneName) setLocalTimeZone(zoneName);
}

function getBusinessHoursStatus(dt) {
  const localDecimal = dt.hour + dt.minute / 60;
  const weekday = dt.weekday;
  if (weekday >= 6) return 'weekend';
  const start = window.BUSINESS_HOURS_START ?? 9;
  const end = window.BUSINESS_HOURS_END ?? 17;
  return localDecimal >= start && localDecimal < end ? 'business-hours' : 'non-business-hours';
}

function updateLocalTimeIndicators() {
  if (!localTimezoneIndicators) return;
  const oldIndicator = localTimezoneIndicators.querySelector('.indicator');
  const now = luxon.DateTime.local();
  const status = getBusinessHoursStatus(now);

  if (oldIndicator && oldIndicator.dataset.status === status) {
    if (activeFilterStatus === status) oldIndicator.classList.add('active-filter');
    else oldIndicator.classList.remove('active-filter');
    return;
  }

  localTimezoneIndicators.innerHTML = '';
  const el = document.createElement('span');
  el.className = `indicator ${status}`;
  el.dataset.status = status;
  el.title = `Click to filter by ${status.replace('-', ' ')}`;
  el.innerHTML = {
    'business-hours': '<i class="fas fa-briefcase"></i> Business Hours',
    'non-business-hours': '<i class="fas fa-moon"></i> After Hours',
    'weekend': '<i class="fas fa-couch"></i> Weekend',
  }[status];

  if (status === activeFilterStatus) el.classList.add('active-filter');
  localTimezoneIndicators.appendChild(el);
}

function createTimezoneCard(zone, label, isNew = true) {
  const exist = document.querySelector(`.timezone-card[data-timezone="${zone}"]`);
  if (exist) { updateTimezoneCardContent(exist, zone, label); return; }

  const card = document.createElement('div');
  card.className = 'timezone-card';
  card.dataset.timezone = zone;
  card.dataset.label = label;
  card.setAttribute('role', 'listitem');
  card.innerHTML = `
    <button class="delete-btn" aria-label="Remove ${label} timezone" title="Remove ${label}">
      <i class="fas fa-times-circle"></i>
    </button>
    <div class="card-label-wrapper">
      <h3 class="editable-label">${label}</h3>
      <button class="edit-label-btn" title="Edit label" aria-label="Edit label"><i class="fas fa-pencil-alt"></i></button>
    </div>
    <div class="time-display"></div>
    <div class="date-display"></div>
    <div class="timezone-info"></div>
    <div class="timezone-indicators"></div>
  `;
  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation(); removeTimezoneCard(zone);
  });
  card.querySelector('.edit-label-btn').addEventListener('click', () => {
    const labelEl = card.querySelector('.editable-label');
    const before = labelEl.textContent.trim();
    labelEl.setAttribute('contenteditable','true');
    labelEl.focus();
    const finish = () => {
      labelEl.removeAttribute('contenteditable');
      const after = (labelEl.textContent || '').trim();
      if (after && after !== before) {
        card.dataset.label = after;
        const entry = selectedTimezones.find(t => t.zone === zone);
        if (entry) entry.label = after;
        saveTimezonesToLocalStorage();
        showNotification(`Label updated to "${after}"`, 'success');
      } else {
        labelEl.textContent = before;
      }
      labelEl.removeEventListener('blur', finish);
      labelEl.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); labelEl.blur(); } };
    labelEl.addEventListener('blur', finish);
    labelEl.addEventListener('keydown', onKey);
  });

  timezoneCardsContainer.appendChild(card);
  if (isNew && !selectedTimezones.some(t => t.zone === zone)) {
    selectedTimezones.push({ zone, label }); saveTimezonesToLocalStorage();
  }
  updateTimezoneCardContent(card, zone, label);
  if (noTimezonesMessage) noTimezonesMessage.style.display = 'none';
}

function updateTimezoneCardTime(card, zone) {
    const timeEl = card.querySelector('.time-display');
    if (!timeEl) return;

    const base = (referenceTime?.isValid ? referenceTime : luxon.DateTime.local());
    const dt = base.setZone(zone);
    if (!dt.isValid) {
        timeEl.textContent = 'Invalid';
        return;
    }
    timeEl.textContent = dt.toFormat(getCurrentTimeFormat());
}

function updateTimezoneCardDetails(card, zone) {
    const dEl = card.querySelector('.date-display');
    const iEl = card.querySelector('.timezone-info');
    const ind = card.querySelector('.timezone-indicators');
    if (!dEl || !iEl || !ind) return;

    const base = (referenceTime?.isValid ? referenceTime : luxon.DateTime.local());
    const dt = base.setZone(zone);
    if (!dt.isValid) {
        dEl.textContent = ''; iEl.textContent = ''; ind.innerHTML = ''; return;
    }

    dEl.textContent = dt.toFormat('EEE, LLL dd, yyyy');

    const gmt = `GMT${dt.toFormat('ZZ')}`;
    const diffMin = dt.offset - luxon.DateTime.local().offset;
    const sign = diffMin >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(diffMin)/60);
    const minutes = Math.abs(diffMin) % 60;
    iEl.textContent = `${dt.toFormat('M/d/yyyy')}, ${gmt} (${sign}${hours}h ${minutes}m)`;

    ind.innerHTML = '';
    if (dt.isInDST) {
        const dst = document.createElement('span');
        dst.className = 'indicator dst';
        dst.innerHTML = '<i class="fas fa-sun"></i> DST';
        ind.appendChild(dst);
    }
    const status = getBusinessHoursStatus(dt);
    const bh = document.createElement('span');
    bh.className = `indicator ${status}`;
    bh.innerHTML = {
        'business-hours':'<i class="fas fa-briefcase"></i> Business Hours',
        'non-business-hours':'<i class="fas fa-moon"></i> After Hours',
        'weekend':'<i class="fas fa-couch"></i> Weekend'
    }[status];
    ind.appendChild(bh);
}

function updateTimezoneCardContent(card, zone, label) {
    updateTimezoneCardTime(card, zone);
    updateTimezoneCardDetails(card, zone, label);
}

function removeTimezoneCard(zoneToRemove) {
  clearStatusFilter();
  const card = document.querySelector(`.timezone-card[data-timezone="${zoneToRemove}"]`);
  if (!card) return;
  card.classList.add('fade-out');
  card.addEventListener('animationend', () => {
    card.remove();
    setSelectedTimezones(selectedTimezones.filter(t => t.zone !== zoneToRemove));
    saveTimezonesToLocalStorage();
    if (selectedTimezones.length === 0 && noTimezonesMessage) noTimezonesMessage.style.display = 'block';
    showNotification('Timezone removed.', 'success');
  }, { once: true });
}

const updateAllCardTimes = () => {
    selectedTimezones.forEach(tz => {
        const card = document.querySelector(`.timezone-card[data-timezone="${tz.zone}"]`);
        if (card) updateTimezoneCardTime(card, tz.zone);
    });
};

const updateAllCardDetails = debounce(() => {
    selectedTimezones.forEach(tz => {
        const card = document.querySelector(`.timezone-card[data-timezone="${tz.zone}"]`);
        if (card) updateTimezoneCardDetails(card, tz.zone);
    });
    updateLocalTimeIndicators();
}, 100);

function loadTimezonesFromLocalStorage() {
  const saved = JSON.parse(localStorage.getItem('selectedTimezones') || '[]');
  setSelectedTimezones(saved);
  const ref = localStorage.getItem('referenceTime');
  setReferenceTime(ref ? luxon.DateTime.fromISO(ref) : null);
  const fmt = localStorage.getItem('timeFormat');
  if (fmt === '12' || fmt === '24') timeFormatPreference = fmt;
}
function saveTimezonesToLocalStorage() {
  localStorage.setItem('selectedTimezones', JSON.stringify(selectedTimezones));
}
function saveReferenceTimeToLocalStorage() {
  if (referenceTime?.isValid) localStorage.setItem('referenceTime', referenceTime.toISO());
  else localStorage.removeItem('referenceTime');
}

let selectedSuggestionIndex = -1;
function resetSearch() {
  timezoneSearchInput.value = '';
  timezoneSuggestions.style.display = 'none';
  selectedSuggestionIndex = -1;
}
const setupTimezoneSearch = debounce((input, container, addBtn) => {
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { container.style.display='none'; return; }
    const results = allTimezones.filter(t => t.label.toLowerCase().includes(q)).slice(0, 10);
    container.innerHTML = '';
    if (!results.length) { container.style.display='none'; return; }
    results.forEach((tz, idx) => {
      const item = document.createElement('div');
      item.className = 'timezone-suggestion-item';
      item.dataset.timezone = tz.zone;
      item.dataset.label = tz.label;
      item.textContent = tz.label;
      item.addEventListener('click', () => { input.value = tz.label; container.style.display='none'; });
      container.appendChild(item);
    });
    container.style.display='block';
  });
}, 200);

function addTimezone(zoneId=null, label=null) {
  clearStatusFilter();
  let tz = null;
  if (zoneId && label) tz = { zone: zoneId, label };
  else {
    const input = timezoneSearchInput.value.trim();
    if (!input) return;
    tz = allTimezones.find(z => z.label.toLowerCase() === input.toLowerCase());
    if (!tz) { showNotification('Please select a valid timezone.', 'error'); return; }
  }
  if (selectedTimezones.some(t => t.zone === tz.zone)) { showNotification(`${tz.label} is already added.`, 'error'); resetSearch(); return; }
  setSelectedTimezones([...selectedTimezones, tz]); saveTimezonesToLocalStorage();
  createTimezoneCard(tz.zone, tz.label);
  resetSearch(); showNotification(`${tz.label} added.`, 'success');
}

function initializeDragAndDrop(container) {
  if (sortableInstance) {
    sortableInstance.destroy();
  }
  sortableInstance = new Sortable(container, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: function () {
      persistOrder();
      showNotification('Timezones reordered.', 'info');
    },
  });

  function persistOrder() {
    const cards = Array.from(container.children).filter(
      el => el.classList?.contains('timezone-card')
    );
    setSelectedTimezones(cards.map(c => ({ zone: c.dataset.timezone, label: c.dataset.label })));
    saveTimezonesToLocalStorage();
  }
}

function handleStatusFilterClick(status) {
  if (status === activeFilterStatus) {
    clearStatusFilter();
  } else {
    applyStatusFilter(status);
  }
}

function applyStatusFilter(status) {
  if (sortableInstance) sortableInstance.option('disabled', true);
  activeFilterStatus = status;
  const container = timezoneCardsContainer;
  const parentSection = container.closest('.selected-timezones');
  if (!parentSection) return;

  parentSection.classList.add('is-filtered');

  const allCards = Array.from(container.children).filter(el => el.classList.contains('timezone-card'));
  const matches = [];
  const nonMatches = [];

  allCards.forEach(card => {
    const cardStatusIndicator = card.querySelector('.indicator.business-hours, .indicator.non-business-hours, .indicator.weekend');
    if (cardStatusIndicator && cardStatusIndicator.classList.contains(status)) {
      matches.push(card);
      card.classList.remove('filtered-out');
    } else {
      nonMatches.push(card);
      card.classList.add('filtered-out');
    }
  });

  const fragment = document.createDocumentFragment();
  [...matches, ...nonMatches].forEach(card => fragment.appendChild(card));
  container.innerHTML = '';
  container.appendChild(fragment);

  updateLocalTimeIndicators();
  showNotification(`Filtering by: ${status.replace('-', ' ')}`, 'info');
}

function clearStatusFilter() {
  if (sortableInstance) sortableInstance.option('disabled', false);
  if (!activeFilterStatus) return;
  activeFilterStatus = null;
  const container = timezoneCardsContainer;
  const parentSection = container.closest('.selected-timezones');
  if (!parentSection) return;

  parentSection.classList.remove('is-filtered');
  container.querySelectorAll('.timezone-card.filtered-out').forEach(card => card.classList.remove('filtered-out'));

  const fragment = document.createDocumentFragment();
  selectedTimezones.forEach(tz => {
    const card = container.querySelector(`.timezone-card[data-timezone="${tz.zone}"]`);
    if (card) fragment.appendChild(card);
  });
  container.innerHTML = '';
  container.appendChild(fragment);

  updateLocalTimeIndicators();
  showNotification('Filter cleared.', 'info');
}

let currentMeetingDate = luxon.DateTime.local().toISODate();
let TIME_INTERVAL_HOURS = 0.5;
let meetingBlockStartHour = 9;
let meetingBlockDurationHours = 1;

function openMeetingPlanner() {
  if (selectedTimezones.length === 0) { showNotification('Add at least one timezone to use the Meeting Planner.', 'info'); return; }
  meetingPlannerModal.style.display = 'flex';
  renderMeetingTimeGrid(); updateMeetingBlockDisplay();
}
function refreshMeetingPlannerGrid(){ renderMeetingTimeGrid(); updateMeetingBlockDisplay(); }

function renderMeetingTimeGrid() {
  if (!meetingTimeGrid) return;
  meetingTimeGrid.innerHTML = '';
  const intervals = Math.round(24 / TIME_INTERVAL_HOURS);
  meetingTimeGrid.style.gridTemplateColumns = `min-content repeat(${intervals}, 1fr)`;

  const dateLuxon = luxon.DateTime.fromISO(currentMeetingDate);
  const timeFmt = timeFormatPreference === '24' ? 'HH:mm' : 'h:mm a';
  const startHour = window.BUSINESS_HOURS_START ?? 9;
  const endHour = window.BUSINESS_HOURS_END ?? 17;
  const isHeaderWeekday = dateLuxon.weekday >= 1 && dateLuxon.weekday <= 5;

  const header = document.createElement('div');
  header.className = 'grid-row grid-header';
  const localLabel = luxon.DateTime.local().zoneName.split('/').pop().replace(/_/g,' ');
  header.innerHTML = `<div class="grid-cell timezone-label">${localLabel}</div>`;
  for (let h = 0; h < 24; h += TIME_INTERVAL_HOURS) {
    const labelDt = dateLuxon.set({ hour: Math.floor(h), minute: (h % 1) * 60 });
    const isBH = isHeaderWeekday && h >= startHour && h < endHour;
    header.innerHTML += `<div class="grid-cell hour-label ${isBH?'business-hour':'non-business-hour'}" data-hour="${Number(h.toFixed(2))}">${labelDt.toFormat(timeFmt)}</div>`;
  }
  meetingTimeGrid.appendChild(header);

  selectedTimezones.forEach(tz => {
    const row = document.createElement('div'); row.className='grid-row'; row.dataset.timezone = tz.zone;
    const lab = document.createElement('div'); lab.className='grid-cell timezone-label'; lab.textContent = tz.label; row.appendChild(lab);
    for (let h = 0; h < 24; h += TIME_INTERVAL_HOURS) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell time-slot';
      cell.dataset.hour = Number(h.toFixed(2));
      const dt = dateLuxon.set({ hour: Math.floor(h), minute: (h % 1) * 60 }).setZone(tz.zone);
      cell.textContent = dt.toFormat(timeFmt);
      const dec = dt.hour + dt.minute/60;
      const isWeekday = dt.weekday >= 1 && dt.weekday <= 5;
      cell.classList.add(isWeekday && dec >= startHour && dec < endHour ? 'business-hour' : 'non-business-hour');
      row.appendChild(cell);
    }
    meetingTimeGrid.appendChild(row);
  });
  addDraggableMeetingBlock();
}

function getEffectiveCellStepWidth() {
  const first = meetingTimeGrid.querySelector('.grid-row:not(.grid-header) .grid-cell.time-slot[data-hour="0"]');
  const second = meetingTimeGrid.querySelector(`.grid-row:not(.grid-header) .grid-cell.time-slot[data-hour="${TIME_INTERVAL_HOURS}"]`);
  if (first && second) return second.offsetLeft - first.offsetLeft;
  const header = meetingTimeGrid.querySelector('.grid-header');
  const slots = header?.querySelectorAll('.grid-cell.hour-label:not(:first-child)') || [];
  if (!slots.length) return 0;
  const left = slots[0].offsetLeft;
  const right = slots[slots.length-1].offsetLeft + slots[slots.length-1].offsetWidth;
  return slots.length <= 1 ? slots[0].offsetWidth : (right - left) / slots.length;
}

function addDraggableMeetingBlock() {
  let block = meetingTimeGrid.querySelector('.meeting-block');
  if (!block) {
    block = document.createElement('div');
    block.className = 'meeting-block';
    meetingTimeGrid.appendChild(block);
    block.addEventListener('mousedown', onBlockDown);
  }
  updateMeetingBlockDisplay();
}
let isDragging = false, startX = 0, initialBlockStartHour = 0, autoScrollInterval = null;
function startAutoScroll(dir){ stopAutoScroll(); autoScrollInterval=setInterval(()=>meetingTimeGrid.scrollLeft += dir==='left'?-10:10, 50); }
function stopAutoScroll(){ clearInterval(autoScrollInterval); autoScrollInterval=null; }
function onBlockDown(e){ isDragging=true; startX=e.clientX; initialBlockStartHour=meetingBlockStartHour;
  const b = meetingTimeGrid.querySelector('.meeting-block'); if (b) b.classList.add('dragging');
  document.addEventListener('mousemove', onBlockMove); document.addEventListener('mouseup', onBlockUp); }
function onBlockMove(e){
  e.preventDefault(); const step = getEffectiveCellStepWidth(); if (!isDragging || !step) return;
  const delta = (e.clientX - startX) / step;
  let newStart = initialBlockStartHour + delta * TIME_INTERVAL_HOURS;
  meetingBlockStartHour = Math.round(Math.max(0, Math.min(24 - meetingBlockDurationHours, newStart)) / TIME_INTERVAL_HOURS) * TIME_INTERVAL_HOURS;
  updateMeetingBlockDisplay();
  const rect = meetingTimeGrid.getBoundingClientRect(); const t = 40;
  if (e.clientX < rect.left + t) startAutoScroll('left'); else if (e.clientX > rect.right - t) startAutoScroll('right'); else stopAutoScroll();
}
function onBlockUp(){ isDragging=false; const b=meetingTimeGrid.querySelector('.meeting-block'); if (b) b.classList.remove('dragging');
  document.removeEventListener('mousemove', onBlockMove); document.removeEventListener('mouseup', onBlockUp); stopAutoScroll(); }
function getMeetingBlockLeftPosition(hour){
  const target = meetingTimeGrid.querySelector(`.grid-row:not(.grid-header) .grid-cell.time-slot[data-hour="${Number(hour.toFixed(2))}"]`);
  if (target) return target.offsetLeft;
  const fallback = meetingTimeGrid.querySelector('.grid-row:not(.grid-header) .grid-cell.time-slot[data-hour="0"]');
  if (!fallback) return 0;
  const step = getEffectiveCellStepWidth();
  return fallback.offsetLeft + (hour / TIME_INTERVAL_HOURS) * step;
}
function getGridGapWidth(){ return parseFloat(getComputedStyle(meetingTimeGrid).columnGap || getComputedStyle(meetingTimeGrid).gap || '0'); }
function updateMeetingBlockDisplay(){
  const block = meetingTimeGrid.querySelector('.meeting-block'); if (!block) return;
  const step = getEffectiveCellStepWidth(); const gap = getGridGapWidth(); if (!step) return;
  const firstData = meetingTimeGrid.querySelector('.grid-row:not(.grid-header) .grid-cell.time-slot[data-hour="0"]');
  const rowLabel = meetingTimeGrid.querySelector('.grid-row:not(.grid-header) .timezone-label');
  const offsetY = firstData?.offsetTop || 0; const rowH = rowLabel?.offsetHeight || 0;
  const rows = Math.max(1, selectedTimezones.length);
  const totalH = offsetY + rowH * rows + gap * Math.max(0, rows - 1);
  const L = getMeetingBlockLeftPosition(meetingBlockStartHour);
  const R = getMeetingBlockLeftPosition(meetingBlockStartHour + meetingBlockDurationHours);
  block.style.top = `0px`; block.style.height = `${totalH}px`;
  block.style.left = `${L}px`; block.style.width = `${Math.round(R - L)}px`;
  block.style.transform = 'none';
  block.style.backgroundColor = 'rgba(66, 135, 245, 0.2)';
  block.style.border = '2px solid rgba(66, 135, 245, 0.8)';
  block.textContent = '';
}

function loadTimezoneSyncSettings() {
  const enabled = localStorage.getItem('tzWatchOn') === '1';
  const interval = parseInt(localStorage.getItem('tzWatchInterval') || '60000', 10);
  return { enabled, interval: isNaN(interval) ? 60000 : interval };
}
function saveTimezoneSyncSettings(on, interval) {
  localStorage.setItem('tzWatchOn', on ? '1' : '0');
  localStorage.setItem('tzWatchInterval', String(interval || 60000));
}
function applySavedTimezoneSyncSettings() {
  const toggleEl = el('autoSyncTimezoneToggle');
  const intervalEl = el('timezoneSyncInterval');
  if (!toggleEl || !intervalEl) return;
  const { enabled, interval } = loadTimezoneSyncSettings();
  toggleEl.checked = enabled; intervalEl.value = String(interval);
  toggleEl.addEventListener('change', () => {
    saveTimezoneSyncSettings(toggleEl.checked, parseInt(intervalEl.value || '60000', 10));
    toggleEl.checked ? startTimezoneWatcher() : stopTimezoneWatcher();
  });
  intervalEl.addEventListener('change', () => {
    saveTimezoneSyncSettings(toggleEl.checked, parseInt(intervalEl.value || '60000', 10));
    if (toggleEl.checked) startTimezoneWatcher();
  });
}
let timezoneWatcherId = null;
function stopTimezoneWatcher(){ if (timezoneWatcherId) { clearInterval(timezoneWatcherId); timezoneWatcherId = null; } }
function startTimezoneWatcher() {
  stopTimezoneWatcher();
  const { enabled, interval } = loadTimezoneSyncSettings();
  if (!enabled) return;
  let lastZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  timezoneWatcherId = setInterval(() => {
    const currentZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (currentZone !== lastZone) {
      lastZone = currentZone;
      setLocalTimeZone(currentZone);
      updateLocalTimeDisplay();
      updateAllCardDetails();
      showNotification(`Local timezone changed to ${currentZone}`, 'info');
    }
  }, interval);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') startTimezoneWatcher();
  else stopTimezoneWatcher();
});

function convertDecimalToTimeString(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}
function saveBusinessHoursToLocalStorage(start, end) {
  localStorage.setItem('businessHoursStart', start.toString());
  localStorage.setItem('businessHoursEnd', end.toString());
}
function loadBusinessHoursFromLocalStorage() {
  const start = parseFloat(localStorage.getItem('businessHoursStart'));
  const end = parseFloat(localStorage.getItem('businessHoursEnd'));
  return { start: isNaN(start) ? 9 : start, end: isNaN(end) ? 17 : end };
}
function bindBusinessHourInputs() {
  const startInput = el('businessStartHour');
  const endInput = el('businessEndHour');
  const apply = () => {
    const [sh, sm] = (startInput.value || '09:00').split(':').map(Number);
    const [eh, em] = (endInput.value || '17:00').split(':').map(Number);
    window.BUSINESS_HOURS_START = sh + sm/60; window.BUSINESS_HOURS_END = eh + em/60;
    saveBusinessHoursToLocalStorage(window.BUSINESS_HOURS_START, window.BUSINESS_HOURS_END);
    refreshMeetingPlannerGrid(); updateLocalTimeIndicators();
  };
  startInput.addEventListener('change', apply);
  endInput.addEventListener('change', apply);
  const resetBtn = el('resetBusinessHoursBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    startInput.value = '09:00'; endInput.value = '17:00';
    window.BUSINESS_HOURS_START = 9; window.BUSINESS_HOURS_END = 17;
    saveBusinessHoursToLocalStorage(9,17); refreshMeetingPlannerGrid(); updateLocalTimeIndicators();
  });
}

const CANON_MAP = new Map([
  ['Europe/Kiev', 'Europe/Kyiv'],
  ['Asia/Rangoon', 'Asia/Yangon'],
]);
function canonicalizeZoneId(id){ return CANON_MAP.get(id) || id; }

function updateReferenceTimeControls() {
    if (!referenceDatetimeInput || !setReferenceToCurrentBtn) return;

    if (referenceTime && referenceTime.isValid) {
        setReferenceToCurrentBtn.textContent = 'Clear Reference Time';
        setReferenceToCurrentBtn.classList.add('button-reset-mode');
        referenceDatetimeInput.value = referenceTime.toFormat("yyyy-MM-dd'T'HH:mm");
    } else {
        setReferenceToCurrentBtn.textContent = 'Set as Reference';
        setReferenceToCurrentBtn.classList.remove('button-reset-mode');
        referenceDatetimeInput.value = '';
    }
}

/***** INIT *****/
document.addEventListener('DOMContentLoaded', () => {
  setThemeToggle(el('themeToggle'));
  setSettingsToggle(el('settingsToggle'));
  setSettingsModal(el('settingsModal'));
  setCloseSettingsModalBtn(el('closeSettingsModalBtn'));
  setLocalTimeDisplay(el('localTimeDisplay'));
  setLocalTimezoneName(el('localTimezoneName'));
  setLocalTimezoneIndicators(el('localTimezoneIndicators'));
  setReferenceDatetimeInput(el('referenceDatetimeInput'));
  setSetReferenceToCurrentBtn(el('setReferenceToCurrentBtn'));
  setTimezoneSearchInput(el('timezoneSearchInput'));
  setTimezoneSuggestions(el('timezoneSuggestions'));
  setAddTimezoneBtn(el('addTimezoneBtn'));
  setTimezoneCardsContainer(el('timezoneCardsContainer'));
  setNoTimezonesMessage(el('noTimezonesMessage'));
  setOpenMeetingPlannerBtn(el('openMeetingPlannerBtn'));
  setMeetingPlannerModal(el('meetingPlannerModal'));
  setCloseMeetingPlannerBtn(el('closeMeetingPlannerBtn'));
  setMeetingTimeGrid(el('meetingTimeGrid'));
  setMeetingPlannerDateInput(el('meetingPlannerDate'));
  setMeetingDurationHoursInput(el('meetingDurationHoursInput'));
  setMeetingDurationMinutesInput(el('meetingDurationMinutesInput'));
  setMeetingTimeInterval(el('meetingTimeInterval'));

  initTheme();

  if (localTimezoneIndicators) {
    localTimezoneIndicators.addEventListener('click', (e) => {
      const indicator = e.target.closest('.indicator[data-status]');
      if (indicator) handleStatusFilterClick(indicator.dataset.status);
    });
  }

  if (typeof populateAllTimezonesData === 'function') {
    populateAllTimezonesData();
  }
  if (Array.isArray(allTimezones) && allTimezones.length) {
    setAllTimezones(allTimezones.map(t => ({
      zone: canonicalizeZoneId(t.zone),
      label: t.label.replace('Kiev', 'Kyiv').replace('Rangoon', 'Yangon')
    })));
  }

  const { start, end } = loadBusinessHoursFromLocalStorage();
  window.BUSINESS_HOURS_START = start; window.BUSINESS_HOURS_END = end;
  const startInput = el('businessStartHour'); const endInput = el('businessEndHour');
  if (startInput && endInput) { startInput.value = convertDecimalToTimeString(start); endInput.value = convertDecimalToTimeString(end); }

  loadTimezonesFromLocalStorage();
  updateReferenceTimeControls();

  updateLocalTimeDisplay();
  updateLocalTimeIndicators();
  updateAllCardTimes();
  updateAllCardDetails();

  if (selectedTimezones.length) selectedTimezones.forEach(t => createTimezoneCard(canonicalizeZoneId(t.zone), t.label, false));
  if (noTimezonesMessage) noTimezonesMessage.style.display = selectedTimezones.length ? 'none' : 'block';

  initializeDragAndDrop(timezoneCardsContainer);

  setupTimezoneSearch(timezoneSearchInput, timezoneSuggestions, addTimezoneBtn);

  if (addTimezoneBtn) addTimezoneBtn.addEventListener('click', () => addTimezone());

  document.querySelectorAll('input[name="timeFormat"]').forEach(input => {
    input.checked = input.value === timeFormatPreference;
    input.addEventListener('change', (e) => {
      const val = e.target.value === '24' ? '24' : '12';
      timeFormatPreference = val; localStorage.setItem('timeFormat', val);
      updateLocalTimeDisplay(); updateAllCardTimes(); refreshMeetingPlannerGrid();
    });
  });

  if (openMeetingPlannerBtn) openMeetingPlannerBtn.addEventListener('click', openMeetingPlanner);
  if (closeMeetingPlannerBtn) closeMeetingPlannerBtn.addEventListener('click', () => meetingPlannerModal.style.display = 'none');

  if (meetingPlannerDateInput) meetingPlannerDateInput.value = luxon.DateTime.local().toISODate();
  if (meetingPlannerDateInput) meetingPlannerDateInput.addEventListener('change', e => { currentMeetingDate = e.target.value; refreshMeetingPlannerGrid(); });
  
  if (meetingTimeInterval) {
    TIME_INTERVAL_HOURS = parseFloat(meetingTimeInterval.value);
    meetingTimeInterval.addEventListener('change', e => {
      TIME_INTERVAL_HOURS = parseFloat(e.target.value);
      if (meetingBlockDurationHours < TIME_INTERVAL_HOURS) meetingBlockDurationHours = TIME_INTERVAL_HOURS;
      refreshMeetingPlannerGrid();
    });
  }

  if (meetingDurationHoursInput && meetingDurationMinutesInput) {
    const upd = () => {
      const h = parseFloat(meetingDurationHoursInput.value) || 0;
      const m = (parseFloat(meetingDurationMinutesInput.value) || 0) / 60;
      let tot = h + m; if (isNaN(tot) || tot <= 0) tot = TIME_INTERVAL_HOURS;
      meetingBlockDurationHours = Math.max(TIME_INTERVAL_HOURS, Math.round(tot / TIME_INTERVAL_HOURS) * TIME_INTERVAL_HOURS);
      updateMeetingBlockDisplay();
    };
    upd();
    meetingDurationHoursInput.addEventListener('input', upd);
    meetingDurationMinutesInput.addEventListener('input', upd);
  }

  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (settingsToggle) settingsToggle.addEventListener('click', () => settingsModal && (settingsModal.style.display='flex'));
  if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', () => settingsModal && (settingsModal.style.display='none'));

  bindBusinessHourInputs();
  applySavedTimezoneSyncSettings();
  startTimezoneWatcher();

  setInterval(() => {
    updateLocalTimeDisplay();
    if (!referenceTime?.isValid) {
        updateAllCardTimes();
    }
  }, 1000);

  setInterval(updateAllCardDetails, 60000);

  if (setReferenceToCurrentBtn) {
    setReferenceToCurrentBtn.addEventListener('click', () => {
        if (referenceTime && referenceTime.isValid) {
            setReferenceTime(null);
            showNotification('Reference time cleared.', 'info');
        } else {
            const dtValue = referenceDatetimeInput.value;
            if (!dtValue) {
                showNotification('Please select a date and time first.', 'error');
                return;
            }
            const dt = luxon.DateTime.fromISO(dtValue);
            if (!dt.isValid) {
                showNotification('The selected date and time is invalid.', 'error');
                return;
            }
            setReferenceTime(dt);
            showNotification('Reference time set.', 'success');
        }

        saveReferenceTimeToLocalStorage();
        updateAllCardTimes();
        updateAllCardDetails();
        updateReferenceTimeControls();
    });
  }
});