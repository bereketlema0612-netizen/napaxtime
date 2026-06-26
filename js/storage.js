import { generateId, getTodayStr } from './utils.js';

export const KEYS = {
  tasks: 'napaxtime_tasks',
  events: 'napaxtime_events',
  settings: 'napaxtime_settings',
  routines: 'napaxtime_routines',
  theme: 'napaxtime_theme',
  habits: 'napaxtime_habits',
  goals: 'napaxtime_goals',
  trash: 'napaxtime_trash',
  history: 'napaxtime_history',
  lastBackup: 'napaxtime_last_backup',
};

export const CATEGORIES = {
  work: { label: 'Work', color: '#4f6ef7' },
  health: { label: 'Health', color: '#2d9b6e' },
  family: { label: 'Family', color: '#e85a5a' },
  faith: { label: 'Faith', color: '#8b5cf6' },
  finance: { label: 'Finance', color: '#d4a14a' },
  routine: { label: 'Routine', color: '#64748b' },
};

export const DEFAULT_SETTINGS = {
  userName: '',
  defaultTab: 'home',
  focusMode: false,
  lastBackup: null,
  cloudSyncEnabled: false,
  deviceId: null,
  quickChips: [
    { emoji: '💪', text: 'gym' },
    { emoji: '📊', text: 'trade' },
    { emoji: '📖', text: 'bible study' },
    { emoji: '🎬', text: 'video editing' },
    { emoji: '❤️', text: 'help mother' },
  ],
};

export const DEFAULT_ROUTINES = [
  { id: 'routine_gym', text: 'gym', priority: 'high', time: '06:00', days: [1, 2, 3, 4, 5] },
  { id: 'routine_bible', text: 'bible study', priority: 'medium', time: '07:00', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'routine_trade', text: 'trade', priority: 'medium', time: '09:00', days: [1, 2, 3, 4, 5] },
];

const MAX_HISTORY = 20;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full */
  }
}

export function generateDeviceId() {
  return `device_${generateId()}`;
}

export function loadTasks() {
  const tasks = readJson(KEYS.tasks, []);
  tasks.forEach((t, i) => {
    if (t.order === undefined) t.order = i;
    if (!t.date) t.date = getTodayStr();
  });
  return tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function saveTasks(tasks) {
  writeJson(KEYS.tasks, tasks);
}

export function loadEvents() {
  return readJson(KEYS.events, []);
}

export function saveEvents(events) {
  writeJson(KEYS.events, events);
}

export function loadSettings() {
  const stored = readJson(KEYS.settings, {});
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  const storedBackup = localStorage.getItem(KEYS.lastBackup);
  if (!settings.lastBackup && storedBackup) {
    settings.lastBackup = storedBackup;
  }

  if (!settings.deviceId) {
    settings.deviceId = generateDeviceId();
    saveSettings(settings);
  }

  return settings;
}

export function saveSettings(settings) {
  writeJson(KEYS.settings, settings);
  if (settings.lastBackup) {
    localStorage.setItem(KEYS.lastBackup, settings.lastBackup);
  }
}

export function loadRoutines() {
  const routines = readJson(KEYS.routines, null);
  return routines ?? DEFAULT_ROUTINES;
}

export function saveRoutines(routines) {
  writeJson(KEYS.routines, routines);
}

export function loadHabits() {
  return readJson(KEYS.habits, []);
}

export function saveHabits(habits) {
  writeJson(KEYS.habits, habits);
}

export function loadGoals() {
  return readJson(KEYS.goals, []);
}

export function saveGoals(goals) {
  writeJson(KEYS.goals, goals);
}

export function loadTrash() {
  return readJson(KEYS.trash, []);
}

export function saveTrash(trash) {
  writeJson(KEYS.trash, trash);
}

export function loadHistory() {
  return readJson(KEYS.history, []);
}

export function saveHistory(history) {
  writeJson(KEYS.history, history);
}

export function pushToTrash(item, type) {
  const trash = loadTrash();
  const entry = {
    id: generateId(),
    item,
    type,
    deletedAt: new Date().toISOString(),
  };
  trash.unshift(entry);
  saveTrash(trash);
  return entry;
}

export function restoreFromTrash(id) {
  const trash = loadTrash();
  const idx = trash.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const [entry] = trash.splice(idx, 1);
  saveTrash(trash);
  return entry;
}

export function pushHistory(snapshot) {
  const history = loadHistory();
  history.unshift({
    tasks: snapshot.tasks ?? [],
    events: snapshot.events ?? [],
    habits: snapshot.habits ?? [],
    goals: snapshot.goals ?? [],
    timestamp: new Date().toISOString(),
  });
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
  saveHistory(history);
}

export function loadTheme() {
  return localStorage.getItem(KEYS.theme) || 'dark';
}

export function saveTheme(theme) {
  localStorage.setItem(KEYS.theme, theme);
}

export function exportAllData(tasks, events, settings, routines, habits, goals, trash) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    app: 'Napaxtime',
    tasks,
    events,
    settings,
    routines,
    habits: habits ?? loadHabits(),
    goals: goals ?? loadGoals(),
    trash: trash ?? loadTrash(),
  };
}

export function importAllData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file.');
  if (payload.tasks) saveTasks(payload.tasks);
  if (payload.events) saveEvents(payload.events);
  if (payload.settings) saveSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
  if (payload.routines) saveRoutines(payload.routines);
  if (payload.habits) saveHabits(payload.habits);
  if (payload.goals) saveGoals(payload.goals);
  if (payload.trash) saveTrash(payload.trash);
}

export function applyDailyRoutines(tasks, routines, todayStr) {
  const day = new Date(`${todayStr}T12:00:00`).getDay();
  let changed = false;

  routines.forEach((routine) => {
    if (!routine.days?.includes(day)) return;
    const exists = tasks.some(
      (t) => t.date === todayStr && t.text.toLowerCase() === routine.text.toLowerCase() && t.recurringId === routine.id,
    );
    if (exists) return;
    tasks.push({
      id: generateId(),
      text: routine.text,
      priority: routine.priority || 'medium',
      done: false,
      time: routine.time || null,
      date: todayStr,
      order: tasks.length,
      recurringId: routine.id,
      category: 'routine',
    });
    changed = true;
  });

  return changed;
}

export function applyRecurringTasks(tasks, todayStr) {
  const day = new Date(`${todayStr}T12:00:00`).getDay();
  let changed = false;

  tasks.forEach((template) => {
    if (!template.recurring) return;

    const { frequency, days = [] } = template.recurring;
    if (frequency === 'weekly' && !days.includes(day)) return;
    if (frequency !== 'daily' && frequency !== 'weekly') return;

    const exists = tasks.some(
      (t) => t.date === todayStr && t.recurringId === template.id && !t.recurring,
    );
    if (exists) return;

    tasks.push({
      id: generateId(),
      text: template.text,
      priority: template.priority || 'medium',
      done: false,
      time: template.time || null,
      date: todayStr,
      order: tasks.length,
      recurringId: template.id,
      category: template.category || 'routine',
    });
    changed = true;
  });

  return changed;
}

export function checkBackupReminder(settings) {
  const last = settings?.lastBackup;
  if (!last) {
    return 'You have never backed up your data. Consider exporting a backup.';
  }

  const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince > 30) {
    return `Your last backup was ${daysSince} days ago. Consider backing up your data.';
  }

  return null;
}
