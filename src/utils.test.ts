import { describe, expect, it } from 'vitest';
import { calendarDays, isOverdue, localDate, progress, safeUrl } from './utils';

describe('deadline and project calculations', () => {
  it('does not mark due-today or completed tasks overdue', () => {
    expect(isOverdue({ due_date: '2026-11-24', status: 'todo' }, '2026-11-24')).toBe(false);
    expect(isOverdue({ due_date: '2026-11-23', status: 'done' }, '2026-11-24')).toBe(false);
    expect(isOverdue({ due_date: '2026-11-23', status: 'in_progress' }, '2026-11-24')).toBe(true);
    expect(isOverdue({ due_date: '', status: 'todo' }, '2026-11-24')).toBe(false);
  });
  it('handles empty projects and rounds completion', () => {
    expect(progress([])).toBe(0);
    expect(progress([{ status: 'done' }, { status: 'todo' }, { status: 'in_progress' }])).toBe(33);
  });
  it('includes adjacent months in a Monday-first six-week calendar', () => {
    const days = calendarDays(2026, 10);
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(localDate(days[0])).toBe('2026-10-26');
    expect(days.filter(d => d.getMonth() === 10)).toHaveLength(30);
  });
});
describe('reference links', () => {
  it('rejects executable and malformed URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,test')).toBeNull();
    expect(safeUrl('not-a-url')).toBeNull();
    expect(safeUrl('https://example.com/drawings')).toBe('https://example.com/drawings');
  });
});
