/** Local-date helpers (fixes UTC timezone bugs) */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStr() {
  return toDateStr(new Date());
}

export function getDateOffset(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function dateFromParts(year, month, day) {
  return toDateStr(new Date(year, month, day));
}

export function formatDateNice(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getMonthName(m) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
}

export function daysUntil(dateStr) {
  const today = new Date(`${getTodayStr()}T12:00:00`);
  const target = new Date(`${dateStr}T12:00:00`);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
