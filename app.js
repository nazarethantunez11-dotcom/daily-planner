(() => {
  'use strict';

  const STORAGE_KEY = 'planner.v3';
  const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOUR_PX = 48;
  const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

  const DEFAULT_DAY_BLOCKS = [
    { start: '05:00', end: '05:15', label: 'Wake (early rise buffer)' },
    { start: '05:15', end: '06:00', label: 'Meditation & journaling' },
    { start: '06:00', end: '07:00', label: 'French vocab + reading' },
    { start: '07:00', end: '07:30', label: 'Workout' },
    { start: '07:30', end: '08:15', label: 'Shower & breakfast' },
    { start: '08:15', end: '12:00', label: 'Deep work block' },
    { start: '12:00', end: '13:00', label: 'Lunch' },
    { start: '13:00', end: '17:00', label: 'Classes / studying' },
    { start: '17:00', end: '18:00', label: 'Entrepreneurship work' },
    { start: '18:00', end: '19:00', label: 'Dinner' },
    { start: '19:00', end: '20:00', label: 'Reading course materials' },
    { start: '20:00', end: '21:00', label: 'Non-course reading / finance' },
    { start: '21:00', end: '21:30', label: 'Plan tomorrow' },
    { start: '21:30', end: '22:00', label: 'Wind down' },
    { start: '22:00', end: '23:59', label: 'Sleep' },
  ];

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function daily(name) { return { id: uid(), name, frequency: { type: 'daily' } }; }
  function weekly(name, n) { return { id: uid(), name, frequency: { type: 'weekly', timesPerWeek: n } }; }

  function buildDefaultHabits() {
    return [
      daily('Meditation'),
      daily('French vocab practice'),
      daily('Drinking water'),
      daily('Entrepreneurship work'),
      daily('Studying'),
      daily('Reading course materials'),
      daily('Completing assignments'),
      daily('Reading a non-course book'),
      daily('Vocabulary review'),
      weekly('Workout', 4),
      daily('Sleeping 7–8 hours'),
      weekly('Hair removal session', 1),
      daily('Reading about finance'),
      weekly('Laundry', 1),
      weekly('Cleaning room', 1),
      weekly('Calling family', 1),
      weekly('Socializing', 2),
      weekly('Networking', 1),
      weekly('Attending an event', 1),
      daily('Learning a business skill'),
      weekly('Reviewing investments', 1),
    ];
  }

  // ---------- date helpers ----------
  function toDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fromDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function todayKey() { return toDateKey(new Date()); }
  function addDays(dateKey, delta) {
    const dt = fromDateKey(dateKey);
    dt.setDate(dt.getDate() + delta);
    return toDateKey(dt);
  }
  function addWeeks(dateKey, delta) { return addDays(dateKey, delta * 7); }
  function addMonths(dateKey, delta) {
    const dt = fromDateKey(dateKey);
    const day = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + delta);
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(day, lastDay));
    return toDateKey(dt);
  }
  function addYears(dateKey, delta) {
    const dt = fromDateKey(dateKey);
    dt.setFullYear(dt.getFullYear() + delta);
    return toDateKey(dt);
  }
  function startOfWeek(dateKey) {
    const dt = fromDateKey(dateKey);
    dt.setDate(dt.getDate() - dt.getDay());
    return toDateKey(dt);
  }
  function daysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate();
  }

  function formatDayLabel(key) {
    const tKey = todayKey();
    if (key === tKey) return 'Today';
    if (key === addDays(tKey, -1)) return 'Yesterday';
    if (key === addDays(tKey, 1)) return 'Tomorrow';
    const d = fromDateKey(key);
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    if (d.getFullYear() !== fromDateKey(tKey).getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(undefined, opts);
  }
  function formatWeekLabel(key) {
    const start = startOfWeek(key);
    const end = addDays(start, 6);
    const sd = fromDateKey(start), ed = fromDateKey(end);
    const sameYear = sd.getFullYear() === ed.getFullYear();
    const startStr = sd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = ed.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}, ${ed.getFullYear()}`;
  }
  function formatMonthLabel(key) {
    return fromDateKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  function formatYearLabel(key) {
    return String(fromDateKey(key).getFullYear());
  }
  function formatTimeShort(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
  function formatDueDate(key) {
    return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function minutesFromHHMM(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  function hhmmFromMinutes(mins) {
    mins = clamp(Math.round(mins), 0, 24 * 60 - 1);
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function addMinutesToHHMM(hhmm, delta) {
    return hhmmFromMinutes(minutesFromHHMM(hhmm) + delta);
  }
  function round15(mins) { return Math.round(mins / 15) * 15; }

  // ---------- storage ----------
  function migrateFromV2(parsedV2) {
    const events = [];
    if (parsedV2.scheduleBlocks && typeof parsedV2.scheduleBlocks === 'object') {
      Object.keys(parsedV2.scheduleBlocks).forEach(dateKey => {
        (parsedV2.scheduleBlocks[dateKey] || []).forEach(block => {
          let end = block.end;
          if (!end || end <= block.start) end = '23:59';
          events.push({
            id: block.id || uid(),
            title: block.label || 'Untitled',
            allDay: false,
            date: dateKey,
            start: block.start,
            end,
            location: '',
            description: '',
            repeat: { type: 'none', days: [], until: null },
            exceptions: [],
          });
        });
      });
    }
    return events;
  }

  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }

    let events = null;
    if (parsed && Array.isArray(parsed.events)) {
      events = parsed.events;
    } else {
      // try migrating from the previous (v2) schema stored under a different key
      let legacyRaw = null;
      try { legacyRaw = localStorage.getItem('planner.v2'); } catch (e) { /* ignore */ }
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          events = migrateFromV2(legacy);
          if (!parsed) {
            parsed = { habits: legacy.habits, habitLogs: legacy.habitLogs, assignments: legacy.assignments };
          }
        } catch (e) { events = null; }
      }
    }
    const isFirstRun = !parsed && !events;
    if (!events) {
      events = isFirstRun
        ? DEFAULT_DAY_BLOCKS.map(b => ({
            id: uid(), title: b.label, allDay: false, date: todayKey(), start: b.start, end: b.end,
            location: '', description: '', repeat: { type: 'none', days: [], until: null }, exceptions: [],
          }))
        : [];
    }
    // normalize
    events = events.map(ev => ({
      id: ev.id || uid(),
      title: ev.title || 'Untitled',
      allDay: !!ev.allDay,
      date: ev.date,
      start: ev.allDay ? null : (ev.start || '09:00'),
      end: ev.allDay ? null : (ev.end || '10:00'),
      location: ev.location || '',
      description: ev.description || '',
      repeat: ev.repeat && ev.repeat.type ? { type: ev.repeat.type, days: ev.repeat.days || [], until: ev.repeat.until || null } : { type: 'none', days: [], until: null },
      exceptions: Array.isArray(ev.exceptions) ? ev.exceptions : [],
    }));

    const habits = (parsed && Array.isArray(parsed.habits)) ? parsed.habits : buildDefaultHabits();
    habits.forEach(h => {
      if (!h.frequency) h.frequency = { type: 'daily' };
      if (h.frequency.type === 'days' && !Array.isArray(h.frequency.days)) h.frequency.days = [new Date().getDay()];
    });

    const assignments = (parsed && Array.isArray(parsed.assignments)) ? parsed.assignments : [];
    assignments.forEach(a => {
      if (a.link === undefined) a.link = '';
      if (a.attachment === undefined) a.attachment = null;
    });

    return {
      events,
      habits,
      habitLogs: (parsed && parsed.habitLogs) ? parsed.habitLogs : {},
      assignments,
      scheduleView: (parsed && parsed.scheduleView) ? parsed.scheduleView : 'day',
      assignmentsView: (parsed && parsed.assignmentsView) ? parsed.assignmentsView : 'list',
    };
  }

  let state = loadState();
  let selectedDate = todayKey();
  let scheduleView = state.scheduleView;
  let editingHabitId = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/unavailable */ }
  }

  // ---------- habit logs ----------
  function isDone(habitId, dateKey) {
    return !!(state.habitLogs[dateKey] && state.habitLogs[dateKey][habitId]);
  }
  function setDone(habitId, dateKey, val) {
    if (!state.habitLogs[dateKey]) state.habitLogs[dateKey] = {};
    if (val) state.habitLogs[dateKey][habitId] = true;
    else delete state.habitLogs[dateKey][habitId];
    save();
  }
  function weeklyProgress(habit, dateKey) {
    const start = startOfWeek(dateKey);
    if (habit.frequency.type === 'days') {
      const days = habit.frequency.days;
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        if (days.includes(fromDateKey(d).getDay()) && isDone(habit.id, d)) count++;
      }
      return { progress: count, target: days.length };
    }
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (isDone(habit.id, addDays(start, i))) count++;
    }
    return { progress: count, target: habit.frequency.timesPerWeek };
  }
  function last90Keys() {
    const keys = [];
    let cursor = todayKey();
    for (let i = 0; i < 90; i++) {
      keys.push(cursor);
      cursor = addDays(cursor, -1);
    }
    return keys.reverse();
  }

  // ---------- event occurrence engine ----------
  function eventMatchesDate(ev, dateKey) {
    if (ev.exceptions.includes(dateKey)) return false;
    if (dateKey < ev.date) return false;
    const r = ev.repeat;
    if (r.until && dateKey > r.until) return false;
    if (r.type === 'none') return dateKey === ev.date;
    const anchor = fromDateKey(ev.date);
    const d = fromDateKey(dateKey);
    if (r.type === 'daily') return true;
    if (r.type === 'weekdays') { const wd = d.getDay(); return wd >= 1 && wd <= 5; }
    if (r.type === 'weekly') {
      const days = (r.days && r.days.length) ? r.days : [anchor.getDay()];
      return days.includes(d.getDay());
    }
    if (r.type === 'monthly') return d.getDate() === anchor.getDate();
    if (r.type === 'yearly') return d.getDate() === anchor.getDate() && d.getMonth() === anchor.getMonth();
    return false;
  }

  function getEventsForDate(dateKey) {
    return state.events
      .filter(ev => eventMatchesDate(ev, dateKey))
      .map(ev => ({ ...ev, occurrenceDate: dateKey }))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return (a.start || '').localeCompare(b.start || '');
      });
  }

  function findEvent(id) { return state.events.find(e => e.id === id); }

  function moveOccurrence(eventId, fromDate, toDate, newStart, newEnd) {
    const ev = findEvent(eventId);
    if (!ev) return;
    if (ev.repeat.type === 'none' && ev.date === fromDate) {
      ev.date = toDate;
      ev.start = newStart;
      ev.end = newEnd;
    } else {
      ev.exceptions.push(fromDate);
      state.events.push({
        id: uid(), title: ev.title, allDay: ev.allDay, date: toDate, start: newStart, end: newEnd,
        location: ev.location, description: ev.description,
        repeat: { type: 'none', days: [], until: null }, exceptions: [],
      });
    }
    save();
  }

  function deleteOccurrence(eventId, occurrenceDate, scope) {
    const ev = findEvent(eventId);
    if (!ev) return;
    if (scope === 'all' || ev.repeat.type === 'none') {
      state.events = state.events.filter(e => e.id !== eventId);
    } else {
      ev.exceptions.push(occurrenceDate);
    }
    save();
  }

  // ---------- shared date mutation ----------
  function setSelectedDate(key) {
    selectedDate = key;
    renderSchedule();
    renderHabits();
  }

  // ---------- tabs ----------
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = {
    schedule: document.getElementById('panel-schedule'),
    habits: document.getElementById('panel-habits'),
    assignments: document.getElementById('panel-assignments'),
  };
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach(p => p.classList.remove('active'));
      panels[btn.dataset.tab].classList.add('active');
    });
  });

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // ================= EVENT MODAL =================
  const evOverlay = document.getElementById('event-modal-overlay');
  const evForm = document.getElementById('event-form');
  const evTitleInput = document.getElementById('ev-title');
  const evDateInput = document.getElementById('ev-date');
  const evAllDay = document.getElementById('ev-allday');
  const evTimeRow = document.getElementById('ev-time-row');
  const evStartInput = document.getElementById('ev-start');
  const evEndInput = document.getElementById('ev-end');
  const evRepeatSelect = document.getElementById('ev-repeat');
  const evRepeatChips = document.getElementById('ev-repeat-chips');
  const evLocationInput = document.getElementById('ev-location');
  const evDescriptionInput = document.getElementById('ev-description');
  const evDeleteBtn = document.getElementById('ev-delete-btn');
  const evDeleteConfirm = document.getElementById('ev-delete-confirm');
  const evFooter = document.getElementById('ev-footer');
  const evCloseBtn = document.getElementById('ev-close-btn');
  const evCancelBtn = document.getElementById('ev-cancel-btn');

  const modalState = { mode: 'create', eventId: null, occurrenceDate: null };

  function repeatOptionsFor(dateKey) {
    const d = fromDateKey(dateKey);
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    const monthDay = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    return [
      { value: 'none', label: 'Does not repeat' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
      { value: 'weekly', label: `Weekly on ${weekday}` },
      { value: 'monthly', label: `Monthly on day ${d.getDate()}` },
      { value: 'yearly', label: `Yearly on ${monthDay}` },
      { value: 'custom', label: 'Custom…' },
    ];
  }

  function rebuildRepeatSelect(dateKey, preserveValue) {
    const keep = preserveValue !== undefined ? preserveValue : evRepeatSelect.value;
    evRepeatSelect.innerHTML = '';
    repeatOptionsFor(dateKey).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      evRepeatSelect.appendChild(o);
    });
    if (keep) evRepeatSelect.value = keep;
  }

  function repeatSelectValueFor(repeat, dateKey) {
    if (!repeat || repeat.type === 'none') return 'none';
    if (repeat.type === 'daily') return 'daily';
    if (repeat.type === 'weekdays') return 'weekdays';
    if (repeat.type === 'monthly') return 'monthly';
    if (repeat.type === 'yearly') return 'yearly';
    if (repeat.type === 'weekly') {
      const anchorWeekday = fromDateKey(dateKey).getDay();
      const days = (repeat.days && repeat.days.length) ? repeat.days : [anchorWeekday];
      if (days.length === 1 && days[0] === anchorWeekday) return 'weekly';
      return 'custom';
    }
    return 'none';
  }

  function buildWeekdayChips(container, selectedDays, minSelected) {
    container.innerHTML = '';
    const selected = new Set(selectedDays);
    WEEKDAY_LETTERS.forEach((letter, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'weekday-chip';
      chip.textContent = letter;
      chip.dataset.day = String(idx);
      chip.classList.toggle('selected', selected.has(idx));
      chip.addEventListener('click', () => {
        if (selected.has(idx)) {
          if (selected.size <= minSelected) return;
          selected.delete(idx);
        } else {
          selected.add(idx);
        }
        chip.classList.toggle('selected');
      });
      container.appendChild(chip);
    });
  }

  function getSelectedChipDays(container) {
    return Array.from(container.querySelectorAll('.weekday-chip.selected')).map(c => Number(c.dataset.day)).sort();
  }

  function updateRepeatChipsVisibility() {
    const isCustom = evRepeatSelect.value === 'custom';
    evRepeatChips.hidden = !isCustom;
    if (isCustom && !evRepeatChips.children.length) {
      buildWeekdayChips(evRepeatChips, [fromDateKey(evDateInput.value).getDay()], 1);
    }
  }

  evRepeatSelect.addEventListener('change', updateRepeatChipsVisibility);
  evDateInput.addEventListener('change', () => {
    rebuildRepeatSelect(evDateInput.value);
    updateRepeatChipsVisibility();
  });
  evAllDay.addEventListener('change', () => { evTimeRow.hidden = evAllDay.checked; });

  function resetDeleteConfirmState() {
    evDeleteConfirm.hidden = true;
    evFooter.hidden = false;
  }

  function openEventModal({ mode, event, date, start, end, occurrenceDate }) {
    modalState.mode = mode;
    modalState.eventId = event ? event.id : null;
    modalState.occurrenceDate = occurrenceDate || (event ? event.date : date);

    evTitleInput.value = event ? event.title : '';
    const dKey = event ? (occurrenceDate || event.date) : date;
    evDateInput.value = dKey;
    evAllDay.checked = event ? event.allDay : false;
    evTimeRow.hidden = evAllDay.checked;
    evStartInput.value = event ? (event.start || '09:00') : (start || '09:00');
    evEndInput.value = event ? (event.end || '10:00') : (end || addMinutesToHHMM(start || '09:00', 60));
    evLocationInput.value = event ? (event.location || '') : '';
    evDescriptionInput.value = event ? (event.description || '') : '';

    rebuildRepeatSelect(dKey, event ? repeatSelectValueFor(event.repeat, dKey) : 'none');
    evRepeatChips.innerHTML = '';
    updateRepeatChipsVisibility();
    if (evRepeatSelect.value === 'custom' && event) {
      buildWeekdayChips(evRepeatChips, event.repeat.days && event.repeat.days.length ? event.repeat.days : [fromDateKey(dKey).getDay()], 1);
    }

    evDeleteBtn.hidden = mode !== 'edit';
    resetDeleteConfirmState();

    evOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => evTitleInput.focus(), 30);
  }

  function closeEventModal() {
    evOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function openCreateModal(dateKey, startHHMM) {
    const s = startHHMM || '09:00';
    openEventModal({ mode: 'create', date: dateKey, start: s, end: addMinutesToHHMM(s, 60) });
  }
  function openEditModal(eventId, occurrenceDate) {
    const ev = findEvent(eventId);
    if (!ev) return;
    openEventModal({ mode: 'edit', event: ev, occurrenceDate });
  }

  evCloseBtn.addEventListener('click', closeEventModal);
  evCancelBtn.addEventListener('click', closeEventModal);
  evOverlay.addEventListener('click', e => { if (e.target === evOverlay) closeEventModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !evOverlay.hidden) closeEventModal();
  });

  function buildRepeatFromForm(dateKey) {
    const val = evRepeatSelect.value;
    if (val === 'weekly') return { type: 'weekly', days: [fromDateKey(dateKey).getDay()], until: null };
    if (val === 'custom') {
      const days = getSelectedChipDays(evRepeatChips);
      return { type: 'weekly', days: days.length ? days : [fromDateKey(dateKey).getDay()], until: null };
    }
    if (['daily', 'weekdays', 'monthly', 'yearly'].includes(val)) return { type: val, days: [], until: null };
    return { type: 'none', days: [], until: null };
  }

  evForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = evTitleInput.value.trim() || 'Untitled';
    const date = evDateInput.value;
    const allDay = evAllDay.checked;
    let start = allDay ? null : (evStartInput.value || '09:00');
    let end = allDay ? null : (evEndInput.value || addMinutesToHHMM(start, 60));
    if (!allDay && end <= start) end = '23:59';
    const location = evLocationInput.value.trim();
    const description = evDescriptionInput.value.trim();
    const repeat = buildRepeatFromForm(date);

    if (modalState.mode === 'create') {
      state.events.push({ id: uid(), title, allDay, date, start, end, location, description, repeat, exceptions: [] });
    } else {
      const ev = findEvent(modalState.eventId);
      if (ev) Object.assign(ev, { title, allDay, date, start, end, location, description, repeat });
    }
    save();
    closeEventModal();
    renderSchedule();
  });

  evDeleteBtn.addEventListener('click', () => {
    const ev = findEvent(modalState.eventId);
    if (!ev) return;
    if (ev.repeat.type === 'none') {
      deleteOccurrence(ev.id, modalState.occurrenceDate, 'all');
      closeEventModal();
      renderSchedule();
    } else {
      evDeleteConfirm.hidden = false;
      evFooter.hidden = true;
    }
  });
  document.getElementById('ev-delete-day-btn').addEventListener('click', () => {
    deleteOccurrence(modalState.eventId, modalState.occurrenceDate, 'day');
    closeEventModal();
    renderSchedule();
  });
  document.getElementById('ev-delete-all-btn').addEventListener('click', () => {
    deleteOccurrence(modalState.eventId, modalState.occurrenceDate, 'all');
    closeEventModal();
    renderSchedule();
  });
  document.getElementById('ev-delete-back-btn').addEventListener('click', resetDeleteConfirmState);

  // ================= SCHEDULE =================
  const dayEventTpl = document.getElementById('tpl-day-event');
  const miniMonthTpl = document.getElementById('tpl-mini-month');

  const schedDateLabel = document.getElementById('sched-date-label');
  const schedTodayBtn = document.getElementById('sched-today-btn');
  const viewContainers = {
    day: document.getElementById('view-day'),
    week: document.getElementById('view-week'),
    month: document.getElementById('view-month'),
    year: document.getElementById('view-year'),
  };

  function setScheduleView(v) {
    scheduleView = v;
    state.scheduleView = v;
    save();
    document.querySelectorAll('.view-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    renderSchedule();
  }

  document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
    if (btn.dataset.view === scheduleView) btn.classList.add('active');
    else btn.classList.remove('active');
    btn.addEventListener('click', () => setScheduleView(btn.dataset.view));
  });

  document.getElementById('sched-prev').addEventListener('click', () => {
    if (scheduleView === 'day') setSelectedDate(addDays(selectedDate, -1));
    else if (scheduleView === 'week') setSelectedDate(addWeeks(selectedDate, -1));
    else if (scheduleView === 'month') setSelectedDate(addMonths(selectedDate, -1));
    else setSelectedDate(addYears(selectedDate, -1));
  });
  document.getElementById('sched-next').addEventListener('click', () => {
    if (scheduleView === 'day') setSelectedDate(addDays(selectedDate, 1));
    else if (scheduleView === 'week') setSelectedDate(addWeeks(selectedDate, 1));
    else if (scheduleView === 'month') setSelectedDate(addMonths(selectedDate, 1));
    else setSelectedDate(addYears(selectedDate, 1));
  });
  schedTodayBtn.addEventListener('click', () => setSelectedDate(todayKey()));

  function renderSchedule() {
    if (scheduleView === 'day') schedDateLabel.textContent = formatDayLabel(selectedDate);
    else if (scheduleView === 'week') schedDateLabel.textContent = formatWeekLabel(selectedDate);
    else if (scheduleView === 'month') schedDateLabel.textContent = formatMonthLabel(selectedDate);
    else schedDateLabel.textContent = formatYearLabel(selectedDate);

    schedTodayBtn.hidden = selectedDate === todayKey();

    Object.keys(viewContainers).forEach(v => { viewContainers[v].hidden = v !== scheduleView; });

    if (scheduleView === 'day') renderDayView();
    else if (scheduleView === 'week') renderWeekView();
    else if (scheduleView === 'month') { renderMonthWeekdayRow(); renderMonthView(); }
    else renderYearView();
  }

  // ---- Day view ----
  const dayEventsListEl = document.getElementById('day-events-list');

  function renderDayView() {
    dayEventsListEl.innerHTML = '';
    const events = getEventsForDate(selectedDate);
    if (events.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing scheduled — add an event below.';
      dayEventsListEl.appendChild(empty);
      return;
    }
    events.forEach(ev => {
      const node = dayEventTpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.day-event-time').textContent = ev.allDay ? 'All day' : `${formatTimeShort(ev.start)}\n${formatTimeShort(ev.end)}`;
      node.querySelector('.day-event-title').textContent = ev.title;
      node.querySelector('.day-event-loc').textContent = ev.location || '';
      node.querySelector('.day-event-repeat').hidden = ev.repeat.type === 'none';
      node.addEventListener('click', () => openEditModal(ev.id, ev.occurrenceDate));
      dayEventsListEl.appendChild(node);
    });
  }

  document.getElementById('add-event-btn').addEventListener('click', () => {
    openCreateModal(selectedDate, '09:00');
  });

  // ---- Week view ----
  const weekHeaderRowEl = document.getElementById('week-header-row');
  const weekAllDayRowEl = document.getElementById('week-allday-row');
  const weekGutterEl = document.getElementById('week-gutter');
  const weekDaysEl = document.getElementById('week-days');
  const weekBodyEl = document.getElementById('week-body');

  function layoutDayEvents(events) {
    const withMinutes = events.map(ev => ({
      ev,
      startMin: minutesFromHHMM(ev.start || '00:00'),
      endMin: Math.max(minutesFromHHMM(ev.end || '23:59'), minutesFromHHMM(ev.start || '00:00') + 15),
    })).sort((a, b) => a.startMin - b.startMin);

    const colEnds = [];
    const placed = withMinutes.map(item => {
      let colIndex = colEnds.findIndex(end => end <= item.startMin);
      if (colIndex === -1) { colIndex = colEnds.length; colEnds.push(item.endMin); }
      else colEnds[colIndex] = item.endMin;
      return { ...item, colIndex };
    });
    const totalCols = colEnds.length || 1;
    return placed.map(p => ({ ...p, totalCols }));
  }

  function renderWeekHourLabels() {
    weekGutterEl.innerHTML = '';
    weekGutterEl.style.height = `${24 * HOUR_PX}px`;
    for (let h = 0; h < 24; h++) {
      const label = document.createElement('div');
      label.className = 'whg-hour-label';
      label.style.top = `${h * HOUR_PX}px`;
      const period = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      label.textContent = period;
      weekGutterEl.appendChild(label);
    }
  }

  function renderWeekView() {
    const startKey = startOfWeek(selectedDate);
    const tKey = todayKey();

    weekHeaderRowEl.innerHTML = '<div class="whg-header-spacer"></div>';
    weekAllDayRowEl.innerHTML = '<div class="whg-allday-spacer"></div>';
    weekDaysEl.innerHTML = '';
    weekDaysEl.style.height = `${24 * HOUR_PX}px`;
    renderWeekHourLabels();

    for (let i = 0; i < 7; i++) {
      const dayKey = addDays(startKey, i);
      const dayDate = fromDateKey(dayKey);
      const isToday = dayKey === tKey;

      const headerCell = document.createElement('button');
      headerCell.type = 'button';
      headerCell.className = 'whg-day-header-cell';
      headerCell.classList.toggle('is-today', isToday);
      headerCell.innerHTML = `<span class="wdh-name">${dayDate.toLocaleDateString(undefined, { weekday: 'short' })}</span><span class="wdh-num">${dayDate.getDate()}</span>`;
      headerCell.addEventListener('click', () => { setSelectedDate(dayKey); setScheduleView('day'); });
      weekHeaderRowEl.appendChild(headerCell);

      const allDayEvents = getEventsForDate(dayKey).filter(ev => ev.allDay);
      const allDayCell = document.createElement('div');
      allDayCell.className = 'whg-allday-cell';
      allDayEvents.forEach(ev => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'whg-allday-pill';
        pill.textContent = ev.title;
        pill.addEventListener('click', ev2 => { ev2.stopPropagation(); openEditModal(ev.id, ev.occurrenceDate); });
        allDayCell.appendChild(pill);
      });
      weekAllDayRowEl.appendChild(allDayCell);

      const col = document.createElement('div');
      col.className = 'whg-day-col';
      col.classList.toggle('is-today', isToday);
      col.dataset.date = dayKey;
      col.style.height = `${24 * HOUR_PX}px`;

      const timedEvents = getEventsForDate(dayKey).filter(ev => !ev.allDay);
      const laidOut = layoutDayEvents(timedEvents);
      laidOut.forEach(item => {
        const block = document.createElement('div');
        block.className = 'whg-event';
        block.dataset.eventId = item.ev.id;
        block.dataset.occurrenceDate = item.ev.occurrenceDate;
        block.dataset.startMin = String(item.startMin);
        block.dataset.endMin = String(item.endMin);
        block.dataset.title = item.ev.title;
        const top = (item.startMin / 60) * HOUR_PX;
        const height = Math.max(((item.endMin - item.startMin) / 60) * HOUR_PX, 18);
        const widthPct = 100 / item.totalCols;
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.left = `${item.colIndex * widthPct}%`;
        block.style.width = `calc(${widthPct}% - 2px)`;
        block.innerHTML = `<span class="we-title">${escapeHtml(item.ev.title)}</span><span class="we-time">${formatTimeShort(item.ev.start)} – ${formatTimeShort(item.ev.end)}</span>`;
        col.appendChild(block);
      });

      if (isToday) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const nowLine = document.createElement('div');
        nowLine.className = 'whg-now-line';
        nowLine.style.top = `${(nowMin / 60) * HOUR_PX}px`;
        col.appendChild(nowLine);
      }

      col.addEventListener('click', e => {
        if (e.target.closest('.whg-event')) return;
        const rect = col.getBoundingClientRect();
        const mins = round15(((e.clientY - rect.top) / HOUR_PX) * 60);
        openCreateModal(dayKey, hhmmFromMinutes(clamp(mins, 0, 23 * 60)));
      });

      weekDaysEl.appendChild(col);
    }

    requestAnimationFrame(() => {
      weekBodyEl.scrollTop = Math.max(0, 4 * HOUR_PX);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // -- week drag-to-move --
  let dragCtx = null;

  weekDaysEl.addEventListener('pointerdown', e => {
    const block = e.target.closest('.whg-event');
    if (!block) return;
    e.preventDefault();
    const rect = block.getBoundingClientRect();
    dragCtx = {
      block,
      eventId: block.dataset.eventId,
      occurrenceDate: block.dataset.occurrenceDate,
      title: block.dataset.title,
      durationMin: Number(block.dataset.endMin) - Number(block.dataset.startMin),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
      ghost: null,
    };
    block.setPointerCapture(e.pointerId);
    block.addEventListener('pointermove', onDragMove);
    block.addEventListener('pointerup', onDragEnd);
    block.addEventListener('pointercancel', onDragEnd);
  });

  function onDragMove(e) {
    if (!dragCtx) return;
    const dx = e.clientX - dragCtx.startX;
    const dy = e.clientY - dragCtx.startY;
    if (!dragCtx.moved && Math.hypot(dx, dy) > 6) {
      dragCtx.moved = true;
      const ghost = document.createElement('div');
      ghost.className = 'whg-event whg-event-ghost';
      ghost.innerHTML = `<span class="we-title">${escapeHtml(dragCtx.title)}</span>`;
      ghost.style.width = `${dragCtx.width}px`;
      ghost.style.height = `${dragCtx.height}px`;
      document.body.appendChild(ghost);
      dragCtx.ghost = ghost;
      dragCtx.block.classList.add('dragging-source');
    }
    if (dragCtx.moved && dragCtx.ghost) {
      dragCtx.ghost.style.left = `${e.clientX - dragCtx.offsetX}px`;
      dragCtx.ghost.style.top = `${e.clientY - dragCtx.offsetY}px`;
      document.querySelectorAll('.whg-day-col.drag-over').forEach(c => c.classList.remove('drag-over'));
      const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.whg-day-col');
      if (col) col.classList.add('drag-over');
    }
  }

  function onDragEnd(e) {
    if (!dragCtx) return;
    const block = dragCtx.block;
    try { block.releasePointerCapture(dragCtx.pointerId); } catch (err) { /* already released */ }
    block.removeEventListener('pointermove', onDragMove);
    block.removeEventListener('pointerup', onDragEnd);
    block.removeEventListener('pointercancel', onDragEnd);
    block.classList.remove('dragging-source');
    document.querySelectorAll('.whg-day-col.drag-over').forEach(c => c.classList.remove('drag-over'));
    if (dragCtx.ghost) dragCtx.ghost.remove();

    if (!dragCtx.moved) {
      openEditModal(dragCtx.eventId, dragCtx.occurrenceDate);
      dragCtx = null;
      return;
    }

    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.whg-day-col');
    if (col) {
      const rect = col.getBoundingClientRect();
      const startMin = clamp(round15(((e.clientY - dragCtx.offsetY) - rect.top) / HOUR_PX * 60), 0, 24 * 60 - dragCtx.durationMin);
      const endMin = startMin + dragCtx.durationMin;
      moveOccurrence(dragCtx.eventId, dragCtx.occurrenceDate, col.dataset.date, hhmmFromMinutes(startMin), hhmmFromMinutes(endMin));
      renderSchedule();
    }
    dragCtx = null;
  }

  // ---- Month view ----
  const monthWeekdayRowEl = document.getElementById('month-weekday-row');
  const monthGridEl = document.getElementById('month-grid');
  const MONTH_PILL_LIMIT = 3;

  function renderMonthWeekdayRow() {
    monthWeekdayRowEl.innerHTML = '';
    WEEKDAY_LETTERS.forEach(l => {
      const s = document.createElement('span');
      s.textContent = l;
      monthWeekdayRowEl.appendChild(s);
    });
  }

  function renderMonthView() {
    monthGridEl.innerHTML = '';
    const d = fromDateKey(selectedDate);
    const year = d.getFullYear(), monthIdx = d.getMonth();
    const monthStartKey = toDateKey(new Date(year, monthIdx, 1));
    const gridStartKey = startOfWeek(monthStartKey);
    const tKey = todayKey();

    for (let i = 0; i < 42; i++) {
      const cellKey = addDays(gridStartKey, i);
      const cellDate = fromDateKey(cellKey);
      const cell = document.createElement('div');
      cell.className = 'month-cell';
      cell.classList.toggle('outside-month', cellDate.getMonth() !== monthIdx);
      cell.classList.toggle('is-today', cellKey === tKey);
      cell.classList.toggle('is-selected', cellKey === selectedDate);

      const numRow = document.createElement('div');
      numRow.className = 'month-cell-num-row';
      const num = document.createElement('span');
      num.className = 'month-cell-num';
      num.textContent = cellDate.getDate();
      numRow.appendChild(num);
      cell.appendChild(numRow);

      const eventsWrap = document.createElement('div');
      eventsWrap.className = 'month-cell-events';
      const dayEvents = getEventsForDate(cellKey);
      dayEvents.slice(0, MONTH_PILL_LIMIT).forEach(ev => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'month-pill';
        pill.innerHTML = ev.allDay ? escapeHtml(ev.title) : `<span class="mp-time">${formatTimeShort(ev.start)}</span>${escapeHtml(ev.title)}`;
        pill.addEventListener('click', e => { e.stopPropagation(); openEditModal(ev.id, ev.occurrenceDate); });
        eventsWrap.appendChild(pill);
      });
      if (dayEvents.length > MONTH_PILL_LIMIT) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'month-cell-more';
        more.textContent = `+${dayEvents.length - MONTH_PILL_LIMIT} more`;
        more.addEventListener('click', e => { e.stopPropagation(); setSelectedDate(cellKey); setScheduleView('day'); });
        eventsWrap.appendChild(more);
      }
      cell.appendChild(eventsWrap);

      cell.addEventListener('click', () => { setSelectedDate(cellKey); setScheduleView('day'); });
      monthGridEl.appendChild(cell);
    }
  }

  // ---- Year view ----
  const yearGridEl = document.getElementById('year-grid');
  yearGridEl.addEventListener('click', e => {
    const dayBtn = e.target.closest('.mini-day');
    if (dayBtn) {
      setSelectedDate(dayBtn.dataset.date);
      setScheduleView('day');
      return;
    }
    const titleBtn = e.target.closest('.mini-month-title');
    if (titleBtn) {
      const year = fromDateKey(selectedDate).getFullYear();
      const monthIdx = Number(titleBtn.dataset.month);
      const curDay = fromDateKey(selectedDate).getDate();
      const clampedDay = Math.min(curDay, daysInMonth(year, monthIdx));
      setSelectedDate(toDateKey(new Date(year, monthIdx, clampedDay)));
      setScheduleView('month');
    }
  });

  function renderYearView() {
    yearGridEl.innerHTML = '';
    const year = fromDateKey(selectedDate).getFullYear();
    const tKey = todayKey();
    for (let m = 0; m < 12; m++) {
      const node = miniMonthTpl.content.firstElementChild.cloneNode(true);
      const titleBtn = node.querySelector('.mini-month-title');
      titleBtn.textContent = new Date(year, m, 1).toLocaleDateString(undefined, { month: 'long' });
      titleBtn.dataset.month = String(m);

      const weekdaysRow = node.querySelector('.mini-month-weekdays');
      WEEKDAY_LETTERS.forEach(l => {
        const s = document.createElement('span');
        s.textContent = l;
        weekdaysRow.appendChild(s);
      });

      const grid = node.querySelector('.mini-month-grid');
      const firstOfMonth = new Date(year, m, 1);
      const startOffset = firstOfMonth.getDay();
      const totalDays = daysInMonth(year, m);
      for (let i = 0; i < startOffset; i++) {
        const blank = document.createElement('span');
        blank.className = 'mini-day-blank';
        grid.appendChild(blank);
      }
      for (let day = 1; day <= totalDays; day++) {
        const cellKey = toDateKey(new Date(year, m, day));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mini-day';
        btn.textContent = String(day);
        btn.dataset.date = cellKey;
        if (cellKey === tKey) btn.classList.add('is-today');
        if (cellKey === selectedDate) btn.classList.add('is-selected');
        grid.appendChild(btn);
      }
      yearGridEl.appendChild(node);
    }
  }

  // ================= HABITS =================
  const habitsListEl = document.getElementById('habits-list');
  const habitCardTpl = document.getElementById('tpl-habit-card');
  const viewedDateLabel = document.getElementById('viewed-date-label');
  const habitsTodayBtn = document.getElementById('date-today-btn');

  const habitForm = document.getElementById('habit-form');
  const habitNameInput = document.getElementById('habit-name-input');
  const habitFreqType = document.getElementById('habit-freq-type');
  const habitFreqCountWrap = document.getElementById('habit-freq-count-wrap');
  const habitFreqCount = document.getElementById('habit-freq-count');
  const habitFreqDaysWrap = document.getElementById('habit-freq-days-wrap');

  function updateHabitFormFreqUI() {
    const type = habitFreqType.value;
    habitFreqCountWrap.hidden = type !== 'weekly';
    habitFreqDaysWrap.hidden = type !== 'days';
    if (type === 'days' && !habitFreqDaysWrap.children.length) {
      buildWeekdayChips(habitFreqDaysWrap, [new Date().getDay()], 1);
    }
  }
  habitFreqType.addEventListener('change', updateHabitFormFreqUI);

  function frequencyFromSelectAndInputs(typeVal, countInput, daysWrap) {
    if (typeVal === 'weekly') return { type: 'weekly', timesPerWeek: clamp(parseInt(countInput.value, 10) || 1, 1, 7) };
    if (typeVal === 'days') return { type: 'days', days: getSelectedChipDays(daysWrap) };
    return { type: 'daily' };
  }

  habitForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = habitNameInput.value.trim();
    if (!name) return;
    const frequency = frequencyFromSelectAndInputs(habitFreqType.value, habitFreqCount, habitFreqDaysWrap);
    state.habits.push({ id: uid(), name, frequency });
    save();
    habitForm.reset();
    habitFreqCountWrap.hidden = true;
    habitFreqDaysWrap.hidden = true;
    habitFreqDaysWrap.innerHTML = '';
    renderHabits();
    habitNameInput.focus();
  });

  document.getElementById('date-prev').addEventListener('click', () => setSelectedDate(addDays(selectedDate, -1)));
  document.getElementById('date-next').addEventListener('click', () => setSelectedDate(addDays(selectedDate, 1)));
  habitsTodayBtn.addEventListener('click', () => setSelectedDate(todayKey()));

  function freqBadgeText(freq) {
    if (freq.type === 'daily') return 'Daily';
    if (freq.type === 'weekly') return `${freq.timesPerWeek}× / week`;
    if (freq.type === 'days') return freq.days.slice().sort().map(d => WEEKDAY_SHORT[d]).join(', ');
    return '';
  }

  function updateHabitStat(habit, node) {
    const statEl = node.querySelector('.habit-stat');
    const subEl = node.querySelector('.habit-substat');
    if (habit.frequency.type === 'daily') {
      statEl.textContent = '';
      subEl.textContent = '';
    } else {
      const { progress, target } = weeklyProgress(habit, selectedDate);
      statEl.textContent = `${progress} of ${target} this week`;
      statEl.classList.toggle('accent', progress >= target);
      const start = startOfWeek(selectedDate);
      subEl.textContent = `Week of ${fromDateKey(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }

  function renderHabitDotGrid(habitId, node, days) {
    const gridEl = node.querySelector('.habit-grid');
    gridEl.innerHTML = '';
    const tKey = todayKey();
    days.forEach((dayKey, i) => {
      const dot = document.createElement('span');
      dot.className = 'hg-dot';
      if (isDone(habitId, dayKey)) dot.classList.add('filled');
      if (dayKey === tKey) dot.classList.add('today-marker');
      if (i === days.length - 21) dot.classList.add('milestone-21');
      dot.title = dayKey;
      gridEl.appendChild(dot);
    });
  }

  function renderHabits() {
    viewedDateLabel.textContent = formatDayLabel(selectedDate);
    habitsTodayBtn.hidden = selectedDate === todayKey();

    habitsListEl.innerHTML = '';
    if (state.habits.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No habits yet — add your first one above.';
      habitsListEl.appendChild(empty);
      return;
    }

    const days = last90Keys();
    const viewedWeekday = fromDateKey(selectedDate).getDay();

    state.habits.forEach(habit => {
      const node = habitCardTpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = habit.id;
      const editing = editingHabitId === habit.id;
      node.classList.toggle('editing', editing);

      const isScheduledToday = habit.frequency.type !== 'days' || habit.frequency.days.includes(viewedWeekday);
      node.classList.toggle('not-scheduled', !isScheduledToday);

      node.querySelector('.habit-name').textContent = habit.name;
      node.querySelector('.habit-freq-badge').textContent = freqBadgeText(habit.frequency);

      const checkbox = node.querySelector('.habit-checkbox');
      checkbox.checked = isScheduledToday && isDone(habit.id, selectedDate);
      checkbox.disabled = !isScheduledToday;
      checkbox.addEventListener('change', e => {
        setDone(habit.id, selectedDate, e.target.checked);
        updateHabitStat(habit, node);
        renderHabitDotGrid(habit.id, node, days);
      });

      updateHabitStat(habit, node);
      renderHabitDotGrid(habit.id, node, days);

      node.querySelector('.habit-display').hidden = editing;
      node.querySelector('.habit-edit-fields').hidden = !editing;
      node.querySelector('.habit-actions-view').hidden = editing;
      node.querySelector('.habit-actions-edit').hidden = !editing;

      if (editing) {
        const nameInput = node.querySelector('.habit-edit-name');
        nameInput.value = habit.name;
        const freqTypeSel = node.querySelector('.habit-edit-freq-type');
        freqTypeSel.value = habit.frequency.type;
        const countWrap = node.querySelector('.habit-edit-freq-count-wrap');
        const countInput = node.querySelector('.habit-edit-freq-count');
        const daysWrap = node.querySelector('.habit-edit-freq-days-wrap');
        countInput.value = habit.frequency.type === 'weekly' ? habit.frequency.timesPerWeek : 1;
        countWrap.hidden = habit.frequency.type !== 'weekly';
        daysWrap.hidden = habit.frequency.type !== 'days';
        buildWeekdayChips(daysWrap, habit.frequency.type === 'days' ? habit.frequency.days : [viewedWeekday], 1);

        freqTypeSel.addEventListener('change', () => {
          countWrap.hidden = freqTypeSel.value !== 'weekly';
          daysWrap.hidden = freqTypeSel.value !== 'days';
          if (freqTypeSel.value === 'days' && !daysWrap.children.length) buildWeekdayChips(daysWrap, [viewedWeekday], 1);
        });

        node.querySelector('.habit-save-btn').addEventListener('click', () => {
          const newName = nameInput.value.trim();
          if (!newName) return;
          habit.name = newName;
          habit.frequency = frequencyFromSelectAndInputs(freqTypeSel.value, countInput, daysWrap);
          save();
          editingHabitId = null;
          renderHabits();
        });
        node.querySelector('.habit-cancel-btn').addEventListener('click', () => {
          editingHabitId = null;
          renderHabits();
        });
      } else {
        node.querySelector('.habit-edit-btn').addEventListener('click', () => {
          editingHabitId = habit.id;
          renderHabits();
        });
        node.querySelector('.habit-delete-btn').addEventListener('click', () => {
          if (!confirm(`Delete "${habit.name}"? This can't be undone.`)) return;
          state.habits = state.habits.filter(h => h.id !== habit.id);
          save();
          renderHabits();
        });
      }

      habitsListEl.appendChild(node);
    });
  }

  // ================= ASSIGNMENTS =================
  const assignForm = document.getElementById('assignment-form');
  const assignTitleInput = document.getElementById('assign-title');
  const assignCourseInput = document.getElementById('assign-course');
  const assignDueInput = document.getElementById('assign-due');
  const assignLinkInput = document.getElementById('assign-link');
  const assignFileBtn = document.getElementById('assign-file-btn');
  const assignFileInput = document.getElementById('assign-file-input');
  const assignFileName = document.getElementById('assign-file-name');
  const assignFileClear = document.getElementById('assign-file-clear');
  const assignmentsListEl = document.getElementById('assignments-list');
  const assignmentsGroupedEl = document.getElementById('assignments-grouped');
  const assignRowTpl = document.getElementById('tpl-assignment-row');
  const assignGroupTpl = document.getElementById('tpl-assignment-group');

  let pendingAttachment = null;

  assignFileBtn.addEventListener('click', () => assignFileInput.click());
  assignFileInput.addEventListener('change', () => {
    const file = assignFileInput.files[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert('That file is too large to store locally (4 MB max). Try pasting a link instead.');
      assignFileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingAttachment = { name: file.name, type: file.type, dataUrl: reader.result };
      assignFileName.textContent = file.name;
      assignFileClear.hidden = false;
    };
    reader.readAsDataURL(file);
  });
  assignFileClear.addEventListener('click', () => {
    pendingAttachment = null;
    assignFileInput.value = '';
    assignFileName.textContent = '';
    assignFileClear.hidden = true;
  });

  const assignViewSwitcher = document.getElementById('assignments-view-switcher');
  assignViewSwitcher.querySelectorAll('.view-btn[data-aview]').forEach(btn => {
    if (btn.dataset.aview === state.assignmentsView) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.assignmentsView = btn.dataset.aview;
      save();
      assignViewSwitcher.querySelectorAll('.view-btn[data-aview]').forEach(b => b.classList.toggle('active', b === btn));
      renderAssignments();
    });
  });

  function openAssignmentLink(a) {
    if (a.attachment && a.attachment.dataUrl) {
      const w = window.open();
      if (w) { w.document.write(`<title>${a.title}</title><style>body{margin:0}</style>${a.attachment.type && a.attachment.type.startsWith('image') ? `<img src="${a.attachment.dataUrl}" style="max-width:100%">` : `<embed src="${a.attachment.dataUrl}" width="100%" height="100%">`}`); }
    } else if (a.link) {
      window.open(a.link, '_blank', 'noopener');
    }
  }

  function buildAssignmentRow(a, tKey) {
    const node = assignRowTpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = a.id;
    if (a.done) node.classList.add('done');
    if (!a.done && a.dueDate < tKey) node.classList.add('overdue');
    if (!a.done && a.dueDate === tKey) node.classList.add('due-today');

    node.querySelector('.assignment-title').textContent = a.title;
    node.querySelector('.assignment-meta').textContent = `${a.course} · Due ${formatDueDate(a.dueDate)}`;

    const hasLink = !!(a.link || a.attachment);
    const titleBtn = node.querySelector('.assignment-title-btn');
    if (hasLink) {
      titleBtn.addEventListener('click', () => openAssignmentLink(a));
    } else {
      titleBtn.style.cursor = 'default';
    }

    const linksWrap = node.querySelector('.assignment-links');
    if (a.link) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'assignment-link-chip';
      chip.textContent = 'Open link ↗';
      chip.addEventListener('click', e => { e.stopPropagation(); window.open(a.link, '_blank', 'noopener'); });
      linksWrap.appendChild(chip);
    }
    if (a.attachment) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'assignment-link-chip';
      chip.textContent = `📎 ${a.attachment.name}`;
      chip.addEventListener('click', e => { e.stopPropagation(); openAssignmentLink(a); });
      linksWrap.appendChild(chip);
    }

    const checkbox = node.querySelector('.assign-checkbox');
    checkbox.checked = !!a.done;
    checkbox.addEventListener('change', e => {
      a.done = e.target.checked;
      save();
      renderAssignments();
    });

    node.querySelector('.assign-delete').addEventListener('click', () => {
      state.assignments = state.assignments.filter(x => x.id !== a.id);
      save();
      renderAssignments();
    });

    return node;
  }

  function renderAssignments() {
    const isStatusView = state.assignmentsView === 'status';
    assignmentsListEl.hidden = isStatusView;
    assignmentsGroupedEl.hidden = !isStatusView;

    if (state.assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing due — add an assignment above.';
      assignmentsListEl.innerHTML = '';
      assignmentsListEl.appendChild(empty.cloneNode(true));
      assignmentsGroupedEl.innerHTML = '';
      assignmentsGroupedEl.appendChild(empty);
      return;
    }

    const tKey = todayKey();
    const sorted = [...state.assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (!isStatusView) {
      assignmentsListEl.innerHTML = '';
      sorted.forEach(a => assignmentsListEl.appendChild(buildAssignmentRow(a, tKey)));
      return;
    }

    assignmentsGroupedEl.innerHTML = '';
    const groups = [
      { key: 'overdue', title: 'Overdue', items: sorted.filter(a => !a.done && a.dueDate < tKey), cls: 'is-overdue' },
      { key: 'upcoming', title: 'Upcoming', items: sorted.filter(a => !a.done && a.dueDate >= tKey), cls: '' },
      { key: 'completed', title: 'Completed', items: sorted.filter(a => a.done), cls: '' },
    ];
    groups.forEach(group => {
      if (group.items.length === 0) return;
      const node = assignGroupTpl.content.firstElementChild.cloneNode(true);
      if (group.cls) node.classList.add(group.cls);
      node.querySelector('.assignment-group-title').textContent = group.title;
      const list = node.querySelector('.assignment-group-list');
      group.items.forEach(a => list.appendChild(buildAssignmentRow(a, tKey)));
      assignmentsGroupedEl.appendChild(node);
    });
  }

  assignForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = assignTitleInput.value.trim();
    const course = assignCourseInput.value.trim();
    const dueDate = assignDueInput.value;
    if (!title || !course || !dueDate) return;
    const link = assignLinkInput.value.trim();
    state.assignments.push({ id: uid(), title, course, dueDate, done: false, link, attachment: pendingAttachment });
    save();
    assignForm.reset();
    pendingAttachment = null;
    assignFileName.textContent = '';
    assignFileClear.hidden = true;
    renderAssignments();
    assignTitleInput.focus();
  });

  // ---------- init ----------
  renderSchedule();
  renderHabits();
  renderAssignments();
})();
