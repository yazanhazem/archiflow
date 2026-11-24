import { describe, expect, it } from 'vitest';
import type { Project, Task } from './types';
import { dashboardMetrics, matchesProject, matchesTask, parseRoute, routeWith, studioTasks } from './workspaceRoutes';
import type { DeadlineFilter } from './workspaceRoutes';

const date = '2026-12-28';
const project = (id: string, archived = false, status: Project['status'] = 'active'): Project => ({
  id, archived, status, studio_id: 'one', name: id, client: '', description: '', start_date: '', due_date: '',
  current_phase: null, notes: '', links: [], cover: 0, created_at: '',
});
const task = (id: string, due_date: string, status: Task['status'] = 'todo', project_id = 'live'): Task => ({
  id, due_date, status, project_id, studio_id: 'one', phase_id: null, title: id,
  description: '', assignee_id: null, priority: 'medium', created_at: '',
});

describe('dashboard filters', () => {
  const projects = [project('live'), project('archived', true), project('planning', false, 'planning')];
  const tasks = [
    task('before', '2026-12-27'), task('today', date), task('last', '2027-01-03', 'in_progress'),
    task('after', '2027-01-04'), task('undated', ''), task('done', date, 'done'),
    task('history', date, 'todo', 'archived'), task('missing', date, 'todo', 'missing'),
  ];

  it('includes today and six following dates through a year boundary', () => {
    expect(tasks.filter(item => matchesTask(item, 'open', 'soon', date)).map(item => item.id)).toEqual(['today', 'last', 'history', 'missing']);
    expect(tasks.filter(item => matchesTask(item, 'open', 'overdue', date)).map(item => item.id)).toEqual(['before']);
  });

  it('matches the result counts for the four dashboard destinations', () => {
    const metrics = dashboardMetrics(projects, tasks, date);
    const visible = studioTasks(projects, tasks);
    expect(metrics).toEqual({ active: 1, open: 5, soon: 2, overdue: 1 });
    expect(projects.filter(p => matchesProject(p, 'active'))).toHaveLength(metrics.active);
    const destinations: [keyof typeof metrics, DeadlineFilter][] = [['open', 'all'], ['soon', 'soon'], ['overdue', 'overdue']];
    for (const [metric, deadline] of destinations) {
      const href = routeWith('/tasks', { assignee: 'all', status: 'open', deadline });
      const { path, params } = parseRoute(`#${href}`);
      expect(path).toBe('/tasks');
      expect(params.get('assignee')).toBe('all');
      expect(visible.filter(item => matchesTask(item, 'open', params.get('deadline') as DeadlineFilter, date))).toHaveLength(metrics[metric]);
    }
  });
});
