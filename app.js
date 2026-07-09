(() => {
  'use strict';

  const STORAGE_KEY = 'planner.v2';
  const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
    { start: '22:00', end: '05:00', label: 'Sleep' },
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
  function startOfMonth(dateKey) {
    const dt = fromDateKey(dateKey);
    return toDateKey(new Date(dt.getFullYear(), dt.getMonth(), 1));
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
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
  function formatDueDate(key) {
    return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ---------- storage ----------
  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    const isFirstRun = !parsed;
    const scheduleBlocks = (parsed && parsed.scheduleBlocks && typeof parsed.scheduleBlocks === 'object')
      ? parsed.scheduleBlocks
      : (isFirstRun ? { [todayKey()]: DEFAULT_DAY_BLOCKS.map(b => ({ id: uid(), ...b })) } : {});
    return {
      scheduleBlocks,
      habits: (parsed && Array.isArray(parsed.habits)) ? parsed.habits : buildDefaultHabits(),
      habitLogs: (parsed && parsed.habitLogs) ? parsed.habitLogs : {},
      assignments: (parsed && Array.isArray(parsed.assignments)) ? parsed.assignments : [],
      scheduleView: (parsed && parsed.scheduleView) ? parsed.scheduleView : 'day',
    };
  }

  let state = loadState();
  let selectedDate = todayKey();
  let scheduleView = state.scheduleView;
  let editingHabitId = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/unavailable */ }
  }

  function isDone(habitId, dateKey) {
    return !!(state.habitLogs[dateKey] && state.habitLogs[dateKey][habitId]);
  }
  function setDone(habitId, dateKey, val) {
    if (!state.habitLogs[dateKey]) state.habitLogs[dateKey] = {};
    if (val) state.habitLogs[dateKey][habitId] = true;
    else delete state.habitLogs[dateKey][habitId];
    save();
  }
  function computeStreak(habitId) {
    let cursor = todayKey();
    if (!isDone(habitId, cursor)) cursor = addDays(cursor, -1);
    let count = 0;
    while (isDone(habitId, cursor)) {
      count++;
      cursor = addDays(cursor, -1);
    }
    return count;
  }
  function weeklyProgress(habitId, dateKey) {
    const start = startOfWeek(dateKey);
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (isDone(habitId, addDays(start, i))) count++;
    }
    return count;
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

  // ================= SCHEDULE =================
  const scheduleRowTpl = document.getElementById('tpl-schedule-row');
  const weekDayTpl = document.getElementById('tpl-week-day');
  const monthCellTpl = document.getElementById('tpl-month-cell');
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
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    renderSchedule();
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
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
  const scheduleListEl = document.getElementById('schedule-list');

  function renderDayView() {
    scheduleListEl.innerHTML = '';
    const blocks = state.scheduleBlocks[selectedDate] || [];
    if (blocks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No blocks yet for this day — add one below.';
      scheduleListEl.appendChild(empty);
      return;
    }
    const order = blocks.map((b, i) => i).sort((a, b) => blocks[a].start.localeCompare(blocks[b].start));
    order.forEach(idx => {
      const block = blocks[idx];
      const node = scheduleRowTpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = block.id;
      node.querySelector('.sr-start').value = block.start;
      node.querySelector('.sr-end').value = block.end;
      node.querySelector('.sr-label').value = block.label;

      node.querySelector('.sr-start').addEventListener('change', e => {
        block.start = e.target.value;
        save();
        renderDayView();
      });
      node.querySelector('.sr-end').addEventListener('change', e => {
        block.end = e.target.value;
        save();
      });
      node.querySelector('.sr-label').addEventListener('input', e => {
        block.label = e.target.value;
        save();
      });
      node.querySelector('.sr-delete').addEventListener('click', () => {
        state.scheduleBlocks[selectedDate] = (state.scheduleBlocks[selectedDate] || []).filter(b => b.id !== block.id);
        save();
        renderDayView();
      });

      scheduleListEl.appendChild(node);
    });
  }

  document.getElementById('add-block-btn').addEventListener('click', () => {
    if (!state.scheduleBlocks[selectedDate]) state.scheduleBlocks[selectedDate] = [];
    const arr = state.scheduleBlocks[selectedDate];
    const last = arr[arr.length - 1];
    const newBlock = { id: uid(), start: last ? last.end : '05:00', end: last ? last.end : '06:00', label: '' };
    arr.push(newBlock);
    save();
    renderDayView();
    const row = scheduleListEl.querySelector(`[data-id="${newBlock.id}"] .sr-label`);
    if (row) row.focus();
  });

  // ---- Week view ----
  const weekGridEl = document.getElementById('week-grid');
  weekGridEl.addEventListener('click', e => {
    const header = e.target.closest('.week-day-header');
    if (!header) return;
    setSelectedDate(header.closest('.week-day').dataset.date);
    setScheduleView('day');
  });

  function renderWeekView() {
    weekGridEl.innerHTML = '';
    const startKey = startOfWeek(selectedDate);
    const tKey = todayKey();
    for (let i = 0; i < 7; i++) {
      const dayKey = addDays(startKey, i);
      const dayDate = fromDateKey(dayKey);
      const node = weekDayTpl.content.firstElementChild.cloneNode(true);
      node.dataset.date = dayKey;
      node.classList.toggle('is-today', dayKey === tKey);
      node.classList.toggle('is-selected', dayKey === selectedDate);
      node.querySelector('.week-day-name').textContent = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
      node.querySelector('.week-day-num').textContent = dayDate.getDate();

      const blocksWrap = node.querySelector('.week-day-blocks');
      const blocks = (state.scheduleBlocks[dayKey] || []).slice().sort((a, b) => a.start.localeCompare(b.start));
      if (blocks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'week-block-empty';
        empty.textContent = 'No blocks';
        blocksWrap.appendChild(empty);
      } else {
        blocks.forEach(b => {
          const row = document.createElement('div');
          row.className = 'week-block';
          const t = document.createElement('span');
          t.className = 'wb-time';
          t.textContent = formatTimeShort(b.start);
          const l = document.createElement('span');
          l.className = 'wb-label';
          l.textContent = b.label || 'Untitled';
          row.appendChild(t);
          row.appendChild(l);
          blocksWrap.appendChild(row);
        });
      }
      weekGridEl.appendChild(node);
    }
  }

  // ---- Month view ----
  const monthWeekdayRowEl = document.getElementById('month-weekday-row');
  const monthGridEl = document.getElementById('month-grid');

  function renderMonthWeekdayRow() {
    monthWeekdayRowEl.innerHTML = '';
    WEEKDAY_LETTERS.forEach(l => {
      const s = document.createElement('span');
      s.textContent = l;
      monthWeekdayRowEl.appendChild(s);
    });
  }

  monthGridEl.addEventListener('click', e => {
    const cell = e.target.closest('.month-cell');
    if (!cell) return;
    setSelectedDate(cell.dataset.date);
    setScheduleView('day');
  });

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
      const node = monthCellTpl.content.firstElementChild.cloneNode(true);
      node.dataset.date = cellKey;
      node.querySelector('.month-cell-num').textContent = cellDate.getDate();
      node.classList.toggle('outside-month', cellDate.getMonth() !== monthIdx);
      node.classList.toggle('is-today', cellKey === tKey);
      node.classList.toggle('is-selected', cellKey === selectedDate);
      const hasBlocks = (state.scheduleBlocks[cellKey] || []).length > 0;
      node.querySelector('.month-cell-dot').style.visibility = hasBlocks ? 'visible' : 'hidden';
      monthGridEl.appendChild(node);
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

  habitFreqType.addEventListener('change', () => {
    habitFreqCountWrap.hidden = habitFreqType.value !== 'weekly';
  });

  habitForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = habitNameInput.value.trim();
    if (!name) return;
    const frequency = habitFreqType.value === 'weekly'
      ? { type: 'weekly', timesPerWeek: clamp(parseInt(habitFreqCount.value, 10) || 1, 1, 6) }
      : { type: 'daily' };
    state.habits.push({ id: uid(), name, frequency });
    save();
    habitForm.reset();
    habitFreqCountWrap.hidden = true;
    renderHabits();
    habitNameInput.focus();
  });

  document.getElementById('date-prev').addEventListener('click', () => setSelectedDate(addDays(selectedDate, -1)));
  document.getElementById('date-next').addEventListener('click', () => setSelectedDate(addDays(selectedDate, 1)));
  habitsTodayBtn.addEventListener('click', () => setSelectedDate(todayKey()));

  function updateHabitStat(habit, node) {
    const statEl = node.querySelector('.habit-stat');
    const subEl = node.querySelector('.habit-substat');
    if (habit.frequency.type === 'daily') {
      const streak = computeStreak(habit.id);
      statEl.textContent = streak === 0 ? 'No current streak' : `${streak} day${streak === 1 ? '' : 's'} streak`;
      statEl.classList.toggle('accent', streak > 0);
      subEl.textContent = '';
    } else {
      const progress = weeklyProgress(habit.id, selectedDate);
      const target = habit.frequency.timesPerWeek;
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

    state.habits.forEach(habit => {
      const node = habitCardTpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = habit.id;
      const editing = editingHabitId === habit.id;
      node.classList.toggle('editing', editing);

      node.querySelector('.habit-name').textContent = habit.name;
      node.querySelector('.habit-freq-badge').textContent =
        habit.frequency.type === 'daily' ? 'Daily' : `${habit.frequency.timesPerWeek}× / week`;

      const checkbox = node.querySelector('.habit-checkbox');
      checkbox.checked = isDone(habit.id, selectedDate);
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
        countInput.value = habit.frequency.type === 'weekly' ? habit.frequency.timesPerWeek : 1;
        countWrap.hidden = habit.frequency.type !== 'weekly';

        freqTypeSel.addEventListener('change', () => {
          countWrap.hidden = freqTypeSel.value !== 'weekly';
        });

        node.querySelector('.habit-save-btn').addEventListener('click', () => {
          const newName = nameInput.value.trim();
          if (!newName) return;
          habit.name = newName;
          habit.frequency = freqTypeSel.value === 'weekly'
            ? { type: 'weekly', timesPerWeek: clamp(parseInt(countInput.value, 10) || 1, 1, 6) }
            : { type: 'daily' };
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
  const assignmentsListEl = document.getElementById('assignments-list');
  const assignRowTpl = document.getElementById('tpl-assignment-row');

  function renderAssignments() {
    assignmentsListEl.innerHTML = '';
    if (state.assignments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing due — add an assignment above.';
      assignmentsListEl.appendChild(empty);
      return;
    }
    const sorted = [...state.assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const tKey = todayKey();

    sorted.forEach(a => {
      const node = assignRowTpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = a.id;
      if (a.done) node.classList.add('done');
      if (!a.done && a.dueDate < tKey) node.classList.add('overdue');
      if (!a.done && a.dueDate === tKey) node.classList.add('due-today');

      node.querySelector('.assignment-title').textContent = a.title;
      node.querySelector('.assignment-meta').textContent = `${a.course} · Due ${formatDueDate(a.dueDate)}`;

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

      assignmentsListEl.appendChild(node);
    });
  }

  assignForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = assignTitleInput.value.trim();
    const course = assignCourseInput.value.trim();
    const dueDate = assignDueInput.value;
    if (!title || !course || !dueDate) return;
    state.assignments.push({ id: uid(), title, course, dueDate, done: false });
    save();
    assignForm.reset();
    renderAssignments();
    assignTitleInput.focus();
  });

  // ---------- init ----------
  renderSchedule();
  renderHabits();
  renderAssignments();
})();
