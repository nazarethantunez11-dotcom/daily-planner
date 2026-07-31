(() => {
  'use strict';

  const STORAGE_KEY = 'planner.v4';
  const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOUR_PX = 60;
  const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

  const COLOR_PALETTE = [
    { id: 'slate', hex: '#5b6570', label: 'Slate' },
    { id: 'clay', hex: '#a85c3f', label: 'Clay' },
    { id: 'amber', hex: '#b8863c', label: 'Amber' },
    { id: 'olive', hex: '#6d7a42', label: 'Olive' },
    { id: 'pine', hex: '#3f6b56', label: 'Pine' },
    { id: 'teal', hex: '#3c7c85', label: 'Teal' },
    { id: 'indigo', hex: '#4c5c99', label: 'Indigo' },
    { id: 'plum', hex: '#7a4f82', label: 'Plum' },
    { id: 'rose', hex: '#a34c6a', label: 'Rose' },
  ];

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
  function weekly(name, n) { return { id: uid(), name, frequency: { type: 'weekly', timesPerWeek: n, days: [] } }; }

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
      daily('Hair removal session'),
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

  // ---------- color helpers ----------
  function colorHex(id) {
    const c = COLOR_PALETTE.find(c => c.id === id);
    return c ? c.hex : null;
  }
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function mixHex(hexA, hexB, amount) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
  }
  function tintHex(hex, amount = 0.85) { return mixHex(hex, '#ffffff', amount); }

  function buildColorSwatches(container, selectedId, onSelect) {
    container.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'color-swatch color-swatch-none';
    noneBtn.title = 'No color';
    noneBtn.classList.toggle('selected', !selectedId);
    noneBtn.addEventListener('click', () => onSelect(null));
    container.appendChild(noneBtn);
    COLOR_PALETTE.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch';
      btn.style.background = c.hex;
      btn.title = c.label;
      btn.classList.toggle('selected', selectedId === c.id);
      btn.addEventListener('click', () => onSelect(c.id));
      container.appendChild(btn);
    });
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
  function dayDiff(keyA, keyB) {
    return Math.round((fromDateKey(keyB) - fromDateKey(keyA)) / 86400000);
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

  // ---------- Canvas paste-import parser ----------
  const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const IMPORT_JUNK_LINE_RE = /^(\d+\s*(pts?|points?)$|not yet graded|graded|missing|submitted|late|excused|no submission|this assignment|available (until|from)|closed|due date|multiple due dates|\d+\s*\/\s*\d+$)/i;

  function parseDateFromLine(line, todayDate) {
    const monthRe = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    const re1 = new RegExp(monthRe + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?', 'i');
    const m1 = line.match(re1);
    if (m1) {
      const monthIdx = MONTH_ABBR.findIndex(mo => m1[1].toLowerCase().startsWith(mo));
      const day = parseInt(m1[2], 10);
      if (monthIdx >= 0 && day >= 1 && day <= 31) {
        const year = m1[3] ? parseInt(m1[3], 10) : todayDate.getFullYear();
        let candidate = new Date(year, monthIdx, day);
        if (!m1[3]) {
          const fourMonthsAgo = new Date(todayDate);
          fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
          if (candidate < fourMonthsAgo) candidate = new Date(year + 1, monthIdx, day);
        }
        return toDateKey(candidate);
      }
    }
    const re2 = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/;
    const m2 = line.match(re2);
    if (m2) {
      let year = parseInt(m2[3], 10); if (year < 100) year += 2000;
      const month = parseInt(m2[1], 10) - 1, day = parseInt(m2[2], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) return toDateKey(new Date(year, month, day));
    }
    const re3 = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    const m3 = line.match(re3);
    if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
    return null;
  }

  function isImportJunkLine(line) {
    if (!line) return true;
    if (IMPORT_JUNK_LINE_RE.test(line.trim())) return true;
    if (/^[-–—•*]+$/.test(line.trim())) return true;
    return false;
  }

  function parseCanvasText(text) {
    const rawLines = text.split(/\r?\n/).map(l => l.trim());
    const today = new Date();
    const results = [];

    const blocks = [];
    let current = [];
    rawLines.forEach(line => {
      if (line === '') {
        if (current.length) blocks.push(current);
        current = [];
      } else {
        current.push(line);
      }
    });
    if (current.length) blocks.push(current);

    const useBlocks = blocks.length > 1 && blocks.every(b => b.length <= 6);

    if (useBlocks) {
      blocks.forEach(block => {
        let dueDate = null, dateLineIdx = -1;
        block.forEach((line, i) => {
          if (dueDate) return;
          const d = parseDateFromLine(line, today);
          if (d) { dueDate = d; dateLineIdx = i; }
        });
        const candidateLines = block.filter((line, i) => i !== dateLineIdx && !isImportJunkLine(line));
        if (candidateLines.length === 0 && !dueDate) return;
        const title = candidateLines[0] || '';
        const course = candidateLines[1] || '';
        if (!title) return;
        results.push({ title, course, dueDate, needsAttention: !dueDate });
      });
    } else {
      let lastNonJunk = null, lastNonJunk2 = null;
      rawLines.forEach(line => {
        if (!line) return;
        const d = parseDateFromLine(line, today);
        if (d && lastNonJunk) {
          // Canvas's dense listings read Title, then Course, then Date — so of the
          // two most recent non-junk lines, the earlier one is the title.
          const title = lastNonJunk2 || lastNonJunk;
          const course = lastNonJunk2 ? lastNonJunk : '';
          results.push({ title, course, dueDate: d, needsAttention: false });
          lastNonJunk = null; lastNonJunk2 = null;
          return;
        }
        if (!isImportJunkLine(line)) {
          lastNonJunk2 = lastNonJunk;
          lastNonJunk = line;
        }
      });
    }

    const seen = new Set();
    return results.filter(r => {
      const key = `${r.title}|${r.dueDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
  function buildTimeOptions(selectEl, selectedValue) {
    selectEl.innerHTML = '';
    for (let m = 0; m < 24 * 60; m += 15) {
      const value = hhmmFromMinutes(m);
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = formatTimeShort(value);
      selectEl.appendChild(opt);
    }
    if (selectedValue) {
      selectEl.value = selectedValue;
      if (selectEl.value !== selectedValue) {
        // selectedValue isn't on the 15-min grid (e.g. a manually-set time) — add it so it isn't silently discarded.
        const opt = document.createElement('option');
        opt.value = selectedValue;
        opt.textContent = formatTimeShort(selectedValue);
        const options = Array.from(selectEl.options);
        const insertBefore = options.find(o => o.value > selectedValue);
        selectEl.insertBefore(opt, insertBefore || null);
        selectEl.value = selectedValue;
      }
    }
  }
  function humanizeMinutes(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  function relativeTimeLabel(nowMin, startMin, endMin) {
    if (nowMin < startMin) return `in ${humanizeMinutes(startMin - nowMin)}`;
    if (nowMin <= endMin) return 'happening now';
    return 'ended';
  }

  // ---------- storage ----------
  function migrateFromV2(parsedV2) {
    const events = [];
    if (parsedV2.scheduleBlocks && typeof parsedV2.scheduleBlocks === 'object') {
      Object.keys(parsedV2.scheduleBlocks).forEach(dateKey => {
        (parsedV2.scheduleBlocks[dateKey] || []).forEach(block => {
          let end = block.end;
          if (!end || end <= block.start) end = '23:59';
          events.push({
            id: block.id || uid(), title: block.label || 'Untitled', allDay: false, date: dateKey,
            start: block.start, end, location: '', description: '', color: null,
            reminder: { enabled: false, minutesBefore: 10 },
            repeat: { type: 'none', days: [], until: null }, exceptions: [],
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
      let legacyRaw = null;
      try { legacyRaw = localStorage.getItem('planner.v3') || localStorage.getItem('planner.v2'); } catch (e) { /* ignore */ }
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          events = Array.isArray(legacy.events) ? legacy.events : migrateFromV2(legacy);
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
            location: '', description: '', color: null, reminder: { enabled: false, minutesBefore: 10 },
            repeat: { type: 'none', days: [], until: null }, exceptions: [],
          }))
        : [];
    }
    events = events.map(ev => ({
      id: ev.id || uid(),
      title: ev.title || 'Untitled',
      allDay: !!ev.allDay,
      date: ev.date,
      start: ev.allDay ? null : (ev.start || '09:00'),
      end: ev.allDay ? null : (ev.end || '10:00'),
      location: ev.location || '',
      description: ev.description || '',
      color: ev.color || null,
      reminder: ev.reminder ? { enabled: !!ev.reminder.enabled, minutesBefore: ev.reminder.minutesBefore ?? 10 } : { enabled: false, minutesBefore: 10 },
      repeat: ev.repeat && ev.repeat.type ? { type: ev.repeat.type, days: ev.repeat.days || [], until: ev.repeat.until || null } : { type: 'none', days: [], until: null },
      exceptions: Array.isArray(ev.exceptions) ? ev.exceptions : [],
    }));

    const habits = (parsed && Array.isArray(parsed.habits)) ? parsed.habits : buildDefaultHabits();
    habits.forEach(h => {
      if (!h.frequency) h.frequency = { type: 'daily' };
      if (h.frequency.type === 'days' && !Array.isArray(h.frequency.days)) h.frequency.days = [new Date().getDay()];
      if (h.frequency.type === 'weekly' && !Array.isArray(h.frequency.days)) h.frequency.days = [];
      if (h.time === undefined) h.time = null;
      // A habit with no start date used to mean "always shown, including every
      // past day." Habits should only ever apply from a definite date forward,
      // so anything without one starts today rather than retroactively.
      if (!h.startDate) h.startDate = todayKey();
      if (!h.reminder) h.reminder = { enabled: false };
      // The default "Hair removal session" habit used to be a 1x/week target,
      // which showed a "0 of 1 this week" stat that doesn't fit how it's
      // actually tracked (checked off + counted per day).
      if (h.name === 'Hair removal session' && h.frequency.type === 'weekly') h.frequency = { type: 'daily' };
    });

    const assignments = (parsed && Array.isArray(parsed.assignments)) ? parsed.assignments : [];
    assignments.forEach(a => {
      if (a.link === undefined) a.link = '';
      if (a.attachment === undefined) a.attachment = null;
      if (a.color === undefined) a.color = null;
      if (!a.reminder) a.reminder = { enabled: false, daysBefore: 0 };
    });

    const todos = (parsed && Array.isArray(parsed.todos)) ? parsed.todos : [];
    todos.forEach(t => {
      if (t.date === undefined) t.date = null;
      if (t.color === undefined) t.color = null;
      if (t.done === undefined) t.done = false;
    });

    const habitLogs = (parsed && parsed.habitLogs) ? parsed.habitLogs : {};
    Object.keys(habitLogs).forEach(dateKey => {
      const day = habitLogs[dateKey];
      Object.keys(day).forEach(habitId => {
        const entry = day[habitId];
        if (entry === true) {
          day[habitId] = { done: true, count: 1, note: '' };
        } else if (entry && typeof entry === 'object') {
          if (entry.done === undefined) entry.done = true;
          if (entry.count === undefined) entry.count = 1;
          if (entry.note === undefined) entry.note = '';
        } else {
          delete day[habitId];
        }
      });
    });

    return {
      events,
      habits,
      habitLogs,
      assignments,
      todos,
      periodLogs: (parsed && parsed.periodLogs) ? parsed.periodLogs : {},
      scheduleView: (parsed && ['day', 'week', 'month', 'year'].includes(parsed.scheduleView)) ? parsed.scheduleView : 'day',
      assignmentsView: (parsed && parsed.assignmentsView) ? parsed.assignmentsView : 'list',
      firedReminders: (parsed && parsed.firedReminders) ? parsed.firedReminders : {},
    };
  }

  let state = loadState();
  let selectedDate = todayKey();
  let scheduleView = state.scheduleView;
  let editingHabitId = null;

  let toastTimer = null;
  function showToast(message, isDanger) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.toggle('danger', !!isDanger);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      showToast("Couldn't save — your device's storage is full. Try removing a large attachment.", true);
      return false;
    }
  }

  // ---------- habit logs ----------
  // Each entry is { done, count, note }. An entry is pruned from storage
  // entirely once done=false, count=0, and note is empty, so old boolean-only
  // days (pre-count/note) stay compact after migration.
  function getHabitEntry(habitId, dateKey) {
    return (state.habitLogs[dateKey] && state.habitLogs[dateKey][habitId]) || null;
  }
  function isDone(habitId, dateKey) {
    const e = getHabitEntry(habitId, dateKey);
    return !!(e && e.done);
  }
  function getHabitCount(habitId, dateKey) {
    const e = getHabitEntry(habitId, dateKey);
    return (e && e.count) || 0;
  }
  function getHabitNote(habitId, dateKey) {
    const e = getHabitEntry(habitId, dateKey);
    return (e && e.note) || '';
  }
  function pruneHabitEntryIfEmpty(dateKey, habitId) {
    const day = state.habitLogs[dateKey];
    if (!day) return;
    const e = day[habitId];
    if (e && !e.done && !e.count && !e.note) {
      delete day[habitId];
      if (Object.keys(day).length === 0) delete state.habitLogs[dateKey];
    }
  }
  function setDone(habitId, dateKey, val) {
    if (!state.habitLogs[dateKey]) state.habitLogs[dateKey] = {};
    const existing = state.habitLogs[dateKey][habitId] || { done: false, count: 0, note: '' };
    existing.done = !!val;
    existing.count = val ? (existing.count > 0 ? existing.count : 1) : 0;
    state.habitLogs[dateKey][habitId] = existing;
    pruneHabitEntryIfEmpty(dateKey, habitId);
    save();
  }
  function setHabitCount(habitId, dateKey, count) {
    count = Math.max(0, Math.min(99, Math.round(count) || 0));
    if (!state.habitLogs[dateKey]) state.habitLogs[dateKey] = {};
    const existing = state.habitLogs[dateKey][habitId] || { done: false, count: 0, note: '' };
    existing.count = count;
    existing.done = count > 0;
    state.habitLogs[dateKey][habitId] = existing;
    pruneHabitEntryIfEmpty(dateKey, habitId);
    save();
  }
  function setHabitNote(habitId, dateKey, note) {
    if (!state.habitLogs[dateKey]) state.habitLogs[dateKey] = {};
    const existing = state.habitLogs[dateKey][habitId] || { done: false, count: 0, note: '' };
    existing.note = note.trim();
    state.habitLogs[dateKey][habitId] = existing;
    pruneHabitEntryIfEmpty(dateKey, habitId);
    save();
  }
  function habitRestrictedDays(habit) {
    if (habit.frequency.type === 'days') return habit.frequency.days;
    if (habit.frequency.type === 'weekly' && habit.frequency.days && habit.frequency.days.length) return habit.frequency.days;
    return null;
  }
  function isHabitScheduledOnWeekday(habit, weekday) {
    const restricted = habitRestrictedDays(habit);
    return !restricted || restricted.includes(weekday);
  }
  function hasHabitStarted(habit, dateKey) {
    return !habit.startDate || habit.startDate <= dateKey;
  }
  function weeklyProgress(habit, dateKey) {
    const start = startOfWeek(dateKey);
    const restricted = habitRestrictedDays(habit);
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      if (restricted && !restricted.includes(fromDateKey(d).getDay())) continue;
      if (isDone(habit.id, d)) count++;
    }
    const target = habit.frequency.type === 'days' ? habit.frequency.days.length : habit.frequency.timesPerWeek;
    return { progress: count, target };
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
    if (r.type === 'monthly') {
      const targetDay = Math.min(anchor.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === targetDay;
    }
    if (r.type === 'yearly') {
      const targetDay = Math.min(anchor.getDate(), daysInMonth(d.getFullYear(), anchor.getMonth()));
      return d.getMonth() === anchor.getMonth() && d.getDate() === targetDay;
    }
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
        location: ev.location, description: ev.description, color: ev.color,
        reminder: { ...ev.reminder },
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
    todos: document.getElementById('panel-todos'),
    period: document.getElementById('panel-period'),
  };
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach(p => p.classList.remove('active'));
      panels[btn.dataset.tab].classList.add('active');
      if (btn.dataset.tab !== 'schedule') clearDayTick();
    });
  });

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // ================= NOTIFICATIONS =================
  const notifToggle = document.getElementById('notif-toggle');

  function updateNotifToggleUI() {
    if (!('Notification' in window)) { notifToggle.hidden = true; return; }
    notifToggle.classList.toggle('granted', Notification.permission === 'granted');
    notifToggle.classList.toggle('denied', Notification.permission === 'denied');
    notifToggle.title = Notification.permission === 'granted'
      ? 'Notifications on — reminders fire while this tab is open'
      : Notification.permission === 'denied'
        ? 'Notifications blocked — allow them in your browser settings'
        : 'Enable notifications';
  }
  notifToggle.addEventListener('click', () => {
    if (!('Notification' in window) || Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(updateNotifToggleUI);
    } else if (Notification.permission === 'granted') {
      try { new Notification('Notifications are on', { body: 'You\'ll get reminders for anything you\'ve flagged, as long as this tab stays open.' }); } catch (e) { /* ignore */ }
    }
  });
  updateNotifToggleUI();

  function fireNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body }); } catch (e) { /* ignore */ }
  }

  function markFiredAndMaybeNotify(key, triggerDate, title, body) {
    const now = new Date();
    if (state.firedReminders[key]) return;
    if (now < triggerDate) return;
    state.firedReminders[key] = true;
    if (now - triggerDate <= 10 * 60 * 1000) fireNotification(title, body);
    save();
  }

  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const tKey = todayKey();
    const tomorrowKey = addDays(tKey, 1);

    state.events.forEach(ev => {
      if (!ev.reminder || !ev.reminder.enabled || ev.allDay) return;
      [tKey, tomorrowKey].forEach(occDate => {
        if (!eventMatchesDate(ev, occDate)) return;
        const [h, m] = (ev.start || '09:00').split(':').map(Number);
        const startDate = fromDateKey(occDate);
        startDate.setHours(h, m, 0, 0);
        const triggerDate = new Date(startDate.getTime() - (ev.reminder.minutesBefore || 0) * 60000);
        markFiredAndMaybeNotify(`ev-${ev.id}-${occDate}`, triggerDate, ev.title, `${formatTimeShort(ev.start)}${ev.location ? ' · ' + ev.location : ''}`);
      });
    });

    const todayWeekday = fromDateKey(tKey).getDay();
    state.habits.forEach(h => {
      if (!h.time || !h.reminder || !h.reminder.enabled) return;
      if (isDone(h.id, tKey)) return;
      if (!isHabitScheduledOnWeekday(h, todayWeekday)) return;
      const [hh, mm] = h.time.split(':').map(Number);
      const triggerDate = fromDateKey(tKey);
      triggerDate.setHours(hh, mm, 0, 0);
      markFiredAndMaybeNotify(`habit-${h.id}-${tKey}`, triggerDate, h.name, 'Time for your habit');
    });

    state.assignments.forEach(a => {
      if (!a.reminder || !a.reminder.enabled || a.done) return;
      const triggerDate = fromDateKey(a.dueDate);
      triggerDate.setDate(triggerDate.getDate() - (a.reminder.daysBefore || 0));
      triggerDate.setHours(9, 0, 0, 0);
      markFiredAndMaybeNotify(`assign-${a.id}-${a.dueDate}`, triggerDate, a.title, `${a.course} · Due ${formatDueDate(a.dueDate)}`);
    });
  }
  setInterval(checkReminders, 30000);
  checkReminders();

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
  const evColorRow = document.getElementById('ev-color-row');
  const evRemindBlock = document.getElementById('ev-remind-block');
  const evRemindEnabled = document.getElementById('ev-remind-enabled');
  const evRemindLead = document.getElementById('ev-remind-lead');
  const evLocationInput = document.getElementById('ev-location');
  const evDescriptionInput = document.getElementById('ev-description');
  const evDeleteBtn = document.getElementById('ev-delete-btn');
  const evDeleteConfirm = document.getElementById('ev-delete-confirm');
  const evFooter = document.getElementById('ev-footer');
  const evCloseBtn = document.getElementById('ev-close-btn');
  const evCancelBtn = document.getElementById('ev-cancel-btn');

  const modalState = { mode: 'create', eventId: null, occurrenceDate: null, color: null };

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
  evAllDay.addEventListener('change', () => {
    evTimeRow.hidden = evAllDay.checked;
    evRemindBlock.hidden = evAllDay.checked;
  });
  evRemindEnabled.addEventListener('change', () => { evRemindLead.hidden = !evRemindEnabled.checked; });

  function resetDeleteConfirmState() {
    evDeleteConfirm.hidden = true;
    evFooter.hidden = false;
  }

  function openEventModal({ mode, event, date, start, end, occurrenceDate }) {
    modalState.mode = mode;
    modalState.eventId = event ? event.id : null;
    modalState.occurrenceDate = occurrenceDate || (event ? event.date : date);
    modalState.color = event ? event.color : null;

    evTitleInput.value = event ? event.title : '';
    const dKey = event ? (occurrenceDate || event.date) : date;
    evDateInput.value = dKey;
    evAllDay.checked = event ? event.allDay : false;
    evTimeRow.hidden = evAllDay.checked;
    evRemindBlock.hidden = evAllDay.checked;
    buildTimeOptions(evStartInput, event ? (event.start || '09:00') : (start || '09:00'));
    buildTimeOptions(evEndInput, event ? (event.end || '10:00') : (end || addMinutesToHHMM(start || '09:00', 60)));
    evLocationInput.value = event ? (event.location || '') : '';
    evDescriptionInput.value = event ? (event.description || '') : '';

    buildColorSwatches(evColorRow, modalState.color, onEvColorSelect);

    const rem = event ? event.reminder : { enabled: false, minutesBefore: 10 };
    evRemindEnabled.checked = !!(rem && rem.enabled);
    evRemindLead.hidden = !evRemindEnabled.checked;
    evRemindLead.value = String((rem && rem.minutesBefore) ?? 10);

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

  function onEvColorSelect(id) {
    modalState.color = id;
    buildColorSwatches(evColorRow, modalState.color, onEvColorSelect);
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
    const color = modalState.color;
    const reminder = allDay ? { enabled: false, minutesBefore: 10 } : { enabled: evRemindEnabled.checked, minutesBefore: Number(evRemindLead.value) || 0 };

    if (modalState.mode === 'create') {
      state.events.push({ id: uid(), title, allDay, date, start, end, location, description, color, reminder, repeat, exceptions: [] });
    } else {
      const ev = findEvent(modalState.eventId);
      if (ev) Object.assign(ev, { title, allDay, date, start, end, location, description, color, reminder, repeat });
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
    clearDayTick();
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
  const dayTasksEl = document.getElementById('day-tasks');
  let dayTickInterval = null;
  function clearDayTick() { if (dayTickInterval) { clearInterval(dayTickInterval); dayTickInterval = null; } }

  // Surfaces the selected day's to-dos inline in the Day view, so tasks and
  // timed events live in one place instead of only showing up in the To-Do tab.
  function renderDayTasks() {
    if (!dayTasksEl) return;
    const dayTodos = state.todos.filter(t => t.date === selectedDate);
    dayTasksEl.innerHTML = '';
    if (dayTodos.length === 0) { dayTasksEl.hidden = true; return; }
    dayTasksEl.hidden = false;
    const title = document.createElement('h3');
    title.className = 'day-tasks-title';
    title.textContent = 'Tasks';
    dayTasksEl.appendChild(title);
    const tKey = todayKey();
    sortDoneLast(dayTodos).forEach(t => dayTasksEl.appendChild(buildTodoRow(t, tKey, false)));
  }

  function buildNowMarker(nowMin) {
    const el = document.createElement('div');
    el.className = 'day-now-marker';
    el.innerHTML = `<span class="day-now-dot"></span><span>Now — ${formatTimeShort(hhmmFromMinutes(nowMin))}</span>`;
    return el;
  }

  function buildEarlierDivider() {
    const el = document.createElement('div');
    el.className = 'day-earlier-divider';
    el.textContent = 'Earlier today';
    return el;
  }

  function buildEventRow(ev, dayIsToday, nowMin) {
    const node = dayEventTpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.day-event-time').textContent = ev.allDay ? 'All day' : `${formatTimeShort(ev.start)}\n${formatTimeShort(ev.end)}`;
    node.querySelector('.day-event-title').textContent = ev.title;
    node.querySelector('.day-event-loc').textContent = ev.location || '';
    node.querySelector('.day-event-repeat').hidden = ev.repeat.type === 'none';
    const hex = colorHex(ev.color);
    if (hex) {
      node.style.borderLeftWidth = '4px';
      node.style.borderLeftColor = hex;
      node.querySelector('.day-event-time').style.color = hex;
    }
    if (dayIsToday && !ev.allDay) {
      const startMin = minutesFromHHMM(ev.start), endMin = minutesFromHHMM(ev.end);
      const rel = document.createElement('span');
      rel.className = 'day-event-relative';
      rel.textContent = relativeTimeLabel(nowMin, startMin, endMin);
      node.querySelector('.day-event-main').appendChild(rel);
    }
    node.addEventListener('click', () => openEditModal(ev.id, ev.occurrenceDate));
    return node;
  }

  function renderDayView() {
    renderDayTasks();
    dayEventsListEl.innerHTML = '';
    let events = getEventsForDate(selectedDate);
    const isToday = selectedDate === todayKey();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let endedEvents = [];
    if (isToday) {
      const active = [];
      events.forEach(ev => {
        if (!ev.allDay && minutesFromHHMM(ev.end) < nowMin) endedEvents.push(ev);
        else active.push(ev);
      });
      events = active;
    }

    if (events.length === 0 && endedEvents.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing scheduled — add an event below.';
      dayEventsListEl.appendChild(empty);
      if (isToday) dayEventsListEl.appendChild(buildNowMarker(nowMin));
    } else {
      let markerPlaced = false;
      events.forEach(ev => {
        if (isToday && !ev.allDay && !markerPlaced) {
          const startMin = minutesFromHHMM(ev.start);
          if (nowMin < startMin) {
            dayEventsListEl.appendChild(buildNowMarker(nowMin));
            markerPlaced = true;
          }
        }
        dayEventsListEl.appendChild(buildEventRow(ev, isToday, nowMin));
      });
      if (isToday && !markerPlaced) dayEventsListEl.appendChild(buildNowMarker(nowMin));

      if (endedEvents.length > 0) {
        dayEventsListEl.appendChild(buildEarlierDivider());
        endedEvents.forEach(ev => {
          const node = buildEventRow(ev, isToday, nowMin);
          node.classList.add('is-ended');
          dayEventsListEl.appendChild(node);
        });
      }
    }

    if (isToday) {
      clearDayTick();
      dayTickInterval = setInterval(renderDayView, 30000);
    }
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
        const hex = colorHex(ev.color);
        if (hex) { pill.style.background = tintHex(hex); pill.style.color = hex; }
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
        const trueHeight = ((item.endMin - item.startMin) / 60) * HOUR_PX;
        // Below ~32px there isn't room for a title + time line without clipping. Rather
        // than pad the box taller (which would visually run into the next back-to-back
        // event), drop the time line and only floor the height enough for one line.
        const isCompact = trueHeight < 32;
        const height = Math.max(trueHeight, isCompact ? 16 : 32);
        const widthPct = 100 / item.totalCols;
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.left = `${item.colIndex * widthPct}%`;
        block.style.width = `calc(${widthPct}% - 2px)`;
        block.classList.toggle('is-compact', isCompact);
        const hex = colorHex(item.ev.color);
        if (hex) block.style.background = hex;
        const timeSpan = isCompact ? '' : `<span class="we-time">${formatTimeShort(item.ev.start)} – ${formatTimeShort(item.ev.end)}</span>`;
        block.innerHTML = `<span class="we-title">${escapeHtml(item.ev.title)}</span>${timeSpan}`;
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
  const MONTH_PILL_LIMIT = 2;

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
        const hex = colorHex(ev.color);
        if (hex) { pill.style.background = tintHex(hex); pill.style.borderLeft = `3px solid ${hex}`; }
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
  const habitFreqWeeklyDaysWrap = document.getElementById('habit-freq-weekly-days-wrap');
  const habitFreqWeeklyDaysChips = document.getElementById('habit-freq-weekly-days-chips');
  const habitTimeInput = document.getElementById('habit-time-input');
  const habitRemindWrap = document.getElementById('habit-remind-wrap');
  const habitRemindEnabled = document.getElementById('habit-remind-enabled');
  const habitStartDateInput = document.getElementById('habit-start-date');
  habitStartDateInput.value = todayKey();

  function updateHabitFormFreqUI() {
    const type = habitFreqType.value;
    habitFreqCountWrap.hidden = type !== 'weekly';
    habitFreqDaysWrap.hidden = type !== 'days';
    habitFreqWeeklyDaysWrap.hidden = type !== 'weekly';
    if (type === 'days' && !habitFreqDaysWrap.children.length) {
      buildWeekdayChips(habitFreqDaysWrap, [new Date().getDay()], 1);
    }
    if (type === 'weekly' && !habitFreqWeeklyDaysChips.children.length) {
      buildWeekdayChips(habitFreqWeeklyDaysChips, [], 0);
    }
  }
  habitFreqType.addEventListener('change', updateHabitFormFreqUI);
  habitTimeInput.addEventListener('input', () => {
    habitRemindWrap.hidden = !habitTimeInput.value;
    if (!habitTimeInput.value) habitRemindEnabled.checked = false;
  });

  function frequencyFromSelectAndInputs(typeVal, countInput, daysWrap, weeklyDaysChips) {
    if (typeVal === 'weekly') return { type: 'weekly', timesPerWeek: clamp(parseInt(countInput.value, 10) || 1, 1, 7), days: getSelectedChipDays(weeklyDaysChips) };
    if (typeVal === 'days') return { type: 'days', days: getSelectedChipDays(daysWrap) };
    return { type: 'daily' };
  }

  habitForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = habitNameInput.value.trim();
    if (!name) return;
    const frequency = frequencyFromSelectAndInputs(habitFreqType.value, habitFreqCount, habitFreqDaysWrap, habitFreqWeeklyDaysChips);
    const time = habitTimeInput.value || null;
    const reminder = { enabled: !!time && habitRemindEnabled.checked };
    const startDate = habitStartDateInput.value || null;
    state.habits.push({ id: uid(), name, frequency, time, reminder, startDate });
    save();
    habitForm.reset();
    habitFreqCountWrap.hidden = true;
    habitFreqDaysWrap.hidden = true;
    habitFreqDaysWrap.innerHTML = '';
    habitFreqWeeklyDaysWrap.hidden = true;
    habitFreqWeeklyDaysChips.innerHTML = '';
    habitRemindWrap.hidden = true;
    habitStartDateInput.value = todayKey();
    renderHabits();
    habitNameInput.focus();
  });

  document.getElementById('date-prev').addEventListener('click', () => setSelectedDate(addDays(selectedDate, -1)));
  document.getElementById('date-next').addEventListener('click', () => setSelectedDate(addDays(selectedDate, 1)));
  habitsTodayBtn.addEventListener('click', () => setSelectedDate(todayKey()));

  function freqBadgeText(freq) {
    if (freq.type === 'daily') return 'Daily';
    if (freq.type === 'weekly') {
      const base = `${freq.timesPerWeek}× / week`;
      if (freq.days && freq.days.length) return `${base} · ${freq.days.slice().sort().map(d => WEEKDAY_SHORT[d]).join(', ')}`;
      return base;
    }
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

    const viewedWeekday = fromDateKey(selectedDate).getDay();
    // Habits not scheduled for this weekday, or not yet started as of the viewed
    // day, are omitted entirely — except one currently being edited (so an
    // in-progress edit never vanishes mid-change).
    const visibleHabits = state.habits.filter(habit =>
      (isHabitScheduledOnWeekday(habit, viewedWeekday) && hasHabitStarted(habit, selectedDate)) || editingHabitId === habit.id
    );
    if (visibleHabits.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = state.habits.some(h => h.startDate && h.startDate > selectedDate)
        ? 'Nothing scheduled for this day — some habits start later.'
        : 'Nothing scheduled for this day.';
      habitsListEl.appendChild(empty);
      return;
    }

    const entries = visibleHabits.map(habit => ({
      habit,
      doneToday: isHabitScheduledOnWeekday(habit, viewedWeekday) && hasHabitStarted(habit, selectedDate) && isDone(habit.id, selectedDate),
    }));
    entries.sort((a, b) => (a.doneToday === b.doneToday) ? 0 : (a.doneToday ? 1 : -1));

    entries.forEach(({ habit, doneToday }) => {
      const node = habitCardTpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = habit.id;
      const editing = editingHabitId === habit.id;
      node.classList.toggle('editing', editing);
      node.classList.toggle('completed', doneToday);

      const startedByViewedDate = hasHabitStarted(habit, selectedDate);
      const isScheduledToday = isHabitScheduledOnWeekday(habit, viewedWeekday) && startedByViewedDate;
      node.classList.toggle('not-scheduled', !isScheduledToday);
      const notScheduledLabel = node.querySelector('.habit-not-scheduled');
      if (notScheduledLabel) notScheduledLabel.textContent = !startedByViewedDate ? `Starts ${formatDueDate(habit.startDate)}` : 'Not scheduled today';

      node.querySelector('.habit-name').textContent = habit.name;
      node.querySelector('.habit-freq-badge').textContent = freqBadgeText(habit.frequency);
      node.querySelector('.habit-time-badge').textContent = habit.time ? formatTimeShort(habit.time) : '';
      const startBadge = node.querySelector('.habit-start-badge');
      startBadge.textContent = habit.startDate ? `From ${formatDueDate(habit.startDate)}` : '';

      const checkbox = node.querySelector('.habit-checkbox');
      checkbox.checked = doneToday;
      checkbox.disabled = !isScheduledToday;
      checkbox.addEventListener('change', e => {
        setDone(habit.id, selectedDate, e.target.checked);
        renderHabits();
      });

      const countInput = node.querySelector('.habit-count-input');
      const count = getHabitCount(habit.id, selectedDate);
      countInput.value = count > 0 ? count : 1;
      countInput.hidden = !doneToday;
      countInput.addEventListener('change', () => {
        setHabitCount(habit.id, selectedDate, parseInt(countInput.value, 10) || 1);
        renderHabits();
      });

      const note = getHabitNote(habit.id, selectedDate);
      const noteToggle = node.querySelector('.habit-note-toggle');
      const noteInput = node.querySelector('.habit-note-input');
      noteToggle.textContent = note ? 'Note' : '+ Note';
      noteToggle.classList.toggle('has-note', !!note);
      noteInput.value = note;
      noteInput.hidden = !note;
      noteToggle.addEventListener('click', () => {
        noteInput.hidden = !noteInput.hidden;
        if (!noteInput.hidden) noteInput.focus();
      });
      noteInput.addEventListener('blur', () => {
        setHabitNote(habit.id, selectedDate, noteInput.value);
        renderHabits();
      });

      updateHabitStat(habit, node);

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
        const weeklyDaysWrap = node.querySelector('.habit-edit-freq-weekly-days-wrap');
        const weeklyDaysChips = node.querySelector('.habit-edit-freq-weekly-days-chips');
        const timeInput = node.querySelector('.habit-edit-time');
        const remindWrap = node.querySelector('.habit-edit-remind-wrap');
        const remindEnabled = node.querySelector('.habit-edit-remind-enabled');
        const startDateInput = node.querySelector('.habit-edit-start-date');

        countInput.value = habit.frequency.type === 'weekly' ? habit.frequency.timesPerWeek : 1;
        countWrap.hidden = habit.frequency.type !== 'weekly';
        daysWrap.hidden = habit.frequency.type !== 'days';
        weeklyDaysWrap.hidden = habit.frequency.type !== 'weekly';
        buildWeekdayChips(daysWrap, habit.frequency.type === 'days' ? habit.frequency.days : [viewedWeekday], 1);
        buildWeekdayChips(weeklyDaysChips, habit.frequency.type === 'weekly' ? (habit.frequency.days || []) : [], 0);

        startDateInput.value = habit.startDate || '';
        timeInput.value = habit.time || '';
        remindWrap.hidden = !habit.time;
        remindEnabled.checked = !!(habit.reminder && habit.reminder.enabled);
        timeInput.addEventListener('input', () => {
          remindWrap.hidden = !timeInput.value;
          if (!timeInput.value) remindEnabled.checked = false;
        });

        freqTypeSel.addEventListener('change', () => {
          countWrap.hidden = freqTypeSel.value !== 'weekly';
          daysWrap.hidden = freqTypeSel.value !== 'days';
          weeklyDaysWrap.hidden = freqTypeSel.value !== 'weekly';
          if (freqTypeSel.value === 'days' && !daysWrap.children.length) buildWeekdayChips(daysWrap, [viewedWeekday], 1);
          if (freqTypeSel.value === 'weekly' && !weeklyDaysChips.children.length) buildWeekdayChips(weeklyDaysChips, [], 0);
        });

        node.querySelector('.habit-save-btn').addEventListener('click', () => {
          const newName = nameInput.value.trim();
          if (!newName) return;
          habit.name = newName;
          habit.frequency = frequencyFromSelectAndInputs(freqTypeSel.value, countInput, daysWrap, weeklyDaysChips);
          habit.time = timeInput.value || null;
          habit.reminder = { enabled: !!habit.time && remindEnabled.checked };
          habit.startDate = startDateInput.value || null;
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
  const assignColorRow = document.getElementById('assign-color-row');
  const assignRemindEnabled = document.getElementById('assign-remind-enabled');
  const assignRemindLead = document.getElementById('assign-remind-lead');
  const assignmentsListEl = document.getElementById('assignments-list');
  const assignmentsGroupedEl = document.getElementById('assignments-grouped');
  const assignRowTpl = document.getElementById('tpl-assignment-row');
  const assignGroupTpl = document.getElementById('tpl-assignment-group');

  let pendingAttachment = null;
  let pendingAssignColor = null;

  function refreshAssignColorRow() {
    buildColorSwatches(assignColorRow, pendingAssignColor, id => { pendingAssignColor = id; refreshAssignColorRow(); });
  }
  refreshAssignColorRow();

  assignRemindEnabled.addEventListener('change', () => { assignRemindLead.hidden = !assignRemindEnabled.checked; });

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
      window.open(a.attachment.dataUrl, '_blank', 'noopener');
    } else if (a.link) {
      window.open(a.link, '_blank', 'noopener');
    }
  }

  let openColorPopoverId = null;

  function closeColorPopovers() {
    document.querySelectorAll('.assignment-color-popover').forEach(p => { p.hidden = true; p.innerHTML = ''; });
    openColorPopoverId = null;
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('.assignment-color-dot') && !e.target.closest('.assignment-color-popover')) closeColorPopovers();
  });

  function buildAssignmentRow(a, tKey) {
    const node = assignRowTpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = a.id;
    if (a.done) node.classList.add('done');
    if (!a.done && a.dueDate < tKey) node.classList.add('overdue');
    if (!a.done && a.dueDate === tKey) node.classList.add('due-today');

    const hex = colorHex(a.color);
    const colorBar = node.querySelector('.assignment-color-bar');
    if (hex) colorBar.style.background = hex;
    const colorDot = node.querySelector('.assignment-color-dot');
    if (hex) { colorDot.style.background = hex; colorDot.classList.add('has-color'); }

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

    const popover = node.querySelector('.assignment-color-popover');
    colorDot.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = openColorPopoverId === a.id;
      closeColorPopovers();
      if (isOpen) return;
      buildColorSwatches(popover, a.color, id => {
        a.color = id;
        save();
        closeColorPopovers();
        renderAssignments();
      });
      popover.hidden = false;
      openColorPopoverId = a.id;
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

    if (!isStatusView) {
      const listSorted = [...state.assignments].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      assignmentsListEl.innerHTML = '';
      listSorted.forEach(a => assignmentsListEl.appendChild(buildAssignmentRow(a, tKey)));
      return;
    }

    const sorted = [...state.assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
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
    const reminder = { enabled: assignRemindEnabled.checked, daysBefore: Number(assignRemindLead.value) || 0 };
    state.assignments.push({ id: uid(), title, course, dueDate, done: false, link, attachment: pendingAttachment, color: pendingAssignColor, reminder });
    save();
    assignForm.reset();
    pendingAttachment = null;
    pendingAssignColor = null;
    refreshAssignColorRow();
    assignFileName.textContent = '';
    assignFileClear.hidden = true;
    assignRemindLead.hidden = true;
    renderAssignments();
    assignTitleInput.focus();
  });

  // ---- Import from Canvas ----
  const importOverlay = document.getElementById('import-modal-overlay');
  const importCloseBtn = document.getElementById('import-close-btn');
  const importCancelBtn = document.getElementById('import-cancel-btn');
  const importCancelBtn2 = document.getElementById('import-cancel-btn-2');
  const importParseBtn = document.getElementById('import-parse-btn');
  const importBackBtn = document.getElementById('import-back-btn');
  const importCommitBtn = document.getElementById('import-commit-btn');
  const importPasteArea = document.getElementById('import-paste-area');
  const importStepPaste = document.getElementById('import-step-paste');
  const importStepReview = document.getElementById('import-step-review');
  const importReviewList = document.getElementById('import-review-list');
  const importReviewSummary = document.getElementById('import-review-summary');
  const importRowTpl = document.getElementById('tpl-import-row');

  function closeImportModal() {
    importOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  document.getElementById('import-canvas-btn').addEventListener('click', () => {
    importPasteArea.value = '';
    importStepPaste.hidden = false;
    importStepReview.hidden = true;
    importOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => importPasteArea.focus(), 30);
  });
  importCloseBtn.addEventListener('click', closeImportModal);
  importCancelBtn.addEventListener('click', closeImportModal);
  importCancelBtn2.addEventListener('click', closeImportModal);
  importOverlay.addEventListener('click', e => { if (e.target === importOverlay) closeImportModal(); });

  importParseBtn.addEventListener('click', () => {
    const parsed = parseCanvasText(importPasteArea.value);
    if (parsed.length === 0) {
      alert("Couldn't find any assignments in that text. Try pasting a bit more — a title, course, and due date line for each assignment works best.");
      return;
    }
    importReviewSummary.textContent = `Found ${parsed.length} possible assignment${parsed.length === 1 ? '' : 's'}. Review and edit before importing — anything unchecked won't be added.`;
    importReviewList.innerHTML = '';
    parsed.forEach(item => {
      const node = importRowTpl.content.firstElementChild.cloneNode(true);
      node.classList.toggle('needs-attention', item.needsAttention);
      node.querySelector('.import-row-title').value = item.title;
      node.querySelector('.import-row-course').value = item.course;
      node.querySelector('.import-row-due').value = item.dueDate || '';
      node.querySelector('.import-row-flag').hidden = !item.needsAttention;
      importReviewList.appendChild(node);
    });
    importStepPaste.hidden = true;
    importStepReview.hidden = false;
  });

  importBackBtn.addEventListener('click', () => {
    importStepPaste.hidden = false;
    importStepReview.hidden = true;
  });

  importCommitBtn.addEventListener('click', () => {
    const rows = Array.from(importReviewList.querySelectorAll('.import-row'));
    let count = 0;
    rows.forEach(row => {
      if (!row.querySelector('.import-row-check').checked) return;
      const title = row.querySelector('.import-row-title').value.trim();
      const course = row.querySelector('.import-row-course').value.trim();
      const dueDate = row.querySelector('.import-row-due').value;
      if (!title || !dueDate) return;
      state.assignments.push({ id: uid(), title, course: course || 'Imported', dueDate, done: false, link: '', attachment: null, color: null, reminder: { enabled: false, daysBefore: 0 } });
      count++;
    });
    save();
    renderAssignments();
    closeImportModal();
    showToast(count > 0 ? `Imported ${count} assignment${count === 1 ? '' : 's'}.` : 'Nothing imported — check the boxes for rows to include.');
  });

  // ================= TO-DO =================
  const todoForm = document.getElementById('todo-form');
  const todoTextInput = document.getElementById('todo-text');
  const todoDateInput = document.getElementById('todo-date');
  const todoChips = document.querySelectorAll('#todo-date-chips .todo-chip');
  const todoColorRow = document.getElementById('todo-color-row');
  const todoGroupsEl = document.getElementById('todo-groups');
  const todoRowTpl = document.getElementById('tpl-todo-row');
  const todoGroupTpl = document.getElementById('tpl-todo-group');

  let pendingTodoColor = null;

  function refreshTodoColorRow() {
    buildColorSwatches(todoColorRow, pendingTodoColor, id => { pendingTodoColor = id; refreshTodoColorRow(); });
  }
  refreshTodoColorRow();

  function syncTodoChipsToDate() {
    const val = todoDateInput.value;
    const tKey = todayKey();
    const tomorrowKey = addDays(tKey, 1);
    todoChips.forEach(chip => {
      const q = chip.dataset.quick;
      const match = (q === 'today' && val === tKey) || (q === 'tomorrow' && val === tomorrowKey) || (q === 'someday' && val === '');
      chip.classList.toggle('active', match);
    });
  }
  todoChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.quick;
      if (q === 'today') todoDateInput.value = todayKey();
      else if (q === 'tomorrow') todoDateInput.value = addDays(todayKey(), 1);
      else todoDateInput.value = '';
      syncTodoChipsToDate();
    });
  });
  todoDateInput.addEventListener('change', syncTodoChipsToDate);
  todoDateInput.value = todayKey();
  syncTodoChipsToDate();

  function buildTodoRow(t, tKey, showDate) {
    const node = todoRowTpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = t.id;
    if (t.done) node.classList.add('done');
    if (!t.done && t.date && t.date < tKey) node.classList.add('overdue');

    const hex = colorHex(t.color);
    const colorBar = node.querySelector('.assignment-color-bar');
    if (hex) colorBar.style.background = hex;
    const colorDot = node.querySelector('.assignment-color-dot');
    if (hex) { colorDot.style.background = hex; colorDot.classList.add('has-color'); }

    node.querySelector('.assignment-title').textContent = t.text;
    const metaEl = node.querySelector('.assignment-meta');
    if (showDate && t.date) { metaEl.textContent = formatDueDate(t.date); metaEl.hidden = false; } else { metaEl.hidden = true; }

    const checkbox = node.querySelector('.todo-checkbox');
    checkbox.checked = !!t.done;
    checkbox.addEventListener('change', e => {
      t.done = e.target.checked;
      save();
      renderTodos();
    });

    const popover = node.querySelector('.assignment-color-popover');
    colorDot.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = openColorPopoverId === t.id;
      closeColorPopovers();
      if (isOpen) return;
      buildColorSwatches(popover, t.color, id => {
        t.color = id;
        save();
        closeColorPopovers();
        renderTodos();
      });
      popover.hidden = false;
      openColorPopoverId = t.id;
    });

    node.querySelector('.todo-delete').addEventListener('click', () => {
      state.todos = state.todos.filter(x => x.id !== t.id);
      save();
      renderTodos();
    });

    return node;
  }

  function sortDoneLast(list) {
    return [...list].sort((a, b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));
  }

  function renderTodos() {
    renderDayTasks();
    todoGroupsEl.innerHTML = '';
    if (state.todos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing on your list — add a task above.';
      todoGroupsEl.appendChild(empty);
      return;
    }

    const tKey = todayKey();
    const tomorrowKey = addDays(tKey, 1);

    const overdue = state.todos.filter(t => t.date && t.date < tKey).sort((a, b) => a.date.localeCompare(b.date));
    const today = state.todos.filter(t => t.date === tKey);
    const tomorrow = state.todos.filter(t => t.date === tomorrowKey);
    const someday = state.todos.filter(t => !t.date);
    const laterDates = [...new Set(state.todos.filter(t => t.date && t.date > tomorrowKey).map(t => t.date))].sort();

    const groups = [
      { title: 'Overdue', items: overdue, cls: 'is-overdue', showDate: true },
      { title: 'Today', items: today, cls: '', showDate: false },
      { title: 'Tomorrow', items: tomorrow, cls: '', showDate: false },
      ...laterDates.map(d => ({ title: formatDayLabel(d), items: state.todos.filter(t => t.date === d), cls: '', showDate: false })),
      { title: 'Someday', items: someday, cls: '', showDate: false },
    ];

    groups.forEach(group => {
      if (group.items.length === 0) return;
      const node = todoGroupTpl.content.firstElementChild.cloneNode(true);
      if (group.cls) node.classList.add(group.cls);
      node.querySelector('.assignment-group-title').textContent = group.title;
      const list = node.querySelector('.assignment-group-list');
      sortDoneLast(group.items).forEach(t => list.appendChild(buildTodoRow(t, tKey, group.showDate)));
      todoGroupsEl.appendChild(node);
    });
  }

  todoForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = todoTextInput.value.trim();
    if (!text) return;
    const date = todoDateInput.value || null;
    state.todos.push({ id: uid(), text, date, done: false, color: pendingTodoColor });
    save();
    todoForm.reset();
    todoDateInput.value = todayKey();
    syncTodoChipsToDate();
    pendingTodoColor = null;
    refreshTodoColorRow();
    renderTodos();
    todoTextInput.focus();
  });

  // ================= PERIOD =================
  const periodSummaryEl = document.getElementById('period-summary');
  const periodMonthLabel = document.getElementById('period-month-label');
  const periodTodayBtn = document.getElementById('period-today-btn');
  const periodWeekdayRowEl = document.getElementById('period-weekday-row');
  const periodGridEl = document.getElementById('period-grid');
  const periodHistoryEl = document.getElementById('period-history');

  let periodViewedMonth = todayKey();

  function isPeriodDay(dateKey) { return !!state.periodLogs[dateKey]; }
  function togglePeriodDay(dateKey) {
    if (state.periodLogs[dateKey]) delete state.periodLogs[dateKey];
    else state.periodLogs[dateKey] = true;
    save();
    renderPeriod();
  }

  function derivePeriods() {
    const days = Object.keys(state.periodLogs).sort();
    const periods = [];
    let current = null;
    days.forEach(day => {
      if (current && addDays(current.end, 1) === day) {
        current.end = day;
      } else {
        if (current) periods.push(current);
        current = { start: day, end: day };
      }
    });
    if (current) periods.push(current);
    return periods;
  }

  const PREDICTED_CYCLES_AHEAD = 12;

  function computePeriodStats() {
    const periods = derivePeriods();
    if (periods.length === 0) {
      return { periods, avgCycleLength: null, avgPeriodLength: null, currentCycleDay: null, predictedNext: null, predictedWindows: [] };
    }
    const avgPeriodLength = Math.round(
      periods.reduce((sum, p) => sum + (dayDiff(p.start, p.end) + 1), 0) / periods.length
    );
    let avgCycleLength = null;
    if (periods.length >= 2) {
      const gaps = [];
      for (let i = 1; i < periods.length; i++) gaps.push(dayDiff(periods[i - 1].start, periods[i].start));
      avgCycleLength = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }
    const last = periods[periods.length - 1];
    const currentCycleDay = dayDiff(last.start, todayKey()) + 1;

    // Project several cycles ahead (not just the next one) so predictions still
    // show up no matter how far into the future the calendar is navigated.
    const predictedWindows = [];
    if (avgCycleLength) {
      for (let i = 1; i <= PREDICTED_CYCLES_AHEAD; i++) {
        const start = addDays(last.start, avgCycleLength * i);
        predictedWindows.push({ start, end: addDays(start, avgPeriodLength - 1) });
      }
    }
    const predictedNext = predictedWindows.length ? predictedWindows[0].start : null;
    return { periods, avgCycleLength, avgPeriodLength, currentCycleDay, predictedNext, predictedWindows, lastStart: last.start };
  }

  function renderPeriodSummary(stats) {
    periodSummaryEl.innerHTML = '';
    if (stats.periods.length === 0) {
      periodSummaryEl.classList.add('is-empty');
      const stat = document.createElement('div');
      stat.className = 'period-stat';
      stat.textContent = 'Tap a day below to log the start of your period — your cycle stats will build up from there.';
      periodSummaryEl.appendChild(stat);
      return;
    }
    periodSummaryEl.classList.remove('is-empty');

    const cards = [];
    cards.push({ value: `Day ${stats.currentCycleDay}`, label: 'Current cycle day' });
    cards.push({ value: `${stats.avgPeriodLength} day${stats.avgPeriodLength === 1 ? '' : 's'}`, label: 'Avg. period length' });
    if (stats.avgCycleLength) {
      cards.push({ value: `${stats.avgCycleLength} days`, label: 'Avg. cycle length' });
      const daysUntil = dayDiff(todayKey(), stats.predictedNext);
      const sub = daysUntil === 0 ? 'Today' : daysUntil > 0 ? `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} late`;
      cards.push({ value: formatDueDate(stats.predictedNext), label: 'Predicted next period', sub });
    } else {
      cards.push({ value: '—', label: 'Log one more period to see predictions' });
    }

    cards.forEach(c => {
      const stat = document.createElement('div');
      stat.className = 'period-stat';
      const val = document.createElement('span');
      val.className = 'period-stat-value';
      val.textContent = c.value;
      const label = document.createElement('span');
      label.className = 'period-stat-label';
      label.textContent = c.label;
      stat.appendChild(val);
      stat.appendChild(label);
      if (c.sub) {
        const sub = document.createElement('span');
        sub.className = 'period-stat-sub';
        sub.textContent = c.sub;
        stat.appendChild(sub);
      }
      periodSummaryEl.appendChild(stat);
    });
  }

  function renderPeriodWeekdayRow() {
    periodWeekdayRowEl.innerHTML = '';
    WEEKDAY_LETTERS.forEach(l => {
      const s = document.createElement('span');
      s.textContent = l;
      periodWeekdayRowEl.appendChild(s);
    });
  }

  function renderPeriodGrid(stats) {
    periodGridEl.innerHTML = '';
    const d = fromDateKey(periodViewedMonth);
    const year = d.getFullYear(), monthIdx = d.getMonth();
    const monthStartKey = toDateKey(new Date(year, monthIdx, 1));
    const gridStartKey = startOfWeek(monthStartKey);
    const tKey = todayKey();

    const predictedDays = new Set();
    stats.predictedWindows.forEach(w => {
      for (let i = 0; i < stats.avgPeriodLength; i++) predictedDays.add(addDays(w.start, i));
    });

    for (let i = 0; i < 42; i++) {
      const cellKey = addDays(gridStartKey, i);
      const cellDate = fromDateKey(cellKey);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'period-cell';
      cell.textContent = cellDate.getDate();
      cell.classList.toggle('outside-month', cellDate.getMonth() !== monthIdx);
      cell.classList.toggle('is-today', cellKey === tKey);
      cell.classList.toggle('is-period', isPeriodDay(cellKey));
      cell.classList.toggle('is-predicted', !isPeriodDay(cellKey) && predictedDays.has(cellKey));
      cell.addEventListener('click', () => togglePeriodDay(cellKey));
      periodGridEl.appendChild(cell);
    }
  }

  function renderPeriodHistory(stats) {
    periodHistoryEl.innerHTML = '';
    if (stats.periods.length === 0) return;
    const title = document.createElement('h3');
    title.className = 'period-history-title';
    title.textContent = 'History';
    periodHistoryEl.appendChild(title);
    [...stats.periods].reverse().forEach(p => {
      const row = document.createElement('div');
      row.className = 'period-history-row';
      const range = document.createElement('span');
      const len = dayDiff(p.start, p.end) + 1;
      range.textContent = p.start === p.end ? formatDueDate(p.start) : `${formatDueDate(p.start)} – ${formatDueDate(p.end)}`;
      const lenEl = document.createElement('span');
      lenEl.textContent = `${len} day${len === 1 ? '' : 's'}`;
      row.appendChild(range);
      row.appendChild(lenEl);
      periodHistoryEl.appendChild(row);
    });
  }

  function renderPeriod() {
    periodMonthLabel.textContent = formatMonthLabel(periodViewedMonth);
    periodTodayBtn.hidden = startOfMonthKey(periodViewedMonth) === startOfMonthKey(todayKey());
    const stats = computePeriodStats();
    renderPeriodSummary(stats);
    renderPeriodGrid(stats);
    renderPeriodHistory(stats);
  }
  function startOfMonthKey(dateKey) {
    const d = fromDateKey(dateKey);
    return toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  document.getElementById('period-prev').addEventListener('click', () => {
    periodViewedMonth = addMonths(periodViewedMonth, -1);
    renderPeriod();
  });
  document.getElementById('period-next').addEventListener('click', () => {
    periodViewedMonth = addMonths(periodViewedMonth, 1);
    renderPeriod();
  });
  periodTodayBtn.addEventListener('click', () => {
    periodViewedMonth = todayKey();
    renderPeriod();
  });

  renderPeriodWeekdayRow();

  // ---------- init ----------
  renderSchedule();
  renderHabits();
  renderAssignments();
  renderTodos();
  renderPeriod();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable, app still works online */ });
    });
  }
})();
