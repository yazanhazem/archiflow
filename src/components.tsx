import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Check, Circle, Clock3, FolderOpen, MoreHorizontal, X } from 'lucide-react';
import { useApp } from './context';
import type { Project, Task } from './types';
import { formatDate, initials, isOverdue, progress, today } from './utils';

export function Avatar({ name, small = false, index = 0 }: { name: string; small?: boolean; index?: number }) {
  return <span className={`avatar color-${index % 4} ${small ? 'small' : ''}`} title={name}>{initials(name)}</span>;
}
export function Badge({ value }: { value: string }) { const { t } = useApp(); return <span className={`badge badge-${value}`}><i />{t(value)}</span>; }
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  const { t } = useApp(); return <div className="empty"><span className="empty-icon"><FolderOpen size={25} /></span><h3>{t(title)}</h3>{text && <p>{t(text)}</p>}{action}</div>;
}
export function PageHead({ eyebrow, title, text, action }: { eyebrow?: string; title: string; text?: string; action?: ReactNode }) {
  const { t } = useApp(); return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{t(title)}</h1>{text && <p>{t(text)}</p>}</div>{action}</div>;
}
export function SectionHead({ title, extra }: { title: string; extra?: ReactNode }) {
  const { t } = useApp(); return <div className="section-heading"><h2>{t(title)}</h2>{extra}</div>;
}

const covers = ['courtyard', 'culture', 'office'];

export function Building({ variant = 0, eager = false }: { variant?: number; eager?: boolean }) {
  const path = import.meta.env.BASE_URL + 'covers/' + (covers[variant] ?? covers[0]);
  return <img className="building" src={path + '.webp'} srcSet={path + '-small.webp 640w, ' + path + '.webp 1200w'}
    sizes="(max-width: 650px) calc(100vw - 38px), 440px" width={1200} height={800}
    decoding="async" loading={eager ? 'eager' : 'lazy'} alt=""/>;
}

export function ProjectCard({ project, list = false, eager = false }: { project: Project; list?: boolean; eager?: boolean }) {
  const { studio: { data }, t, lang } = useApp();
  const tasks = data.tasks.filter(task => task.project_id === project.id);
  const phase = data.phases.find(p => p.id === project.current_phase);
  const assigned = [...new Set(tasks.map(task => task.assignee_id).filter(Boolean))].slice(0, 3);
  const completion = progress(tasks);
  return <a aria-label={project.name} className={`project-card ${list ? 'project-list-card' : ''}`} href={`#/projects/${project.id}`}>
    <div className="project-art"><Building variant={project.cover} eager={eager}/></div>
    <div className="project-card-content"><div className="card-meta"><span>{project.client || '—'}</span><Badge value={project.archived ? 'Archived' : project.status}/></div><h3>{project.name}</h3><div className="phase-label">{phase ? t(phase.name) : t('Planning')}</div><div className="progress-label"><span>{t('Progress')}</span><strong>{completion}%</strong></div><div className="progress-track"><span style={{ width: `${completion}%` }}/></div><div className="project-card-footer"><div className="avatar-stack">{assigned.map((id, i) => <Avatar key={id} name={data.members.find(m => m.user_id === id)?.full_name ?? '?'} index={i} small/>)}{assigned.length === 0 && <span className="muted">{t('Unassigned')}</span>}</div><span><Clock3 size={13}/>{formatDate(project.due_date, lang)}</span></div></div>
  </a>;
}

export function TaskRow({ task, onEdit, onToggle, compact = false }: { task: Task; onEdit: () => void; onToggle: () => void; compact?: boolean }) {
  const { studio: { data, canWrite }, t, lang, busy } = useApp();
  const project = data.projects.find(p => p.id === task.project_id);
  const member = data.members.find(m => m.user_id === task.assignee_id);
  return <div className={`task-row ${task.status === 'done' ? 'task-done' : ''} ${compact ? 'compact' : ''}`}>
    <button disabled={busy || !canWrite || project?.archived} className={`task-check ${task.status === 'done' ? 'checked' : task.status === 'in_progress' ? 'started' : ''}`} aria-label={`${t(task.status === 'done' ? 'Mark to do' : 'Mark done')}: ${task.title}`} aria-pressed={task.status === 'done'} onClick={onToggle}>{task.status === 'done' ? <Check size={13}/> : task.status === 'in_progress' ? <span/> : null}</button>
    <button className="task-title-button" onClick={onEdit}><strong>{task.title}</strong><span><i className={`project-dot cover-${project?.cover ?? 0}`}/>{project?.name}</span></button>
    {!compact && <span className={`priority priority-${task.priority}`}><i/>{t(task.priority)}</span>}
    <span className={`task-date ${isOverdue(task) ? 'overdue' : ''}`} title={isOverdue(task) ? t('Overdue tasks') : undefined}>{task.due_date === today() ? t('Today') : formatDate(task.due_date, lang)}</span>
    {!compact && (member ? <Avatar name={member.full_name} small index={data.members.indexOf(member)}/> : <Circle size={23} className="muted"/>)}
    <button className="icon-button task-more" aria-label={t('Task details')} onClick={onEdit}><MoreHorizontal size={18}/></button>
  </div>;
}

export function Modal({ title, children, onClose, returnFocus }: { title: string; children: ReactNode; onClose: () => void; returnFocus: HTMLElement | null }) {
  const { t, busy } = useApp(); const ref = useRef<HTMLDivElement>(null); const headingId = useId();
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      requestAnimationFrame(() => {
        if (document.querySelector('.modal-overlay')) return;
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        else document.getElementById('main')?.focus({ preventScroll: true });
      });
    };
  }, [returnFocus]);

  const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') ?? []).filter(el => el.getClientRects().length);
  useEffect(() => {
    const target = ref.current?.querySelector<HTMLElement>('[data-dialog-focus]') ?? focusable().find(el => el.matches('input, select, textarea')) ?? focusable()[0];
    (target ?? ref.current)?.focus();
  }, [title]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const els = focusable(); const first = els[0]; const last = els.at(-1);
        if (!els.length) { event.preventDefault(); ref.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [busy, onClose]);
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><div ref={ref} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby={headingId} className="modal"><header><h2 id={headingId}>{title}</h2><button disabled={busy} className="icon-button" aria-label={t('Close')} onClick={onClose}><X size={20}/></button></header>{children}</div></div>;
}

export function Confirm({ text, label = 'Delete', onConfirm }: { text: string; label?: string; onConfirm: () => Promise<unknown> | unknown }) {
  const { t, closeModal, run, busy } = useApp(); return <div className="form"><p>{t(text)}</p><div className="form-actions"><button data-dialog-focus className="button secondary" disabled={busy} onClick={closeModal}>{t('Cancel')}</button><button className="button danger" disabled={busy} onClick={() => void run(onConfirm, 'Changes saved', true)}>{t(label)}</button></div></div>;
}
