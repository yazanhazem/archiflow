import { CalendarDays, Columns3, Layers3, Plus } from 'lucide-react';
import { Empty, PageHead, SectionHead, TaskRow } from './components';
import { useApp } from './context';
import { TaskForm } from './forms';
import type { Phase, Project, Task } from './types';
import { formatDate, isOverdue, today } from './utils';
import { matchesTask, routeWith, sortTasks, studioTasks, taskStatuses } from './workspaceRoutes';
import type { DeadlineFilter, StatusFilter } from './workspaceRoutes';

export function NewTask({ projectId, phaseId, label = 'New task' }: { projectId?: string; phaseId?: string; label?: string }) {
  const { t, openModal } = useApp();
  return <button className={`button ${label === 'Add task' ? 'secondary small-button' : 'primary'}`} onClick={() => openModal(t('New task'), <TaskForm projectId={projectId} phaseId={phaseId}/>)}>
    <Plus size={17}/>{t(label)}
  </button>;
}

export function taskControls(task: Task, app: ReturnType<typeof useApp>) {
  const archived = app.studio.data.projects.find(project => project.id === task.project_id)?.archived;
  return {
    onEdit: () => app.openModal(app.t(archived ? 'Task details' : 'Edit task'), <TaskForm task={task}/>),
    onToggle: () => void app.run(() => app.studio.save('tasks', { status: task.status === 'done' ? 'todo' : 'done' }, task.id), 'Changes saved'),
  };
}

export function Tasks() {
  const app = useApp();
  const { studio: { data }, params, navigate, t } = app;
  const statuses: StatusFilter[] = ['open', 'all', ...taskStatuses];
  const requestedStatus = params.get('status') as StatusFilter | null;
  const status = requestedStatus && statuses.includes(requestedStatus) ? requestedStatus : 'open';
  const requestedDeadline = params.get('deadline');
  const deadline: DeadlineFilter = requestedDeadline === 'soon' || requestedDeadline === 'overdue' ? requestedDeadline : 'all';
  const requestedAssignee = params.get('assignee') ?? 'me';
  const assignee = ['all', 'me', 'unassigned'].includes(requestedAssignee) || data.members.some(m => m.user_id === requestedAssignee) ? requestedAssignee : 'me';
  const project = data.projects.find(p => p.id === params.get('project') && !p.archived)?.id ?? 'all';
  const visible = studioTasks(data.projects, data.tasks);
  const date = today();
  const tasks = visible.filter(task => {
    if (assignee === 'unassigned' && task.assignee_id) return false;
    if (!['all', 'unassigned'].includes(assignee) && task.assignee_id !== (assignee === 'me' ? data.profile.id : assignee)) return false;
    return (project === 'all' || task.project_id === project) && matchesTask(task, status, deadline, date);
  }).sort(sortTasks);
  const filter = (key: string, value: string) => navigate(routeWith('/tasks', { status, deadline, assignee, project, [key]: value }));
  return <>
    <PageHead title={assignee === 'me' ? 'My tasks' : 'Studio tasks'} action={<NewTask/>}/>
    <div className="filter-bar task-filters">
      <div className="filter-tabs" role="group" aria-label={t('Status')}>
        {statuses.map(value => <button key={value} className={value === status ? 'selected' : ''} aria-pressed={value === status} onClick={() => filter('status', value)}>{t(value === 'open' ? 'Open tasks' : value === 'all' ? 'All tasks' : value)}</button>)}
      </div>
      <div className="filter-selects">
        <select aria-label={t('Assignee')} value={assignee} onChange={e => filter('assignee', e.target.value)}>
          <option value="all">{t('All assignees')}</option><option value="me">{t('Assigned to me')}</option><option value="unassigned">{t('Unassigned')}</option>
          {data.members.filter(m => m.user_id !== data.profile.id).map(m => <option key={m.id} value={m.user_id}>{m.full_name}</option>)}
        </select>
        <select aria-label={t('Project')} value={project} onChange={e => filter('project', e.target.value)}>
          <option value="all">{t('All projects')}</option>{data.projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label={t('Deadline')} value={deadline} onChange={e => filter('deadline', e.target.value)}>
          <option value="all">{t('All deadlines')}</option><option value="soon">{t('Due in 7 days')}</option><option value="overdue">{t('Overdue tasks')}</option>
        </select>
      </div>
    </div>
    <section className="panel task-panel">
      <div className="task-table-head"><span>{t('Task')}</span><span>{t('Priority')}</span><span>{t('Deadline')}</span><span>{t('Assignee')}</span></div>
      {tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} {...taskControls(task, app)}/>) : visible.length
        ? <Empty title="No matching tasks" action={<a className="button secondary" href="#/tasks?assignee=all&status=all">{t('Clear filters')}</a>}/>
        : <Empty title="No tasks yet" action={<NewTask/>}/>}
    </section>
  </>;
}

export function ProjectTasks({ project, phases, tasks }: { project: Project; phases: Phase[]; tasks: Task[] }) {
  const app = useApp();
  const { t, lang, params, studio, busy, run } = app;
  const view = params.get('view') === 'board' ? 'board' : 'phase';
  const number = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB');
  const sorted = [...tasks].sort(sortTasks);
  const phaseNames = new Map(phases.map(phase => [phase.id, t(phase.name)]));
  const groups = [...phases.map(phase => ({ id: phase.id, label: phase.name })), { id: '', label: 'Unphased' }];
  const path = `/projects/${project.id}`;
  return <>
    <div className="project-task-toolbar">
      <nav className="filter-tabs task-view-switch" aria-label={t('Task view')}>
        <a aria-current={view === 'phase' ? 'page' : undefined} href={`#${routeWith(path, { tab: 'tasks', view: 'phase' })}`}><Layers3 size={17}/>{t('By phase')}</a>
        <a aria-current={view === 'board' ? 'page' : undefined} href={`#${routeWith(path, { tab: 'tasks', view: 'board' })}`}><Columns3 size={17}/>{t('Status board')}</a>
      </nav>
      {!project.archived && <NewTask projectId={project.id}/>}
    </div>
    {project.archived && <p className="archived-notice">{t('This project is archived. Tasks are read-only.')}</p>}
    {view === 'phase' ? <div className="phase-task-groups">
      {groups.map(group => {
        const items = sorted.filter(task => group.id ? task.phase_id === group.id : !task.phase_id || !phaseNames.has(task.phase_id));
        const complete = items.filter(task => task.status === 'done').length;
        return <section className="panel phase-task-group" key={group.id}>
          <SectionHead title={group.label} extra={<div className="phase-task-actions">
            <span className="phase-count">{number.format(complete)} / {number.format(items.length)} {t('tasks complete')}</span>
            {!project.archived && <NewTask projectId={project.id} phaseId={group.id || undefined} label="Add task"/>}
          </div>}/>
          {items.length ? items.map(task => <TaskRow key={task.id} task={task} {...taskControls(task, app)}/>) : <p className="padded muted">{t('No tasks in this phase.')}</p>}
        </section>;
      })}
    </div> : <div className="status-board">
      {taskStatuses.map(status => {
        const items = sorted.filter(task => task.status === status);
        return <section className={`panel board-column column-${status}`} key={status}>
          <SectionHead title={status} extra={<span className="count-badge">{number.format(items.length)}</span>}/>
          <div className="board-cards">{items.length ? items.map(task => {
            const member = studio.data.members.find(m => m.user_id === task.assignee_id);
            return <article className="board-card" key={task.id}>
              <button className="board-task-title" onClick={taskControls(task, app).onEdit}>{task.title}</button>
              <div className="board-meta"><span>{phaseNames.get(task.phase_id ?? '') ?? t('Unphased')}</span><span>{member?.full_name || t('Unassigned')}</span></div>
              <div className="board-meta"><span className={`priority priority-${task.priority}`}><i/>{t(task.priority)}</span><span className={`board-due ${isOverdue(task) ? 'overdue' : ''}`}><CalendarDays size={15}/>{task.due_date ? formatDate(task.due_date, lang) : t('No deadline')}</span></div>
              {!project.archived && <select aria-label={`${t('Change status')}: ${task.title}`} value={task.status} disabled={busy || !studio.canWrite} onChange={event => {
                const next = event.target.value as Task['status'];
                void run(async () => {
                  await studio.save('tasks', { status: next }, task.id);
                  requestAnimationFrame(() => document.getElementById(`task-status-${task.id}`)?.focus());
                }, 'Changes saved');
              }} id={`task-status-${task.id}`}>{taskStatuses.map(value => <option key={value} value={value}>{t(value)}</option>)}</select>}
            </article>;
          }) : <p className="board-empty muted">{t('No tasks in this status.')}</p>}</div>
        </section>;
      })}
    </div>}
  </>;
}
