import {
  toDateStr,
  getTodayStr,
  getDateOffset,
  dateFromParts,
  formatDateNice,
  getMonthName,
  daysUntil,
  escapeHtml,
  generateId,
} from './utils.js';
import {
  loadTasks,
  saveTasks,
  loadEvents,
  saveEvents,
  loadSettings,
  saveSettings,
  loadRoutines,
  saveRoutines,
  loadHabits,
  saveHabits,
  loadGoals,
  saveGoals,
  loadTrash,
  loadHistory,
  pushToTrash,
  restoreFromTrash,
  pushHistory,
  loadTheme,
  saveTheme,
  exportAllData,
  importAllData,
  applyDailyRoutines,
  applyRecurringTasks,
  checkBackupReminder,
  CATEGORIES,
} from './storage.js';
import {
  renderCountdowns,
  filterTasks,
  getFocusTasks,
  carryOverMissedTasks,
  applyTemplate,
  MORNING_TEMPLATE,
  EVENING_TEMPLATE,
  renderHabits,
  renderGoals,
  renderChart,
  getWeeklyChartData,
  getMonthlyChartData,
  renderTrashList,
  renderHistoryList,
  renderBackupBanner,
  updatePrioritySelectStyle,
  categoryTag,
  renderSubtasks,
  parseSubtasks,
  formatSubtasksForEdit,
  startReminderChecker,
  requestNotificationPermission,
} from './features.js';

const EVENT_CATEGORIES = {
  birthday: { label: 'Birthday', icon: '🎂', color: '#e85a5a' },
  meeting: { label: 'Meeting', icon: '🤝', color: '#4f6ef7' },
  holiday: { label: 'Holiday', icon: '🎉', color: '#d4a14a' },
  deadline: { label: 'Deadline', icon: '⏰', color: '#8b5cf6' },
  personal: { label: 'Personal', icon: '⭐', color: '#2d9b6e' },
};

const state = {
  tasks: [],
  events: [],
  habits: [],
  goals: [],
  settings: loadSettings(),
  routines: loadRoutines(),
  currentTheme: 'dark',
  calYear: null,
  calMonth: null,
  calModalDate: null,
  currentViewDate: getTodayStr(),
  calendarView: 'month',
  eventsFilterMonth: new Date().getMonth(),
  eventsFilterYear: new Date().getFullYear(),
  editingTaskId: null,
  editingEventId: null,
  focusMode: false,
  searchQuery: '',
  filterCategory: '',
  filterPriority: '',
};

let toastTimer = null;
let dragSrcId = null;

const $ = (id) => document.getElementById(id);

function showToast(message) {
  let toast = $('successToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'successToast';
    toast.className = 'success-toast';
    toast.innerHTML = '<i class="fas fa-check"></i><span></span>';
    document.body.appendChild(toast);
  }
  toast.querySelector('span').textContent = message;
  clearTimeout(toastTimer);
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function applyTheme(theme) {
  state.currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  const icon = $('themeIcon');
  const label = $('themeLabel');
  if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
  saveTheme(theme);
}

function persistTasks(snapshot = true) {
  saveTasks(state.tasks);
  if (snapshot) pushHistory({ tasks: state.tasks, events: state.events, habits: state.habits, goals: state.goals });
}

function persistEvents() {
  saveEvents(state.events);
}

function addTask(text, priority, time, date, extra = {}) {
  if (!text?.trim()) return;
  const taskDate = date || getTodayStr();
  const recurring = extra.recurring ? { frequency: extra.recurring, days: [0, 1, 2, 3, 4, 5, 6] } : null;
  state.tasks.push({
    id: generateId(),
    text: text.trim(),
    priority: priority || 'medium',
    done: false,
    time: time || null,
    date: taskDate,
    order: state.tasks.length,
    category: extra.category || 'work',
    recurringId: extra.recurringId || null,
    recurring,
    notes: extra.notes || '',
    subtasks: extra.subtasks || [],
    reminder: !!extra.reminder,
  });
  persistTasks(false);
  renderAll();
  showToast('Task added successfully.');
}

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  persistTasks();
  renderAll();
  if (task.done) showToast('Task completed successfully.');
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  const task = state.tasks.find((t) => t.id === id);
  if (task) pushToTrash(task, 'task');
  state.tasks = state.tasks.filter((t) => t.id !== id);
  persistTasks(false);
  renderAll();
  showToast('Task deleted. Restore from Settings if needed.');
}

function addEvent(data) {
  state.events.push({
    id: generateId(),
    title: data.title.trim(),
    date: data.date,
    time: data.time || null,
    category: data.category || 'personal',
    notes: data.notes || '',
    reminder: !!data.reminder,
  });
  persistEvents();
  renderAll();
  showToast('Event added successfully.');
}

function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  const event = state.events.find((e) => e.id === id);
  if (event) pushToTrash(event, 'event');
  state.events = state.events.filter((e) => e.id !== id);
  persistEvents();
  renderAll();
  showToast('Event deleted.');
}

function renderQuickChips() {
  const container = $('quickChips');
  if (!container) return;
  container.innerHTML = state.settings.quickChips
    .map(
      (chip) =>
        `<button type="button" class="chip" data-task="${escapeHtml(chip.text)}"><span class="chip-emoji">${chip.emoji}</span> ${escapeHtml(chip.text)}</button>`,
    )
    .join('');
  container.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = $('taskInput');
      input.value = chip.dataset.task;
      input.focus();
    });
  });
}

function updateFormLabels() {
  const badge = $('todayDateBadge');
  const formTitle = $('formTitleText');
  const submitLabel = $('submitLabel');
  const isToday = state.currentViewDate === getTodayStr();
  const isTomorrow = state.currentViewDate === getDateOffset(getTodayStr(), 1);
  const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatDateNice(state.currentViewDate);

  if (badge) badge.textContent = formatDateNice(state.currentViewDate);
  if (formTitle) formTitle.textContent = `Create ${label}'s Task`;
  if (submitLabel) submitLabel.textContent = `Add to ${label}`;
}

function renderTodayView() {
  const taskList = $('taskList');
  const emptyState = $('emptyState');
  const todayLabel = $('todayLabel');
  if (!taskList) return;

  let dayTasks = state.tasks.filter((t) => t.date === state.currentViewDate);
  dayTasks = filterTasks(dayTasks, {
    search: state.searchQuery,
    category: state.filterCategory,
    priority: state.filterPriority,
  });

  const focusIds = state.focusMode ? getFocusTasks(state.tasks, state.currentViewDate) : [];

  taskList.querySelectorAll('.task-item').forEach((el) => el.remove());

  if (dayTasks.length === 0) emptyState.style.display = 'block';
  else {
    emptyState.style.display = 'none';
    dayTasks.forEach((task) => {
      const el = createTaskElement(task);
      if (state.focusMode && focusIds.includes(task.id)) el.classList.add('focus-visible');
      taskList.appendChild(el);
    });
  }

  document.body.classList.toggle('focus-mode', state.focusMode);

  const isToday = state.currentViewDate === getTodayStr();
  const isTomorrow = state.currentViewDate === getDateOffset(getTodayStr(), 1);
  const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatDateNice(state.currentViewDate);
  todayLabel.textContent = `${label} • ${formatDateNice(state.currentViewDate)}`;
  updateFormLabels();
}

function createTaskElement(task) {
  const div = document.createElement('div');
  div.className = `task-item${task.done ? ' completed' : ''}`;
  div.dataset.priority = task.priority;
  div.dataset.id = task.id;
  div.draggable = true;
  div.addEventListener('dragstart', handleDragStart);
  div.addEventListener('dragend', handleDragEnd);
  div.addEventListener('dragover', handleDragOver);
  div.addEventListener('dragenter', handleDragEnter);
  div.addEventListener('drop', handleDrop);

  const check = document.createElement('button');
  check.className = 'task-check';
  check.setAttribute('aria-label', task.done ? 'Mark incomplete' : 'Mark complete');
  check.innerHTML = task.done ? '<i class="fas fa-check"></i>' : '';
  check.addEventListener('click', () => toggleTask(task.id));

  const textSpan = document.createElement('span');
  textSpan.className = 'task-text';
  textSpan.innerHTML = `${escapeHtml(task.text)} ${categoryTag(task.category || 'work')}`;
  if (task.recurringId || task.recurring) {
    const tag = document.createElement('span');
    tag.className = 'task-tag routine-tag';
    tag.textContent = 'Routine';
    textSpan.appendChild(tag);
  }
  if (task.time) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'task-time';
    timeSpan.innerHTML = `<i class="far fa-clock"></i> ${escapeHtml(task.time)}`;
    textSpan.appendChild(timeSpan);
  }
  if (task.subtasks?.length) {
    const subDiv = document.createElement('div');
    subDiv.innerHTML = renderSubtasks(task.subtasks, task.id);
    subDiv.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const idx = parseInt(cb.dataset.idx, 10);
        task.subtasks[idx].done = cb.checked;
        persistTasks(false);
        renderTodayView();
      });
    });
    textSpan.appendChild(subDiv);
  }

  const priorityBadge = document.createElement('span');
  priorityBadge.className = 'task-priority-badge';
  priorityBadge.dataset.priority = task.priority;
  priorityBadge.textContent = task.priority;

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'edit-btn';
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.innerHTML = '<i class="fas fa-edit"></i>';
  editBtn.addEventListener('click', () => openEditTaskModal(task.id));
  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.setAttribute('aria-label', 'Delete task');
  delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
  delBtn.addEventListener('click', () => deleteTask(task.id));
  actions.append(editBtn, delBtn);
  div.append(check, textSpan, priorityBadge, actions);
  return div;
}

function handleDragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.task-item').forEach((el) => {
    el.style.borderTop = '';
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  this.style.borderTop = '2px solid var(--primary)';
}

function handleDrop(e) {
  e.preventDefault();
  this.style.borderTop = '';
  const srcId = e.dataTransfer.getData('text/plain');
  const targetId = this.dataset.id;
  if (srcId === targetId) return;
  const srcIdx = state.tasks.findIndex((t) => t.id === srcId);
  const tgtIdx = state.tasks.findIndex((t) => t.id === targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;
  const [removed] = state.tasks.splice(srcIdx, 1);
  state.tasks.splice(tgtIdx, 0, removed);
  state.tasks.forEach((t, i) => {
    t.order = i;
  });
  persistTasks();
  renderAll();
}

function getWeekDates(baseDateStr) {
  const base = new Date(`${baseDateStr}T12:00:00`);
  const day = base.getDay();
  const start = new Date(base);
  start.setDate(base.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateStr(d);
  });
}

function renderCalendar() {
  if (state.calendarView === 'week') {
    renderWeekView();
    return;
  }

  const year = state.calYear;
  const month = state.calMonth;
  const calendarGrid = $('calendarGrid');
  const calendarMonthYear = $('calendarMonthYear');
  if (!calendarGrid) return;

  calendarMonthYear.textContent = `${getMonthName(month)} ${year}`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getTodayStr();
  let html = '';
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((d) => {
    html += `<div class="calendar-header-cell">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = dateFromParts(year, month, d);
    const dayTasks = state.tasks.filter((t) => t.date === dateStr);
    const dayEvents = state.events.filter((e) => e.date === dateStr);
    const hasItems = dayTasks.length > 0 || dayEvents.length > 0;
    let cls = 'calendar-day-cell';
    if (hasItems) cls += ' has-tasks';
    if (dateStr === today) cls += ' today';
    if (dayEvents.length) cls += ' has-events';

    let dotsHtml = '';
    const priColors = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' };
    dayTasks.slice(0, 4).forEach((t) => {
      dotsHtml += `<span class="dot ${priColors[t.priority] || ''}"></span>`;
    });
    dayEvents.slice(0, 2).forEach(() => {
      dotsHtml += '<span class="dot event-dot"></span>';
    });

    const preview = dayEvents[0]?.title || dayTasks[0]?.text || '';
    html += `<div class="${cls}" data-date="${dateStr}" onclick="window.openCalModal('${dateStr}')">
      <span class="day-number">${d}</span>
      ${hasItems ? `<div class="day-dots">${dotsHtml}</div>` : ''}
      ${preview ? `<div class="day-tasks-preview">${escapeHtml(preview.slice(0, 12))}${preview.length > 12 ? '…' : ''}</div>` : ''}
    </div>`;
  }
  calendarGrid.innerHTML = html;
  calendarGrid.className = 'calendar-grid';
}

function renderWeekView() {
  const calendarGrid = $('calendarGrid');
  const calendarMonthYear = $('calendarMonthYear');
  if (!calendarGrid) return;

  const weekDates = getWeekDates(state.currentViewDate || getTodayStr());
  calendarMonthYear.textContent = `Week of ${formatDateNice(weekDates[0])}`;
  calendarGrid.className = 'calendar-grid week-grid';

  let html = '';
  weekDates.forEach((dateStr) => {
    const dayTasks = state.tasks.filter((t) => t.date === dateStr);
    const dayEvents = state.events.filter((e) => e.date === dateStr);
    const isToday = dateStr === getTodayStr();
    html += `<div class="week-day-card${isToday ? ' today' : ''}">
      <button type="button" class="week-day-header" onclick="window.openCalModal('${dateStr}')">
        <span class="week-day-name">${new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span class="week-day-date">${new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </button>
      <div class="week-day-items">
        ${dayEvents.map((e) => `<div class="week-event-item">${EVENT_CATEGORIES[e.category]?.icon || '⭐'} ${escapeHtml(e.title)}</div>`).join('')}
        ${dayTasks.map((t) => `<div class="week-task-item${t.done ? ' done' : ''}" data-priority="${t.priority}">${t.done ? '✓' : '○'} ${escapeHtml(t.text)}</div>`).join('')}
        ${dayTasks.length === 0 && dayEvents.length === 0 ? '<div class="week-empty">No items</div>' : ''}
      </div>
    </div>`;
  });
  calendarGrid.innerHTML = html;
}

function renderEventsTab() {
  const list = $('eventsList');
  const monthSelect = $('eventsMonth');
  const yearSelect = $('eventsYear');
  if (!list) return;

  const month = state.eventsFilterMonth;
  const year = state.eventsFilterYear;
  const monthEvents = state.events
    .filter((e) => {
      const d = new Date(`${e.date}T12:00:00`);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (monthSelect) monthSelect.value = String(month);
  if (yearSelect) yearSelect.value = String(year);

  if (monthEvents.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No special events this month. Add birthdays, meetings, or deadlines.</p></div>';
    return;
  }

  list.innerHTML = monthEvents
    .map((event) => {
      const cat = EVENT_CATEGORIES[event.category] || EVENT_CATEGORIES.personal;
      const countdown = daysUntil(event.date);
      let countdownText = '';
      if (countdown === 0) countdownText = 'Today';
      else if (countdown > 0) countdownText = `In ${countdown} day${countdown === 1 ? '' : 's'}`;
      else countdownText = `${Math.abs(countdown)} day${Math.abs(countdown) === 1 ? '' : 's'} ago`;

      return `<article class="event-card" style="border-left-color:${cat.color}">
        <div class="event-card-top">
          <span class="event-category">${cat.icon} ${cat.label}</span>
          <span class="event-countdown">${countdownText}</span>
        </div>
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <p class="event-meta">${formatDateNice(event.date)}${event.time ? ` • ${escapeHtml(event.time)}` : ''}</p>
        ${event.notes ? `<p class="event-notes">${escapeHtml(event.notes)}</p>` : ''}
        <div class="event-actions">
          <button type="button" class="btn-ghost" onclick="window.openEditEventModal('${event.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button type="button" class="btn-ghost danger" onclick="window.deleteEventById('${event.id}')"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>
      </article>`;
    })
    .join('');
}

function calculateStreak() {
  let streak = 0;
  let date = getTodayStr();
  while (true) {
    const dayTasks = state.tasks.filter((t) => t.date === date);
    if (dayTasks.length === 0) break;
    const allDone = dayTasks.every((t) => t.done);
    if (!allDone) break;
    streak += 1;
    date = getDateOffset(date, -1);
  }
  return streak;
}

function renderProgressTab() {
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.done).length;
  const pending = total - done;
  const missed = state.tasks.filter((t) => t.date < getTodayStr() && !t.done).length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);

  $('progRate').textContent = `${rate}%`;
  $('progDone').textContent = done;
  $('progPending').textContent = pending;
  $('progMissed').textContent = missed;

  const streak = calculateStreak();
  const streakEl = $('progStreak');
  if (streakEl) streakEl.textContent = streak;

  const weekDates = getWeekDates(getTodayStr());
  const weekDone = weekDates.reduce((acc, d) => acc + state.tasks.filter((t) => t.date === d && t.done).length, 0);
  const weekTotal = weekDates.reduce((acc, d) => acc + state.tasks.filter((t) => t.date === d).length, 0);
  const weekRate = weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100);
  const weekEl = $('progWeekRate');
  if (weekEl) weekEl.textContent = `${weekRate}%`;

  const today = getTodayStr();
  const todayTasks = state.tasks.filter((t) => t.date === today);
  const todayDone = todayTasks.filter((t) => t.done).length;
  const todayRate = todayTasks.length === 0 ? 0 : Math.round((todayDone / todayTasks.length) * 100);
  const dailyCircumference = 282.743;
  $('dailyRingFg').style.strokeDashoffset = dailyCircumference - (todayRate / 100) * dailyCircumference;
  $('dailyRingPct').textContent = `${todayRate}%`;
  $('dailyCompleted').textContent = todayDone;
  $('dailyPending').textContent = todayTasks.length - todayDone;

  $('overallRingFg').style.strokeDashoffset = dailyCircumference - (rate / 100) * dailyCircumference;
  $('overallRingPct').textContent = `${rate}%`;
  $('overallCompleted').textContent = done;
  $('overallPending').textContent = pending;
}

function renderStatsTab() {
  const today = getTodayStr();
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.done).length;
  const pending = total - done;
  const high = state.tasks.filter((t) => t.priority === 'high' && !t.done).length;
  const missed = state.tasks.filter((t) => t.date < today && !t.done).length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);

  $('kpiHigh').textContent = high;
  $('kpiCompleted').textContent = done;
  $('kpiPending').textContent = pending;
  $('kpiMissed').textContent = missed;
  $('kpiRate').textContent = `${rate}%`;

  const uniqueDays = new Set(state.tasks.map((t) => t.date)).size;
  $('daysWithTasks').textContent = uniqueDays;
  $('totalTasksOverall').textContent = total;
  $('completionRateOverall').textContent = `${rate}%`;
  $('avgTasksPerDay').textContent = uniqueDays > 0 ? (total / uniqueDays).toFixed(1) : '0';

  renderHeatmap();
}

function renderHeatmap() {
  const year = parseInt($('heatmapYear').value, 10);
  const month = parseInt($('heatmapMonth').value, 10);
  const today = getTodayStr();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  let html = '';
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((d) => {
    html += `<div class="heatmap-weekday">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) html += '<div class="heatmap-cell empty-cell"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = dateFromParts(year, month, d);
    const dayTasks = state.tasks.filter((t) => t.date === dateStr);
    const isPast = dateStr < today;
    const isToday = dateStr === today;
    let status = 'empty-cell';
    let statusLabel = '';
    let tooltipText = 'No tasks';

    if (dayTasks.length > 0) {
      const doneCount = dayTasks.filter((t) => t.done).length;
      const allDone = doneCount === dayTasks.length;
      const someDone = doneCount > 0 && !allDone;
      if (allDone && (isPast || isToday)) {
        status = 'success';
        statusLabel = '✓';
        tooltipText = `✅ ${doneCount}/${dayTasks.length} done`;
      } else if (someDone && (isPast || isToday)) {
        status = 'pending';
        statusLabel = '⏳';
        tooltipText = `⏳ ${doneCount}/${dayTasks.length} done`;
      } else if (!someDone && isPast) {
        status = 'missed';
        statusLabel = '✗';
        tooltipText = `❌ ${dayTasks.length} missed`;
      } else {
        status = 'pending';
        statusLabel = '📋';
        tooltipText = `📋 ${dayTasks.length} planned`;
      }
    }
    html += `<div class="heatmap-cell ${status}">
      <span class="day-num">${d}</span>
      ${statusLabel ? `<span class="day-status">${statusLabel}</span>` : ''}
      <span class="heat-tooltip">${tooltipText}</span>
    </div>`;
  }
  $('heatmapGrid').innerHTML = html;
}

function populateYearSelects() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 5; y <= currentYear + 2; y++) years.push(y);
  const heatmapYear = $('heatmapYear');
  const eventsYear = $('eventsYear');
  if (heatmapYear) heatmapYear.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  if (eventsYear) eventsYear.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
}

function renderCalModalTasks(dateStr) {
  const calModalTasks = $('calModalTasks');
  const dayTasks = state.tasks.filter((t) => t.date === dateStr);
  const dayEvents = state.events.filter((e) => e.date === dateStr);

  if (dayTasks.length === 0 && dayEvents.length === 0) {
    calModalTasks.innerHTML = '<div class="cal-empty-msg">No tasks or events for this day yet.</div>';
    return;
  }

  let html = '';
  dayEvents.forEach((e) => {
    const cat = EVENT_CATEGORIES[e.category] || EVENT_CATEGORIES.personal;
    html += `<div class="cal-task-item event-item" style="border-left-color:${cat.color}">
      <span class="cal-task-text">${cat.icon} ${escapeHtml(e.title)}</span>
      <span class="cal-task-priority ${e.category}">event</span>
    </div>`;
  });
  dayTasks.forEach((t) => {
    html += `<div class="cal-task-item" style="border-left-color:${t.priority === 'high' ? 'var(--priority-high)' : t.priority === 'medium' ? 'var(--priority-medium)' : 'var(--priority-low)'};">
      <button type="button" class="cal-task-check" onclick="window.toggleCalTask('${t.id}')" aria-label="Toggle complete">${t.done ? '✅' : '◻️'}</button>
      <span class="cal-task-text">${escapeHtml(t.text)}</span>
      ${t.time ? `<span style="font-size:0.65rem;color:var(--text-secondary);">${escapeHtml(t.time)}</span>` : ''}
      <span class="cal-task-priority ${t.priority}">${t.priority}</span>
      <button type="button" class="cal-task-del" onclick="window.deleteCalTask('${t.id}')"><i class="fas fa-times"></i></button>
    </div>`;
  });
  calModalTasks.innerHTML = html;
}

function renderAll() {
  renderTodayView();
  renderCalendar();
  renderEventsTab();
  renderCountdowns(state.events, $('countdownRow'));
  renderProgressTab();
  renderStatsTab();
  renderHabits(state.habits, $('habitsList'), toggleHabit);
  renderGoals(state.goals, $('goalsList'));
  const weekly = getWeeklyChartData(state.tasks);
  const monthly = getMonthlyChartData(state.tasks);
  renderChart($('weeklyChart'), weekly.labels, weekly.values);
  renderChart($('monthlyChart'), monthly.labels, monthly.values);
  renderBackupBanner(checkBackupReminder(state.settings), $('backupBanner'), exportData);
  updateLabels();
  updateProfileLabel();
}

function updateLabels() {
  $('todayDateBadge').textContent = formatDateNice(getTodayStr());
}

function updateProfileLabel() {
  const profileIcon = $('profileIcon');
  if (!profileIcon) return;
  profileIcon.title = state.settings.userName ? `${state.settings.userName} — Settings` : 'Settings & Profile';
}

function openEditTaskModal(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  state.editingTaskId = id;
  $('editTaskText').value = task.text;
  $('editTaskDate').value = task.date;
  $('editTaskTime').value = task.time || '';
  $('editTaskPriority').value = task.priority;
  $('editTaskNotes').value = task.notes || '';
  $('editTaskCategory').value = task.category || 'work';
  $('editSubtasks').value = formatSubtasksForEdit(task.subtasks);
  $('editTaskModal').classList.add('active');
}

function toggleHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;
  if (!habit.log) habit.log = {};
  const today = getTodayStr();
  habit.log[today] = !habit.log[today];
  saveHabits(state.habits);
  renderHabits(state.habits, $('habitsList'), toggleHabit);
}

function closeEditTaskModal() {
  state.editingTaskId = null;
  $('editTaskModal').classList.remove('active');
}

function saveEditTask() {
  const task = state.tasks.find((t) => t.id === state.editingTaskId);
  if (!task) return;
  task.text = $('editTaskText').value.trim();
  task.date = $('editTaskDate').value;
  task.time = $('editTaskTime').value || null;
  task.priority = $('editTaskPriority').value;
  task.notes = $('editTaskNotes').value.trim();
  task.category = $('editTaskCategory').value;
  task.subtasks = parseSubtasks($('editSubtasks').value);
  if (!task.text || !task.date) return;
  persistTasks();
  closeEditTaskModal();
  renderAll();
  showToast('Task updated successfully.');
}

function openSettingsModal() {
  $('settingsName').value = state.settings.userName || '';
  $('settingsDefaultTab').value = state.settings.defaultTab || 'home';
  $('settingsChips').value = state.settings.quickChips.map((c) => `${c.emoji} ${c.text}`).join('\n');
  renderTrashList(loadTrash(), $('trashList'), restoreTrashItem);
  renderHistoryList(loadHistory(), $('historyList'));
  $('settingsModal').classList.add('active');
}

function restoreTrashItem(id) {
  const entry = restoreFromTrash(id);
  if (!entry) return;
  if (entry.type === 'task') state.tasks.push(entry.item);
  if (entry.type === 'event') state.events.push(entry.item);
  persistTasks();
  persistEvents();
  openSettingsModal();
  renderAll();
  showToast('Item restored.');
}

function closeSettingsModal() {
  $('settingsModal').classList.remove('active');
}

function saveSettingsForm() {
  const chipsRaw = $('settingsChips').value.split('\n').filter(Boolean);
  state.settings.userName = $('settingsName').value.trim();
  state.settings.defaultTab = $('settingsDefaultTab').value;
  state.settings.quickChips = chipsRaw.map((line) => {
    const parts = line.trim().split(/\s+/);
    const emoji = parts[0]?.length <= 2 ? parts.shift() : '📌';
    return { emoji, text: parts.join(' ') || line.trim() };
  });
  saveSettings(state.settings);
  closeSettingsModal();
  renderQuickChips();
  renderAll();
  showToast('Settings saved successfully.');
}

function exportData() {
  const payload = exportAllData(state.tasks, state.events, state.settings, state.routines, state.habits, state.goals);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `napaxtime-backup-${getTodayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  state.settings.lastBackup = new Date().toISOString();
  saveSettings(state.settings);
  renderAll();
  showToast('Backup downloaded successfully.');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importAllData(JSON.parse(reader.result));
      reloadState();
      renderAll();
      showToast('Backup restored successfully.');
    } catch {
      showToast('Could not import backup file.');
    }
  };
  reader.readAsText(file);
}

function reloadState() {
  state.tasks = loadTasks();
  state.events = loadEvents();
  state.habits = loadHabits();
  state.goals = loadGoals();
  state.settings = loadSettings();
  state.routines = loadRoutines();
  renderQuickChips();
}

function bindGlobalHandlers() {
  window.switchTab = (tabId) => {
    document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.toggle('active', content.id === `tab-${tabId}`));
    if (tabId === 'events') {
      renderCalendar();
      renderEventsTab();
      renderCountdowns(state.events, $('countdownRow'));
    }
    if (tabId === 'progress') renderProgressTab();
    if (tabId === 'stats') renderStatsTab();
    if (tabId === 'today') {
      state.currentViewDate = getTodayStr();
      renderTodayView();
    }
  };

  window.changeDay = (dir) => {
    document.querySelectorAll('.task-nav-toggle button').forEach((b) => b.classList.remove('active'));
    if (dir === 'today') {
      state.currentViewDate = getTodayStr();
      document.querySelector('.task-nav-toggle button:nth-child(1)')?.classList.add('active');
    } else if (dir === 'tomorrow') {
      state.currentViewDate = getDateOffset(getTodayStr(), 1);
      document.querySelector('.task-nav-toggle button:nth-child(2)')?.classList.add('active');
    }
    renderTodayView();
  };

  window.openCalModal = (dateStr) => {
    state.calModalDate = dateStr;
    $('calModalDate').textContent = formatDateNice(dateStr);
    $('calModalDateDisplay').textContent = formatDateNice(dateStr);
    $('calTaskInput').value = '';
    $('calTimeInput').value = '';
    $('calPrioritySelect').value = 'medium';
    renderCalModalTasks(dateStr);
    $('calModal').classList.add('active');
    setTimeout(() => $('calTaskInput').focus(), 100);
  };

  window.deleteCalTask = (id) => {
    if (!confirm('Delete this task?')) return;
    state.tasks = state.tasks.filter((t) => t.id !== id);
    persistTasks();
    renderAll();
    if (state.calModalDate) renderCalModalTasks(state.calModalDate);
    showToast('Task deleted successfully.');
  };

  window.toggleCalTask = (id) => toggleTask(id);

  window.openKpiModal = (type) => {
    const labels = {
      high: { title: 'High Priority Tasks', icon: 'fa-flag', color: 'var(--priority-high)' },
      completed: { title: 'Completed Tasks', icon: 'fa-check-circle', color: 'var(--success)' },
      pending: { title: 'Pending Tasks', icon: 'fa-hourglass-half', color: 'var(--warning)' },
    };
    const info = labels[type];
    let filtered = [];
    if (type === 'high') filtered = state.tasks.filter((t) => t.priority === 'high' && !t.done);
    else if (type === 'completed') filtered = state.tasks.filter((t) => t.done);
    else if (type === 'pending') filtered = state.tasks.filter((t) => !t.done);

    $('kpiModalTitle').innerHTML = `<i class="fas ${info.icon}" style="color:${info.color};"></i> ${info.title}`;
    $('kpiModalCount').textContent = filtered.length;
    $('kpiModalSub').textContent = filtered.length === 0 ? 'No tasks found.' : `Showing ${filtered.length} tasks`;
    $('kpiModalContent').innerHTML =
      filtered.length === 0
        ? '<div class="empty-msg">🎉 No tasks found.</div>'
        : filtered
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map(
              (t) => `<div class="kpi-task-item" data-priority="${t.priority}">
                <span class="task-text">${escapeHtml(t.text)}</span>
                <span class="task-priority-badge" data-priority="${t.priority}">${t.priority}</span>
                ${t.time ? `<span class="task-time"><i class="far fa-clock"></i> ${escapeHtml(t.time)}</span>` : ''}
                <span class="task-date-tag">${t.date === getTodayStr() ? 'Today' : formatDateNice(t.date)}</span>
              </div>`,
            )
            .join('');
    $('kpiModal').classList.add('active');
  };

  window.closeKpiModal = () => $('kpiModal').classList.remove('active');

  window.openMissedModal = () => {
    const today = getTodayStr();
    const missedTasks = state.tasks.filter((t) => t.date < today && !t.done).sort((a, b) => (a.date < b.date ? 1 : -1));
    $('missedCount').textContent = missedTasks.length;
    if (missedTasks.length === 0) {
      $('missedContent').innerHTML = '<div class="empty-msg">🎉 No missed tasks! Keep it up!</div>';
    } else {
      const grouped = {};
      missedTasks.forEach((t) => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
      });
      $('missedContent').innerHTML = Object.keys(grouped)
        .sort((a, b) => (a < b ? 1 : -1))
        .map(
          (date) => `<div class="missed-group"><div class="group-date">${formatDateNice(date)}</div>${grouped[date]
            .map(
              (t) => `<div class="missed-task-item" data-priority="${t.priority}">
                <span class="task-text">${escapeHtml(t.text)}</span>
                <span class="task-priority-badge" data-priority="${t.priority}">${t.priority}</span>
                ${t.time ? `<span class="task-time"><i class="far fa-clock"></i> ${escapeHtml(t.time)}</span>` : ''}
                <button type="button" class="complete-btn" onclick="window.completeMissedTask('${t.id}')">Complete</button>
              </div>`,
            )
            .join('')}</div>`,
        )
        .join('');
    }
    $('missedModal').classList.add('active');
  };

  window.closeMissedModal = () => $('missedModal').classList.remove('active');
  window.completeMissedTask = (id) => {
    toggleTask(id);
    window.openMissedModal();
  };

  window.openEditEventModal = (id) => {
    const event = state.events.find((e) => e.id === id);
    if (!event) return;
    state.editingEventId = id;
    $('eventTitle').value = event.title;
    $('eventDate').value = event.date;
    $('eventTime').value = event.time || '';
    $('eventCategory').value = event.category;
    $('eventNotes').value = event.notes || '';
    $('eventReminder').checked = event.reminder;
    $('eventModalTitle').textContent = 'Edit Event';
    $('eventModal').classList.add('active');
  };

  window.deleteEventById = (id) => deleteEvent(id);
}

function bindEvents() {
  $('themeToggle')?.addEventListener('click', () => applyTheme(state.currentTheme === 'light' ? 'dark' : 'light'));
  $('profileIcon')?.addEventListener('click', openSettingsModal);

  $('taskForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('taskInput').value.trim();
    if (!text) return;
    const recurring = $('recurringSelect')?.value || '';
    const category = $('categorySelect')?.value || 'work';
    addTask(text, $('prioritySelect').value, $('timeInput').value || null, state.currentViewDate, {
      category,
      recurring: recurring || null,
    });
    if (recurring) {
      state.routines.push({
        id: generateId(),
        text,
        priority: $('prioritySelect').value,
        time: $('timeInput').value || null,
        days: recurring === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [new Date(`${state.currentViewDate}T12:00:00`).getDay()],
      });
      saveRoutines(state.routines);
    }
    $('taskInput').value = '';
    $('timeInput').value = '';
    $('recurringSelect').value = '';
    $('taskInput').focus();
  });

  $('prioritySelect')?.addEventListener('change', (e) => updatePrioritySelectStyle(e.target));
  $('taskSearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTodayView();
  });
  $('filterCategory')?.addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    renderTodayView();
  });
  $('filterPriority')?.addEventListener('change', (e) => {
    state.filterPriority = e.target.value;
    renderTodayView();
  });
  $('focusModeBtn')?.addEventListener('click', () => {
    state.focusMode = !state.focusMode;
    $('focusModeBtn').classList.toggle('active', state.focusMode);
    renderTodayView();
  });
  $('priorityInboxBtn')?.addEventListener('click', () => window.openKpiModal('high'));
  $('carryOverBtn')?.addEventListener('click', () => {
    const n = carryOverMissedTasks(state.tasks, getTodayStr());
    if (n) {
      persistTasks();
      renderAll();
      showToast(`${n} task(s) moved to today.`);
    } else showToast('No missed tasks from yesterday.');
  });
  $('morningBtn')?.addEventListener('click', () => {
    const n = applyTemplate(state.tasks, MORNING_TEMPLATE, state.currentViewDate);
    persistTasks(false);
    renderAll();
    showToast(n ? `Added ${n} morning tasks.` : 'Morning tasks already exist.');
  });
  $('eveningBtn')?.addEventListener('click', () => {
    const n = applyTemplate(state.tasks, EVENING_TEMPLATE, state.currentViewDate);
    persistTasks(false);
    renderAll();
    showToast(n ? `Added ${n} evening tasks.` : 'Evening tasks already exist.');
  });
  $('addHabitBtn')?.addEventListener('click', () => {
    const name = prompt('Habit name (e.g. Gym, Read Bible):');
    if (!name?.trim()) return;
    state.habits.push({ id: generateId(), name: name.trim(), log: {} });
    saveHabits(state.habits);
    renderHabits(state.habits, $('habitsList'), toggleHabit);
  });
  $('addGoalBtn')?.addEventListener('click', () => {
    if (state.goals.length >= 3) {
      showToast('Maximum 3 monthly goals.');
      return;
    }
    const title = prompt('Monthly goal:');
    if (!title?.trim()) return;
    state.goals.push({ id: generateId(), title: title.trim(), progress: 0, month: new Date().getMonth() });
    saveGoals(state.goals);
    renderGoals(state.goals, $('goalsList'));
  });

  $('prevMonth')?.addEventListener('click', () => {
    let m = state.calMonth - 1;
    let y = state.calYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    state.calMonth = m;
    state.calYear = y;
    renderCalendar();
  });

  $('nextMonth')?.addEventListener('click', () => {
    let m = state.calMonth + 1;
    let y = state.calYear;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    state.calMonth = m;
    state.calYear = y;
    renderCalendar();
  });

  document.querySelectorAll('.calendar-view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.calendar-view-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.calendarView = btn.dataset.view;
      renderCalendar();
    });
  });

  $('calAddBtn')?.addEventListener('click', () => {
    const text = $('calTaskInput').value.trim();
    if (!text) return;
    addTask(text, $('calPrioritySelect').value, $('calTimeInput').value || null, state.calModalDate || getTodayStr());
    renderCalModalTasks(state.calModalDate);
    $('calTaskInput').value = '';
    $('calTimeInput').value = '';
  });

  $('calModalClose')?.addEventListener('click', () => {
    $('calModal').classList.remove('active');
    state.calModalDate = null;
  });

  $('calModal')?.addEventListener('click', (e) => {
    if (e.target === $('calModal')) {
      $('calModal').classList.remove('active');
      state.calModalDate = null;
    }
  });

  $('kpiModal')?.addEventListener('click', (e) => {
    if (e.target === $('kpiModal')) window.closeKpiModal();
  });
  $('missedModal')?.addEventListener('click', (e) => {
    if (e.target === $('missedModal')) window.closeMissedModal();
  });

  $('progMissedCard')?.addEventListener('click', () => window.openMissedModal());

  $('heatmapMonth')?.addEventListener('change', renderHeatmap);
  $('heatmapYear')?.addEventListener('change', renderHeatmap);
  $('eventsMonth')?.addEventListener('change', (e) => {
    state.eventsFilterMonth = parseInt(e.target.value, 10);
    renderEventsTab();
  });
  $('eventsYear')?.addEventListener('change', (e) => {
    state.eventsFilterYear = parseInt(e.target.value, 10);
    renderEventsTab();
  });

  $('eventForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: $('eventTitle').value,
      date: $('eventDate').value,
      time: $('eventTime').value,
      category: $('eventCategory').value,
      notes: $('eventNotes').value,
      reminder: $('eventReminder').checked,
    };
    if (!data.title.trim() || !data.date) return;
    if (state.editingEventId) {
      const event = state.events.find((ev) => ev.id === state.editingEventId);
      Object.assign(event, { ...data, title: data.title.trim(), notes: data.notes.trim() });
      state.editingEventId = null;
      $('eventModalTitle').textContent = 'Add Special Event';
      showToast('Event updated successfully.');
    } else {
      addEvent(data);
    }
    persistEvents();
    $('eventForm').reset();
    $('eventModal').classList.remove('active');
    renderAll();
  });

  $('openEventModalBtn')?.addEventListener('click', () => {
    state.editingEventId = null;
    $('eventForm').reset();
    $('eventDate').value = getTodayStr();
    $('eventModalTitle').textContent = 'Add Special Event';
    $('eventModal').classList.add('active');
  });

  $('eventModalClose')?.addEventListener('click', () => {
    state.editingEventId = null;
    $('eventModal').classList.remove('active');
  });

  $('editTaskSave')?.addEventListener('click', saveEditTask);
  $('editTaskClose')?.addEventListener('click', closeEditTaskModal);
  $('settingsSave')?.addEventListener('click', saveSettingsForm);
  $('settingsClose')?.addEventListener('click', closeSettingsModal);
  $('exportDataBtn')?.addEventListener('click', exportData);
  $('importDataBtn')?.addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => window.switchTab(btn.dataset.tab));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['calModal', 'kpiModal', 'missedModal', 'editTaskModal', 'settingsModal', 'eventModal'].forEach((id) => {
      $(id)?.classList.remove('active');
    });
    state.calModalDate = null;
    state.editingTaskId = null;
    state.editingEventId = null;
  });
}

function init() {
  applyTheme(loadTheme());
  state.tasks = loadTasks();
  state.events = loadEvents();
  state.habits = loadHabits();
  state.goals = loadGoals();
  state.settings = loadSettings();
  state.routines = loadRoutines();

  if (!state.habits.length) {
    state.habits = [
      { id: generateId(), name: 'Gym', log: {} },
      { id: generateId(), name: 'Bible Study', log: {} },
    ];
    saveHabits(state.habits);
  }

  if (applyDailyRoutines(state.tasks, state.routines, getTodayStr())) {
    persistTasks(false);
  }

  const now = new Date();
  state.calYear = now.getFullYear();
  state.calMonth = now.getMonth();
  state.eventsFilterMonth = now.getMonth();
  state.eventsFilterYear = now.getFullYear();

  populateYearSelects();
  $('heatmapMonth').value = String(now.getMonth());
  $('heatmapYear').value = String(now.getFullYear());
  updatePrioritySelectStyle($('prioritySelect'));

  bindGlobalHandlers();
  bindEvents();
  renderQuickChips();
  renderAll();
  window.switchTab(state.settings.defaultTab === 'calendar' ? 'events' : state.settings.defaultTab || 'home');

  requestNotificationPermission();
  startReminderChecker(state.tasks, state.events, showToast);
}

init();
