import { Children, cloneElement, isValidElement, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useApp } from './context';
import { Building, Confirm } from './components';
import type { Project, Task } from './types';
import { appUrl } from './supabase';
import { formatDate, today } from './utils';

export function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  const { t } = useApp(); const id = useId();
  return <div className={`field ${full ? 'full' : ''}`}><label htmlFor={id}>{t(label)}</label>{Children.map(children, child => isValidElement<Record<string, unknown>>(child) && typeof child.type === 'string' && ['input','select','textarea'].includes(child.type) ? cloneElement(child, { id, 'aria-label': t(label) }) : child)}</div>;
}
export function Actions({ label }: { label: string }) {
  const { t, busy, closeModal } = useApp(); return <div className="form-actions"><button disabled={busy} type="button" className="button secondary" onClick={closeModal}>{t('Cancel')}</button><button disabled={busy} type="submit" className="button primary">{t(busy ? 'Saving…' : label)}</button></div>;
}
export function ProjectForm({ project }: { project?: Project }) {
  const { t, studio, run, navigate } = useApp();
  const [form, setForm] = useState({ name: project?.name ?? '', client: project?.client ?? '', description: project?.description ?? '', status: project?.status ?? 'planning', start_date: project?.start_date ?? today(), due_date: project?.due_date ?? '', current_phase: project?.current_phase ?? null, cover: project?.cover ?? 0 });
  const [error, setError] = useState('');
  const phases = studio.data.phases.filter(p => p.project_id === project?.id);
  function submit(event: FormEvent) {
    event.preventDefault();
    const dates = new FormData(event.currentTarget as HTMLFormElement);
    const values = { ...form, name: form.name.trim(), start_date: String(dates.get('start_date') ?? ''), due_date: String(dates.get('due_date') ?? '') };
    if (!values.name) return;
    if (values.due_date && values.start_date && values.due_date < values.start_date) { setError('Due date must be on or after the start date.'); return; }
    void run(async () => { if (project) await studio.save('projects', values, project.id); else { const id = await studio.createProject(values); navigate(`/projects/${id}`); } }, project ? 'Changes saved' : 'Project created', true);
  }
  return <form className="form" onSubmit={submit}><div className="form-grid"><Field label="Project name" full><input required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></Field><Field label="Client" full><input maxLength={160} value={form.client} onChange={e => setForm({ ...form, client: e.target.value })}/></Field><Field label="Description" full><textarea rows={3} maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></Field><Field label="Status"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Project['status'] })}>{['planning', 'active', 'on_hold', 'completed'].map(s => <option key={s} value={s}>{t(s)}</option>)}</select></Field>{project && <Field label="Current phase"><select value={form.current_phase ?? ''} onChange={e => setForm({ ...form, current_phase: e.target.value || null })}>{phases.map(p => <option key={p.id} value={p.id}>{t(p.name)}</option>)}</select></Field>}<Field label="Start date"><input type="date" name="start_date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}/></Field><Field label="Due date"><input type="date" name="due_date" min={form.start_date || undefined} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}/></Field><div className="field full"><span>{t('Cover style')}</span><div className="cover-options">{[0, 1, 2].map(v => <button aria-label={`${t('Cover style')} ${v + 1}`} aria-pressed={form.cover === v} type="button" className={form.cover === v ? 'selected' : ''} key={v} onClick={() => setForm({ ...form, cover: v })}><Building variant={v}/>{form.cover === v && <Check size={16}/>}</button>)}</div></div></div>{error && <p role="alert" className="form-error">{t(error)}</p>}<Actions label={project ? 'Save changes' : 'Create project'}/></form>;
}

export function TaskForm({ task, projectId, phaseId }: { task?: Task; projectId?: string; phaseId?: string }) {
  const { studio, t, lang, run, openModal, closeModal } = useApp();
  const projects = studio.data.projects.filter(p => !p.archived || p.id === task?.project_id);
  const [form, setForm] = useState({ title: task?.title ?? '', description: task?.description ?? '', project_id: task?.project_id ?? projectId ?? projects[0]?.id ?? '', phase_id: task?.phase_id ?? phaseId ?? null, status: task?.status ?? 'todo', priority: task?.priority ?? 'medium', assignee_id: task?.assignee_id ?? null, due_date: task?.due_date ?? '' });
  const phases = studio.data.phases.filter(p => p.project_id === form.project_id);
  const originalProject = studio.data.projects.find(project => project.id === task?.project_id);
  function submit(event: FormEvent) { event.preventDefault(); if (!form.title.trim()) return; const due = new FormData(event.currentTarget as HTMLFormElement).get('due_date'); void run(() => studio.save('tasks', { ...form, title: form.title.trim(), due_date: String(due ?? '') }, task?.id), task ? 'Changes saved' : 'Task created', true); }
  if (task && originalProject?.archived) {
    const phase = studio.data.phases.find(item => item.id === task.phase_id);
    const assignee = studio.data.members.find(item => item.user_id === task.assignee_id);
    return <div className="form">
      <h3>{task.title}</h3>{task.description && <p>{task.description}</p>}
      <dl className="task-readonly">
        {[['Phase', phase ? t(phase.name) : t('Unphased')], ['Status', t(task.status)], ['Priority', t(task.priority)], ['Assignee', assignee?.full_name || t('Unassigned')], ['Deadline', task.due_date ? formatDate(task.due_date, lang) : t('No deadline')]].map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}
      </dl>
      <button type="button" className="button secondary" onClick={closeModal}>{t('Close')}</button>
    </div>;
  }
  if (!projects.length) return <div className="form"><p>{t(studio.data.projects.length ? 'All projects are archived. Restore one to add tasks.' : 'Create your first project and give your ideas a place to grow.')}</p><button type="button" className="button primary" onClick={() => openModal(t('New project'), <ProjectForm/>)}><Plus size={16}/>{t('New project')}</button></div>;
  return <form className="form" onSubmit={submit}><div className="form-grid"><Field label="Task title" full><input required maxLength={240} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></Field><Field label="Project" full><select required value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value, phase_id: null })}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Description" full><textarea rows={3} maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></Field><Field label="Phase"><select value={form.phase_id ?? ''} onChange={e => setForm({ ...form, phase_id: e.target.value || null })}><option value="">{t('No phase')}</option>{phases.map(p => <option key={p.id} value={p.id}>{t(p.name)}</option>)}</select></Field><Field label="Assignee"><select value={form.assignee_id ?? ''} onChange={e => setForm({ ...form, assignee_id: e.target.value || null })}><option value="">{t('Unassigned')}</option>{studio.data.members.map(m => <option key={m.id} value={m.user_id}>{m.full_name}</option>)}</select></Field><Field label="Status"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Task['status'] })}>{['todo', 'in_progress', 'done'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></Field><Field label="Priority"><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Task['priority'] })}>{['low', 'medium', 'high'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></Field><Field label="Due date" full><input type="date" name="due_date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}/></Field></div><Actions label={task ? 'Save changes' : 'Create task'}/>{task && <button disabled={studio.data.projects.find(p => p.id === task.project_id)?.archived} type="button" className="text-button danger-text" onClick={() => openModal(t('Delete task?'), <Confirm text="This cannot be undone." onConfirm={() => studio.remove('tasks', task.id)}/>)}><Trash2 size={14}/>{t('Delete')}</button>}</form>;
}

export function RenamePhase({ id, name }: { id: string; name: string }) {
  const { t, studio, run } = useApp(); const [value, setValue] = useState(t(name));
  return <form className="form" onSubmit={e => { e.preventDefault(); void run(() => studio.save('phases', { name: value.trim() }, id), 'Changes saved', true); }}><Field label="Phase name"><input required maxLength={120} value={value} onChange={e => setValue(e.target.value)}/></Field><Actions label="Save changes"/></form>;
}
export function LinkForm({ project }: { project: Project }) {
  const { studio, run, t } = useApp(); const [label, setLabel] = useState(''); const [url, setUrl] = useState(''); const [error, setError] = useState('');
  return <form className="form" onSubmit={e => { e.preventDefault(); let parsed; try { parsed = new URL(url); } catch { setError('Please use a valid HTTP or HTTPS link.'); return; } if (!['http:', 'https:'].includes(parsed.protocol)) { setError('Please use a valid HTTP or HTTPS link.'); return; } const latest = studio.data.projects.find(p => p.id === project.id)!; void run(() => studio.save('projects', { links: [...latest.links, { label: label.trim(), url: parsed.href }] }, project.id), 'Changes saved', true); }}><Field label="Link label"><input required maxLength={160} value={label} onChange={e => setLabel(e.target.value)}/></Field><Field label="URL"><input required type="url" dir="ltr" value={url} onChange={e => setUrl(e.target.value)}/></Field>{error && <p role="alert" className="form-error">{t(error)}</p>}<Actions label="Add link"/></form>;
}

export function InviteForm() {
  const { studio, t, run, busy } = useApp(); const [email, setEmail] = useState(''); const [link, setLink] = useState(''); const [copied, setCopied] = useState(false);
  return <form className="form" onSubmit={e => { e.preventDefault(); void run(async () => { const token = await studio.rpc('create_invitation', { invited_email: email.trim().toLowerCase() }); setLink(`${appUrl()}#/invite?token=${encodeURIComponent(String(token))}`); }, 'Invitation created'); }}>
    {studio.demo && <p className="notice">{t('Demo data stays in this browser. Connect Supabase for real team collaboration.')}</p>}
    {!link ? <><Field label="Email address"><input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></Field><div className="form-actions"><button disabled={busy || studio.demo} className="button primary" type="submit"><Plus size={16}/>{t('Create invitation')}</button></div></> : <><p>{t('Share this link with the invited person. It works once and expires in seven days.')}</p><Field label="Invitation link"><input readOnly value={link} dir="ltr" onFocus={e => e.target.select()}/></Field><button type="button" className="button primary" onClick={() => void run(async () => { await navigator.clipboard.writeText(link); setCopied(true); })}>{copied ? <Check size={16}/> : <Copy size={16}/>}{t(copied ? 'Copied' : 'Copy link')}</button></>}
  </form>;
}
