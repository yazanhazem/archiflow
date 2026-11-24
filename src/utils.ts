import type { Lang, Task } from './types';

export function today() { return localDate(new Date()); }
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value: string) { return new Date(`${value}T12:00:00`); }
export function formatDate(value: string, lang: Lang, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', options).format(value.length === 10 ? parseDate(value) : new Date(value));
}
export function isOverdue(task: Pick<Task, 'due_date' | 'status'>, date = today()) {
  return Boolean(task.due_date && task.due_date < date && task.status !== 'done');
}
export function progress(tasks: Pick<Task, 'status'>[]) {
  return tasks.length ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100) : 0;
}
export function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase(); }
export function safeUrl(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error); }
export function calendarDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
