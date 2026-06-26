import { getTodayStr, getDateOffset, daysUntil, formatDateNice, escapeHtml, generateId } from './utils.js';
import { CATEGORIES } from './storage.js';

export function renderCountdowns(events, container) {
  if (!container) return;
  const upcoming = events
    .filter((e) => daysUntil(e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = upcoming
    .map((e) => {
      const d = daysUntil(e.date);
      const label = d === 0 ? 'Today!' : d === 1 ? 'Tomorrow' : `In ${d} days`;
      return `<div class="countdown-chip"><strong>${escapeHtml(e.title)}</strong>${label} &middot; ${formatDateNice(e.date)}</div>`;
    })
    .join('');
}

export function filterTasks(tasks, { search, category, priority, date }) {
  return tasks.filter((t) => {
    if (date && t.date !== date) return false;
    if (search && !t.text.toLowerCase().includes(search.toLowerCase())) return false;
    if (category && (t.category || 'work') !== category) return false;
    if (priority && t.priority !== priority) return false;
    return true;
  });
}

export function getFocusTasks(tasks, date) {
  const day = tasks.filter((t) => t.date === date && !t.done);
  const sorted = [...day].sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
  });
  return sorted.slice(0, 3).map((t) => t.id);
}

export function carryOverMissedTasks(tasks, today) {
  const yesterday = getDateOffset(today, -1);
  const missed = tasks.filter((t) => t.date === yesterday && !t.done);
  missed.forEach((t) => {
    t.date = today;
    t.carriedOver = true;
  });
  return missed.length;
}

export const MORNING_TEMPLATE = [
  { text: 'bible study', priority: 'medium', time: '06:30', category: 'faith' },
  { text: 'gym', priority: 'high', time: '07:00', category: 'health' },
  { text: 'plan the day', priority: 'high', time: '08:00', category: 'work' },
];

export const EVENING_TEMPLATE = [
  { text: 'review today', priority: 'medium', time: '20:00', category: 'work' },
  { text: 'prepare tomorrow', priority: 'medium', time: '20:30', category: 'work' },
  { text: 'help mother', priority: 'low', time: '21:00', category: 'family' },
];

export function applyTemplate(tasks, template, date) {
  let added = 0;
  template.forEach((item) => {
    const exists = tasks.some((t) => t.date === date && t.text.toLowerCase() === item.text.toLowerCase());
    if (exists) return;
    tasks.push({
      id: generateId(),
      text: item.text,
      priority: item.priority,
      done: false,
      time: item.time,
      date,
      order: tasks.length,
      category: item.category,
      subtasks: [],
      notes: '',
    });
    added += 1;
  });
  return added;
}

export function renderHabits(habits, container, onToggle) {
  if (!container) return;
  if (!habits.length) {
    container.innerHTML = '<p class="week-empty">No habits yet. Add gym, reading, etc.</p>';
    return;
  }
  const today = getTodayStr();
  container.innerHTML = habits
    .map((h) => {
      const done = h.log?.[today];
      return `<div class="habit-row">
        <span>${escapeHtml(h.name)}</span>
        <button type="button" class="habit-toggle${done ? ' done' : ''}" data-id="${h.id}" aria-label="Toggle habit">${done ? '✓' : ''}</button>
      </div>`;
    })
    .join('');
  container.querySelectorAll('.habit-toggle').forEach((btn) => {
    btn.addEventListener('click', () => onToggle(btn.dataset.id));
  });
}

export function renderGoals(goals, container) {
  if (!container) return;
  if (!goals.length) {
    container.innerHTML = '<p class="week-empty">Set up to 3 goals for this month.</p>';
    return;
  }
  container.innerHTML = goals
    .map(
      (g) => `<div class="goal-row">
        <span>${escapeHtml(g.title)}</span>
        <span>${g.progress || 0}%</span>
      </div>`,
    )
    .join('');
}

export function renderChart(container, labels, values) {
  if (!container) return;
  const max = Math.max(...values, 1);
  container.innerHTML = labels
    .map((label, i) => {
      const h = Math.round((values[i] / max) * 100);
      return `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(h, 4)}%"></div><div class="chart-bar-label">${label}</div></div>`;
    })
    .join('');
}

export function getWeeklyChartData(tasks) {
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const values = labels.map((_, i) => {
    const d = getDateOffset(getTodayStr(), i - new Date(`${getTodayStr()}T12:00:00`).getDay());
    const dayTasks = tasks.filter((t) => t.date === d);
    if (!dayTasks.length) return 0;
    return Math.round((dayTasks.filter((t) => t.done).length / dayTasks.length) * 100);
  });
  return { labels, values };
}

export function getMonthlyChartData(tasks) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const labels = [];
  const values = [];
  for (let w = 0; w < 4; w++) {
    const start = w * 7 + 1;
    const end = Math.min(start + 6, daysInMonth);
    if (start > daysInMonth) break;
    labels.push(`W${w + 1}`);
    let total = 0;
    let done = 0;
    for (let d = start; d <= end; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter((t) => t.date === dateStr);
      total += dayTasks.length;
      done += dayTasks.filter((t) => t.done).length;
    }
    values.push(total ? Math.round((done / total) * 100) : 0);
  }
  return { labels, values };
}

export function renderTrashList(trash, container, onRestore) {
  if (!container) return;
  if (!trash.length) {
    container.innerHTML = '<p class="week-empty">Nothing in trash.</p>';
    return;
  }
  container.innerHTML = trash
    .slice(0, 10)
    .map(
      (entry) => `<div class="trash-item">
        <span>${escapeHtml(entry.item?.text || entry.item?.title || 'Item')} <small>(${entry.type})</small></span>
        <button type="button" class="btn-ghost" data-id="${entry.id}">Restore</button>
      </div>`,
    )
    .join('');
  container.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => onRestore(btn.dataset.id));
  });
}

export function renderHistoryList(history, container) {
  if (!container) return;
  if (!history.length) {
    container.innerHTML = '<p class="week-empty">No history yet.</p>';
    return;
  }
  container.innerHTML = history
    .slice(0, 5)
    .map(
      (h) => `<div class="history-item">
        <span>${new Date(h.timestamp).toLocaleString()} — ${h.tasks?.length || 0} tasks</span>
      </div>`,
    )
    .join('');
}

export function renderBackupBanner(message, container, onExport) {
  if (!container) return;
  if (!message) {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }
  container.classList.add('show');
  container.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" class="btn-primary-sm" id="bannerExportBtn">Backup now</button>`;
  container.querySelector('#bannerExportBtn')?.addEventListener('click', onExport);
}

export function updatePrioritySelectStyle(select) {
  if (!select) return;
  select.classList.remove('priority-select-high', 'priority-select-medium', 'priority-select-low');
  select.classList.add(`priority-select-${select.value || 'medium'}`);
}

export function categoryTag(category) {
  const cat = CATEGORIES[category] || CATEGORIES.work;
  return `<span class="cat-tag" style="background:${cat.color}">${cat.label}</span>`;
}

export function renderSubtasks(subtasks, taskId, onToggle) {
  if (!subtasks?.length) return '';
  return `<div class="subtask-list">${subtasks
    .map(
      (s, i) => `<label class="subtask-item${s.done ? ' done' : ''}">
        <input type="checkbox" data-task="${taskId}" data-idx="${i}" ${s.done ? 'checked' : ''} /> ${escapeHtml(s.text)}
      </label>`,
    )
    .join('')}</div>`;
}

let notifiedIds = new Set();

export function startReminderChecker(tasks, events, showToast) {
  if (!('Notification' in window)) return;

  setInterval(() => {
    const now = new Date();
    const today = getTodayStr();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    [...tasks.filter((t) => t.date === today && t.time), ...events.filter((e) => e.date === today && e.time && e.reminder)]
      .forEach((item) => {
        const key = `${item.id}_${today}`;
        if (item.time?.slice(0, 5) !== timeStr || notifiedIds.has(key)) return;
        notifiedIds.add(key);
        const title = item.text || item.title;
        if (Notification.permission === 'granted') {
          new Notification('Napaxtime Reminder', { body: title });
        }
        showToast(`Reminder: ${title}`);
      });
  }, 30000);
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return false;
}

export function parseSubtasks(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line, done: false }));
}

export function formatSubtasksForEdit(subtasks) {
  return (subtasks || []).map((s) => s.text).join('\n');
}
