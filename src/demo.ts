import type { Data } from './types';
import { defaultPhases } from './i18n';
import { localDate } from './utils';

export const DEMO_KEY = 'architect-studio-demo-v1';
export function demoData(): Data {
  const date = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return localDate(d); };
  const stamp = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString();
  const projects = [
    { id: 'p1', name: 'The Courtyard House', client: 'Hassan Residence', description: 'A quiet home shaped around light, landscape, and a shared central courtyard.', status: 'active' as const, cover: 0, offset: 24 },
    { id: 'p2', name: 'Forma Cultural Centre', client: 'City Arts Foundation', description: 'A new civic gathering place where art, culture, and community meet.', status: 'active' as const, cover: 1, offset: 42 },
    { id: 'p3', name: 'Northline Offices', client: 'Northline Group', description: 'Flexible workspaces with a thoughtful connection to the city beyond.', status: 'planning' as const, cover: 2, offset: 60 },
  ].map(p => ({ id: p.id, studio_id: 'demo', name: p.name, client: p.client, description: p.description, status: p.status, start_date: date(-30), due_date: date(p.offset), current_phase: `${p.id}-phase-${p.id === 'p3' ? 0 : 2}`, notes: '', links: [], archived: false, cover: p.cover, created_at: stamp(100) }));
  const tasks = [
    { title: 'Finalize ground floor plan', p: 'p1', due: 0, status: 'in_progress', priority: 'high', who: 'demo-user' },
    { title: 'Review material palette', p: 'p1', due: 2, status: 'todo', priority: 'medium', who: 'm2' },
    { title: 'Prepare concept presentation', p: 'p2', due: 3, status: 'in_progress', priority: 'high', who: 'demo-user' },
    { title: 'Coordinate structural grid', p: 'p2', due: -2, status: 'todo', priority: 'high', who: 'm3' },
    { title: 'Site analysis and context study', p: 'p3', due: 5, status: 'todo', priority: 'medium', who: 'demo-user' },
    { title: 'Confirm client brief', p: 'p3', due: 8, status: 'todo', priority: 'low', who: 'm2' },
    ...Array.from({ length: 6 }, (_, i) => ({ title: ['Complete site survey', 'Develop spatial concept', 'Review initial sketches', 'Approve design direction', 'Map circulation routes', 'Study daylight orientation'][i], p: i < 3 ? 'p1' : 'p2', due: -5 + i, status: 'done', priority: 'medium', who: i % 2 ? 'm2' : 'demo-user' })),
  ].map((v, i) => ({ id: `t${i}`, studio_id: 'demo', project_id: v.p, phase_id: `${v.p}-phase-2`, title: v.title, description: '', assignee_id: v.who, priority: v.priority, due_date: date(v.due), status: v.status, created_at: stamp(50) })) as Data['tasks'];
  return {
    studio: { id: 'demo', name: 'Atelier Studio', owner_id: 'demo-user' }, profile: { id: 'demo-user', full_name: 'Alex Morgan' },
    members: [{ id: 'dm1', studio_id: 'demo', user_id: 'demo-user', role: 'owner', full_name: 'Alex Morgan' }, { id: 'dm2', studio_id: 'demo', user_id: 'm2', role: 'member', full_name: 'Sara Ahmed' }, { id: 'dm3', studio_id: 'demo', user_id: 'm3', role: 'member', full_name: 'Omar Khalil' }],
    projects, phases: projects.flatMap(p => defaultPhases.map((name, position) => ({ id: `${p.id}-phase-${position}`, studio_id: 'demo', project_id: p.id, name, position }))), tasks,
    comments: [{ id: 'c1', studio_id: 'demo', project_id: 'p1', author_id: 'm2', body: 'The courtyard proportions are looking great. Shall we review the material samples at our next meeting?', created_at: stamp(3), updated_at: stamp(3) }],
    activities: [{ id: 'a1', studio_id: 'demo', project_id: 'p1', actor_id: 'm2', action: 'updated', subject: 'Review material palette', created_at: stamp(1) }, { id: 'a2', studio_id: 'demo', project_id: 'p2', actor_id: 'demo-user', action: 'created', subject: 'Prepare concept presentation', created_at: stamp(2) }, { id: 'a3', studio_id: 'demo', project_id: 'p1', actor_id: 'm2', action: 'commented', subject: 'The Courtyard House', created_at: stamp(3) }], invitations: [],
  };
}
export function loadDemo(): Data {
  try { const raw = localStorage.getItem(DEMO_KEY); if (raw) { const data = JSON.parse(raw); if (data.studio?.id === 'demo' && Array.isArray(data.projects) && Array.isArray(data.tasks)) return data; } } catch { /* A fresh workspace remains available if storage is inaccessible. */ }
  return demoData();
}
