import type { Project, Task } from './types';
import { isOverdue, localDate, parseDate, today } from './utils';

export type DeadlineFilter = 'all' | 'soon' | 'overdue';
export type StatusFilter = 'open' | 'all' | Task['status'];

export function parseRoute(hash: string) {
  const [path, query] = hash.startsWith('#/') ? hash.slice(1).split('?', 2) : ['/overview'];
  return { path, params: new URLSearchParams(query) };
}

export function routeWith(path: string, parameters: Record<string, string | null>) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(parameters)) if (value) query.set(name, value);
  return `${path}${query.size ? `?${query}` : ''}`;
}

export function matchesTask(task: Task, status: StatusFilter, deadline: DeadlineFilter, date = today()) {
  if (status === 'open' && task.status === 'done') return false;
  if (status !== 'open' && status !== 'all' && task.status !== status) return false;
  if (deadline === 'overdue') return isOverdue(task, date);
  if (deadline === 'soon') {
    const end = parseDate(date);
    end.setDate(end.getDate() + 6);
    return task.status !== 'done' && task.due_date >= date && task.due_date <= localDate(end);
  }
  return true;
}

export function matchesProject(project: Project, status: string) {
  return status === 'archived' ? project.archived : !project.archived && (status === 'all' || project.status === status);
}

export function studioTasks(projects: Project[], tasks: Task[]) {
  const visible = new Set(projects.filter(project => !project.archived).map(project => project.id));
  return tasks.filter(task => visible.has(task.project_id));
}

export function dashboardMetrics(projects: Project[], tasks: Task[], date = today()) {
  const visible = studioTasks(projects, tasks);
  return {
    active: projects.filter(project => matchesProject(project, 'active')).length,
    open: visible.filter(task => matchesTask(task, 'open', 'all', date)).length,
    soon: visible.filter(task => matchesTask(task, 'open', 'soon', date)).length,
    overdue: visible.filter(task => matchesTask(task, 'open', 'overdue', date)).length,
  };
}

export const taskStatuses: Task['status'][] = ['todo', 'in_progress', 'done'];
export function sortTasks(a: Task, b: Task) {
  return (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.title.localeCompare(b.title);
}
