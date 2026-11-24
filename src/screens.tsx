import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, FolderClosed, Grid2X2, Link2, List, MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from './context';
import { Avatar, Badge, Building, Confirm, Empty, PageHead, ProjectCard, SectionHead, TaskRow } from './components';
import { Field, InviteForm, LinkForm, ProjectForm, RenamePhase, TaskForm } from './forms';
import type { Project } from './types';
import { calendarDays, formatDate, localDate, progress, safeUrl, today } from './utils';
import { dashboardMetrics, matchesProject, routeWith, sortTasks, studioTasks } from './workspaceRoutes';
import { NewTask, ProjectTasks, taskControls } from './TaskViews';
import type { Theme } from './theme';

function NewProject() { const { t, openModal } = useApp(); return <button className="button primary" onClick={() => openModal(t('New project'), <ProjectForm/>)}><Plus size={17}/>{t('New project')}</button>; }
export function SearchResults() {
  const app = useApp();
  const { studio: { data }, closeModal, t } = app;
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase();
  const projects = search ? data.projects.filter(p => `${p.name} ${p.client} ${p.description}`.toLocaleLowerCase().includes(search)) : [];
  const names = new Map(data.projects.map(p => [p.id, p.name]));
  const tasks = search ? studioTasks(data.projects, data.tasks).filter(task => `${task.title} ${task.description} ${names.get(task.project_id) ?? ''}`.toLocaleLowerCase().includes(search)) : [];
  return <div className="studio-search">
    <div className="search-input-wrap"><Search size={18}/><input aria-label={t('Search projects and tasks…')} placeholder={t('Search projects and tasks…')} type="search" value={query} onChange={event => setQuery(event.target.value)}/></div>
    <div className="search-results" aria-live="polite">
      {search && !projects.length && !tasks.length && <p>{t('No matching projects or tasks.')}</p>}
      {projects.length > 0 && <section><SectionHead title="Projects"/>{projects.map(project => <a key={project.id} href={`#/projects/${project.id}`} onClick={closeModal}><strong>{project.name}</strong>{project.client && <small>{project.client}</small>}</a>)}</section>}
      {tasks.length > 0 && <section><SectionHead title="Tasks"/>{tasks.map(task => <button key={task.id} onClick={taskControls(task, app).onEdit}><strong>{task.title}</strong><small>{names.get(task.project_id)}</small></button>)}</section>}
    </div>
  </div>;
}
function ActivityFeed({ projectId, limit = 6 }: { projectId?: string; limit?: number }) {
  const { studio: { data }, t, lang } = useApp();
  const items = data.activities.filter(a => !projectId || a.project_id === projectId).slice(0, limit);
  return items.length ? <div className="activity-feed">{items.map(a => { const member = data.members.find(m => m.user_id === a.actor_id); return <div className="activity-item" key={a.id}><Avatar name={member?.full_name ?? t('Someone')} small index={Math.max(0, data.members.findIndex(m => m.user_id === a.actor_id))}/><div><p><strong>{member?.full_name ?? t('Someone')}</strong> {t(a.action)} <span>{t(a.subject)}</span></p><time>{formatDate(a.created_at, lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div></div>; })}</div> : <p className="muted padded">{t('No activity yet.')}</p>;
}

export function Overview() {
  const app = useApp(); const { studio: { data }, t, lang, navigate } = app;
  const projects = data.projects.filter(p => matchesProject(p, 'all'));
  const tasks = studioTasks(data.projects, data.tasks);
  const date = today();
  const metrics = dashboardMetrics(data.projects, data.tasks, date);
  const upcoming = tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date >= date).sort(sortTasks).slice(0, 4);
  const mine = tasks.filter(task => task.assignee_id === data.profile.id && task.status !== 'done').sort(sortTasks).slice(0, 5);
  const stats = [
    { label: 'Active projects', value: metrics.active, href: '/projects?status=active', icon: FolderClosed, color: 'green' },
    { label: 'Open tasks', value: metrics.open, href: '/tasks?assignee=all&status=open', icon: CheckCheck, color: 'blue' },
    { label: 'Due in 7 days', value: metrics.soon, href: '/tasks?assignee=all&status=open&deadline=soon', icon: CalendarDays, color: 'amber' },
    { label: 'Overdue tasks', value: metrics.overdue, href: '/tasks?assignee=all&status=open&deadline=overdue', icon: AlertCircle, color: 'red' },
  ];
  return <>
    <PageHead eyebrow={formatDate(date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} title="Studio overview" action={<NewProject/>}/>
    <div className="stats-grid">{stats.map(s => <a className="stat-card" key={s.label} href={`#${s.href}`}><div className="stat-top"><span>{t(s.label)}</span><span className={`stat-icon ${s.color}`}><s.icon size={18}/></span></div><strong>{s.value.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</strong></a>)}</div>
    <SectionHead title="Recent projects" extra={<button className="text-button" onClick={() => navigate('/projects')}>{t('View all')}</button>}/>
    <div className="projects-grid">{projects.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} eager/>)}{!projects.length && <Empty title="No projects yet" action={<NewProject/>}/>}</div>
    <div className="dashboard-bottom"><section className="panel"><SectionHead title="My tasks" extra={<button className="text-button" onClick={() => navigate('/tasks')}>{t('View all')}</button>}/>{mine.length ? <div className="task-list">{mine.map(task => <TaskRow key={task.id} task={task} {...taskControls(task, app)}/>)}</div> : <Empty title="No open tasks assigned to you"/>}</section>
    <section className="panel deadline-panel"><SectionHead title="Coming up" extra={<CalendarDays size={17} className="muted"/>}/>{upcoming.length ? upcoming.map(task => <button key={task.id} className="deadline-item" onClick={() => app.openModal(t('Edit task'), <TaskForm task={task}/>)}><span className="date-tile"><small>{formatDate(task.due_date, lang, { month: 'short' })}</small><strong>{formatDate(task.due_date, lang, { day: '2-digit' })}</strong></span><span><strong>{task.title}</strong><small>{data.projects.find(p => p.id === task.project_id)?.name}</small></span></button>) : <Empty title="No upcoming deadlines"/>}<button className="calendar-link text-button" onClick={() => navigate('/calendar')}>{t('View calendar')}</button></section></div>
    <section className="panel studio-feed"><SectionHead title="Studio activity"/><ActivityFeed limit={3}/></section>
  </>;
}

export function Projects() {
  const { studio: { data }, params, navigate, t } = useApp();
  const statuses = ['all', 'active', 'planning', 'on_hold', 'completed', 'archived'];
  const requestedStatus = params.get('status') ?? 'all';
  const status = statuses.includes(requestedStatus) ? requestedStatus : 'all';
  const view = params.get('view') === 'list' ? 'list' : 'grid';
  const projects = data.projects.filter(project => matchesProject(project, status));
  return <>
    <PageHead title="Projects" action={<NewProject/>}/>
    <div className="filter-bar">
      <div className="filter-tabs" role="group" aria-label={t('Status')}>
        {statuses.map(value => <button key={value} className={value === status ? 'selected' : ''} aria-pressed={value === status} onClick={() => navigate(routeWith('/projects', { status: value, view }))}>{t(value === 'all' ? 'All projects' : value === 'archived' ? 'Archived' : value)}</button>)}
      </div>
      <div className="view-switch">
        <button className={view === 'grid' ? 'selected' : ''} aria-pressed={view === 'grid'} aria-label={t('Grid view')} onClick={() => navigate(routeWith('/projects', { status, view: 'grid' }))}><Grid2X2 size={17}/></button>
        <button className={view === 'list' ? 'selected' : ''} aria-pressed={view === 'list'} aria-label={t('List view')} onClick={() => navigate(routeWith('/projects', { status, view: 'list' }))}><List size={18}/></button>
      </div>
    </div>
    {projects.length ? <div className={view === 'grid' ? 'projects-grid' : 'projects-list'}>{projects.map(p => <ProjectCard key={p.id} project={p} list={view === 'list'}/>)}</div> : <Empty title={data.projects.length ? 'No matching projects' : 'No projects yet'} action={data.projects.length ? <a className="button secondary" href="#/projects">{t('Clear filters')}</a> : <NewProject/>}/>}
  </>;
}

function Notes({ project }: { project: Project }) {
  const { t, studio, busy, run } = useApp(); const [notes, setNotes] = useState(project.notes); const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setNotes(project.notes); }, [project.notes, dirty]);
  return <section className="panel notes-panel"><SectionHead title="Notes"/><textarea readOnly={project.archived} aria-label={t('Notes')} placeholder={t('Add project notes…')} rows={7} maxLength={20000} value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }}/><button disabled={busy || !dirty || project.archived} className="button secondary" onClick={() => void run(async () => { await studio.save('projects', { notes }, project.id); setDirty(false); }, 'Changes saved')}>{t('Save notes')}</button></section>;
}
function Discussion({ project }: { project: Project }) {
  const { studio, t, lang, run, busy, openModal } = useApp(); const { data } = studio;
  const [body, setBody] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [editBody, setEditBody] = useState('');
  const comments = data.comments.filter(c => c.project_id === project.id);
  return <div className="panel discussion-panel"><SectionHead title="Discussion"/>{comments.length ? <div className="comments">{comments.map(c => { const member = data.members.find(m => m.user_id === c.author_id); return <article className="comment" key={c.id}><Avatar name={member?.full_name ?? t('Someone')} small index={Math.max(0, data.members.findIndex(m => m.user_id === c.author_id))}/><div className="comment-body"><div className="comment-meta"><strong>{member?.full_name ?? t('Someone')}</strong><time>{formatDate(c.created_at, lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>{c.updated_at !== c.created_at && <small>{t('Edited')}</small>}</div>{editing === c.id ? <form onSubmit={e => { e.preventDefault(); void run(async () => { await studio.save('comments', { body: editBody.trim() }, c.id); setEditing(null); }, 'Changes saved'); }}><textarea aria-label={t('Edit')} required maxLength={5000} value={editBody} onChange={e => setEditBody(e.target.value)}/><div className="inline-actions"><button disabled={busy || !editBody.trim()} className="button primary small-button">{t('Save')}</button><button type="button" className="text-button" onClick={() => setEditing(null)}>{t('Cancel')}</button></div></form> : <p>{c.body}</p>}{c.author_id === data.profile.id && !project.archived && editing !== c.id && <div className="comment-actions"><button className="text-button" onClick={() => { setEditing(c.id); setEditBody(c.body); }}>{t('Edit')}</button><button className="text-button" onClick={() => openModal(t('Delete comment?'), <Confirm text="This cannot be undone." onConfirm={() => studio.remove('comments', c.id)}/>)}>{t('Delete')}</button></div>}</div></article>; })}</div> : <Empty title="No comments yet" text="Start a conversation about this project."/>}<form className="comment-compose" onSubmit={e => { e.preventDefault(); void run(async () => { await studio.save('comments', { project_id: project.id, body: body.trim() }); setBody(''); }, 'Comment posted'); }}><textarea aria-label={t('Write a comment…')} placeholder={t('Write a comment…')} rows={3} required maxLength={5000} value={body} onChange={e => setBody(e.target.value)}/><button disabled={busy || !body.trim() || project.archived} className="button primary"><MessageSquare size={16}/>{t('Post comment')}</button></form></div>;
}

export function ProjectDetail({ id }: { id: string }) {
  const { studio, t, lang, navigate, openModal, run, busy, params } = useApp();
  const tabs = { overview: 'Overview', tasks: 'Tasks', discussion: 'Discussion', activity: 'Activity' };
  const requested = params.get('tab') ?? 'overview';
  const tab = Object.hasOwn(tabs, requested) ? requested : 'overview';
  const project = studio.data.projects.find(p => p.id === id);
  if (!project && studio.syncing) return <p role="status" className="padded">{t('Loading project…')}</p>;
  if (!project && studio.error) return <Empty title="Project data unavailable" text="Retry sync to load this project."/>;
  if (!project) return <Empty title="Project not found" action={<button className="button secondary" onClick={() => navigate('/projects')}>{t('Back to projects')}</button>}/>;
  const phases = studio.data.phases.filter(p => p.project_id === id).sort((a, b) => a.position - b.position); const tasks = studio.data.tasks.filter(task => task.project_id === id); const currentIndex = phases.findIndex(p => p.id === project.current_phase); const owner = studio.data.studio?.owner_id === studio.data.profile.id;
  return <><button className="text-button back-link" onClick={() => navigate('/projects')}><ChevronLeft size={15}/>{t('Back to projects')}</button><div className="project-detail-hero"><div><div className="eyebrow">{project.client || t('Project')}</div><h1>{project.name}</h1><p>{project.description || t('No description yet.')}</p><div className="project-detail-meta"><Badge value={project.archived ? 'Archived' : project.status}/><span><CalendarDays size={15}/>{formatDate(project.start_date, lang)} – {formatDate(project.due_date, lang)}</span></div><div className="inline-actions"><button disabled={project.archived} className="button secondary" onClick={() => openModal(t('Edit project'), <ProjectForm project={project}/>)}><Pencil size={14}/>{t('Edit project')}</button>{owner && <button className="text-button" disabled={busy} onClick={() => project.archived ? void run(() => studio.save('projects', { archived: false }, id), 'Changes saved') : openModal(t('Archive this project?'), <Confirm label="Archive" text="It will leave active views. Its tasks and history will be kept." onConfirm={() => studio.save('projects', { archived: true }, id)}/>)}>{t(project.archived ? 'Restore project' : 'Archive project')}</button>}</div></div><Building variant={project.cover}/></div><nav className="detail-tabs" aria-label={t('Project sections')}>
      {Object.entries(tabs).map(([key, label]) => <a key={key} aria-current={tab === key ? 'page' : undefined} href={'#' + routeWith('/projects/' + id, { tab: key === 'overview' ? null : key, view: key === 'tasks' ? params.get('view') : null })}>
        {t(label)}{key === 'tasks' && <span>{tasks.length}</span>}{key === 'discussion' && <span>{studio.data.comments.filter(c => c.project_id === id).length}</span>}
      </a>)}
    </nav>
    {tab === 'overview' && <><section className="panel phases-panel"><SectionHead title="Phases" extra={<span className="muted">{progress(tasks)}% {t('completed')}</span>}/><div className="phase-timeline">{phases.map((phase, i) => <div key={phase.id} className={`phase-step ${i === currentIndex ? 'current' : i < currentIndex ? 'complete' : ''}`}><button className="phase-circle" disabled={busy || project.archived} aria-label={`${t('Current phase')}: ${t(phase.name)}`} onClick={() => void run(() => studio.save('projects', { current_phase: phase.id }, id), 'Changes saved')}>{i < currentIndex ? <Check size={15}/> : i + 1}</button><strong>{t(phase.name)}</strong><button className="icon-button" disabled={project.archived} aria-label={`${t('Rename phase')}: ${t(phase.name)}`} onClick={() => openModal(t('Rename phase'), <RenamePhase id={phase.id} name={phase.name}/>)}><Pencil size={12}/></button></div>)}</div></section><div className="detail-columns"><Notes key={id} project={project}/><section className="panel links-panel"><SectionHead title="Reference links" extra={<button disabled={project.archived} className="icon-button" aria-label={t('Add link')} onClick={() => openModal(t('Add link'), <LinkForm project={project}/>)}><Plus size={18}/></button>}/>{project.links.length ? project.links.map((link, i) => <div className="reference" key={`${link.url}-${i}`}><Link2 size={17}/><a href={safeUrl(link.url) ?? undefined} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={13}/></a><button disabled={busy || project.archived} className="icon-button" aria-label={t('Remove link')} onClick={() => void run(() => studio.save('projects', { links: project.links.filter((_, index) => i !== index) }, id), 'Changes saved')}><Trash2 size={14}/></button></div>) : <p className="muted padded">{t('No reference links yet.')}</p>}</section></div></>}
    {tab === 'tasks' && <ProjectTasks project={project} phases={phases} tasks={tasks}/>} {tab === 'discussion' && <Discussion project={project}/>} {tab === 'activity' && <section className="panel"><SectionHead title="Activity"/><ActivityFeed projectId={id} limit={100}/></section>}
  </>;
}

export function Calendar() {
  const { studio: { data }, lang, t, openModal, navigate } = useApp(); const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const projects = data.projects.filter(p => !p.archived && p.status !== 'completed');
  const deadlines = [...data.tasks.filter(task => task.status !== 'done' && task.due_date && projects.some(p => p.id === task.project_id)).map(task => ({ id: task.id, title: task.title, date: task.due_date, project: task.project_id, task })), ...projects.filter(p => p.due_date).map(p => ({ id: p.id, title: p.name, date: p.due_date, project: p.id, task: null }))].sort((a, b) => a.date.localeCompare(b.date));
  const days = calendarDays(month.getFullYear(), month.getMonth());
  const selectedMonth = localDate(month).slice(0, 7);
  const open = (d: typeof deadlines[number]) => d.task ? openModal(t('Edit task'), <TaskForm task={d.task}/>) : navigate(`/projects/${d.project}`);
  return <><PageHead title="Calendar" action={<NewTask/>}/><section className="panel calendar-panel"><div className="calendar-toolbar"><h2>{formatDate(localDate(month), lang, { month: 'long', year: 'numeric' })}</h2><div><button className="button secondary small-button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{t('Today')}</button><button className="icon-button" aria-label={t('Previous month')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><button className="icon-button" aria-label={t('Next month')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18}/></button></div></div><div className="calendar-grid"><div className="weekdays">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <span key={day}>{lang === 'ar' ? t(day) : day.slice(0, 3)}</span>)}</div><div className="calendar-days">{days.map(day => { const date = localDate(day); return <div className={`calendar-day ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${date === today() ? 'today' : ''}`} key={date}><span className="day-number">{day.getDate().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>{deadlines.filter(d => d.date === date).map(d => <button className={`calendar-event cover-${data.projects.find(p => p.id === d.project)?.cover ?? 0}`} key={d.id} onClick={() => open(d)} title={d.title}>{d.task ? '' : '◈ '}{d.title}</button>)}</div>; })}</div></div><div className="calendar-agenda">{deadlines.filter(d => d.date.startsWith(selectedMonth)).map(d => <button key={d.id} className="agenda-item" onClick={() => open(d)}><span className="date-tile"><small>{formatDate(d.date, lang, { month: 'short' })}</small><strong>{formatDate(d.date, lang, { day: 'numeric' })}</strong></span><span><strong>{d.title}</strong><small>{d.task ? data.projects.find(p => p.id === d.project)?.name : t('Project deadline')}</small></span></button>)}{!deadlines.some(d => d.date.startsWith(selectedMonth)) && <Empty title="No deadlines this month"/>}</div></section></>;
}

export function Team() {
  const { studio, t, lang, openModal, run, busy } = useApp(); const { data } = studio; const owner = data.studio?.owner_id === data.profile.id;
  return <><PageHead title="Team" action={owner && <button className="button primary" onClick={() => openModal(t('Invite member'), <InviteForm/>)}><Plus size={17}/>{t('Invite member')}</button>}/><section className="panel team-panel"><SectionHead title="Team members" extra={<span className="count-badge">{data.members.length}</span>}/>{data.members.map((member, i) => <div className="member-row" key={member.id}><Avatar name={member.full_name} index={i}/><div><strong>{member.full_name} {member.user_id === data.profile.id && <small>({t('You')})</small>}</strong><span>{t(member.role === 'owner' ? 'Studio workspace' : 'Member')}</span></div><Badge value={member.role}/>{owner && member.role !== 'owner' && <button className="text-button danger-text" onClick={() => openModal(t('Remove this member?'), <Confirm text="They will lose access to this studio." label="Remove" onConfirm={() => studio.rpc('remove_member', { target_user_id: member.user_id })}/>)}>{t('Remove')}</button>}</div>)}</section>{owner && <section className="panel invitation-panel"><SectionHead title="Invitations"/>{studio.demo && <p className="notice">{t('Demo data stays in this browser. Connect Supabase for real team collaboration.')}</p>}{data.invitations.length ? data.invitations.map(invite => { const state = invite.accepted_at ? 'Accepted' : invite.revoked ? 'Revoked' : new Date(invite.expires_at) < new Date() ? 'Expired' : null; return <div className="invitation-row" key={invite.id}><div><strong>{invite.email}</strong><small>{t('Expires')} {formatDate(invite.expires_at, lang)}</small></div>{state ? <Badge value={state}/> : <button disabled={busy} className="text-button" onClick={() => void run(() => studio.rpc('revoke_invitation', { invitation_id: invite.id }), 'Changes saved')}>{t('Revoke')}</button>}</div>; }) : <p className="muted padded">{t('No invitations yet.')}</p>}</section>}</>;
}

export function Settings() {
  const { studio, t, lang, setLang, theme, setTheme, run, busy, openModal } = useApp(); const { data } = studio;
  const [name, setName] = useState(data.profile.full_name); const [studioName, setStudioName] = useState(data.studio?.name ?? '');
  const owner = data.studio?.owner_id === data.profile.id;
  return <><PageHead title="Studio settings"/><div className="settings-grid"><section className="panel settings-section"><SectionHead title="Profile"/><form onSubmit={e => { e.preventDefault(); void run(() => studio.updateProfile(name.trim()), 'Changes saved'); }}><Field label="Your name"><input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></Field><button disabled={busy || !name.trim()} className="button secondary">{t('Save changes')}</button></form></section><section className="panel settings-section"><SectionHead title="Studio workspace"/><form onSubmit={e => { e.preventDefault(); void run(() => studio.rpc('update_studio', { new_name: studioName.trim() }), 'Changes saved'); }}><Field label="Studio name"><input disabled={!owner} required maxLength={100} value={studioName} onChange={e => setStudioName(e.target.value)}/></Field>{owner && <button disabled={busy || !studioName.trim()} className="button secondary">{t('Save changes')}</button>}</form></section><section className="panel settings-section"><SectionHead title="Language"/><p>{t('Choose the language for this device.')}</p><Field label="Display language"><select value={lang} onChange={e => setLang(e.target.value as 'en' | 'ar')}><option value="en">English</option><option value="ar">العربية</option></select></Field></section><section className="panel settings-section"><SectionHead title="Appearance"/><Field label="Theme"><select value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">{t('Follow device')}</option><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></Field></section><section className="panel settings-section"><SectionHead title="Connection"/><div className="connection-state"><span className={`connection-dot ${studio.demo ? 'demo-dot' : ''}`}/>{t(studio.demo ? 'Local demo' : 'Connected to Supabase')}</div>{studio.demo ? <><p>{t('Demo data stays in this browser. Connect Supabase for real team collaboration.')}</p><p>{t('Read README.md for database and hosting setup.')}</p><div className="inline-actions"><button className="button secondary" onClick={studio.leaveDemo}>{t('Connect your studio')}</button><button className="text-button danger-text" onClick={() => openModal(t('Reset demo data?'), <Confirm label="Reset demo" text="Your demo changes will be replaced with sample projects." onConfirm={studio.resetDemo}/>)}>{t('Reset demo')}</button></div></> : <button className="button secondary" onClick={() => void run(studio.signOut)}>{t('Sign out')}</button>}</section></div></>;
}
