import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Data, Entity, Project } from './types';
import { configured, supabase } from './supabase';
import { DEMO_KEY, demoData, loadDemo } from './demo';
import { defaultPhases } from './i18n';
import { acknowledgeWrite, createSyncQueue } from './studioSync';
import { errorMessage } from './utils';

const empty = (id = ''): Data => ({ studio: null, profile: { id, full_name: '' }, members: [], projects: [], phases: [], tasks: [], comments: [], activities: [], invitations: [] });
const uid = () => crypto.randomUUID();

export function useStudio() {
  const [demo, setDemo] = useState(!configured || sessionStorage.getItem('studio-demo') === 'true');
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);
  const [recovery, setRecovery] = useState(new URLSearchParams(location.search).get('flow') === 'recovery');
  const [demoSnapshot, setDemoSnapshot] = useState(loadDemo);
  const [remote, setRemote] = useState<{ identity: string; data: Data | null; error: string; syncing: boolean } | null>(null);
  const [authError, setAuthError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const draftUser = session?.user.id;
  const identity = !demo && draftUser ? draftUser : null;
  const current = remote?.identity === identity ? remote : null;
  const data = demo ? demoSnapshot : current?.data ?? empty(draftUser);
  const dataRef = useRef(data);
  const identityRef = useRef(identity);
  const syncRef = useRef<{ identity: string; request: (invalidate?: boolean) => Promise<void> } | null>(null);
  identityRef.current = identity;
  dataRef.current = data;
  const syncing = current?.syncing ?? false;
  const loading = Boolean(identity && !current?.data && !current?.error);
  const error = demo ? '' : current?.error || authError;
  const canWrite = demo || Boolean(identity && data.studio && online);

  const replace = useCallback((next: Data) => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(next));
    dataRef.current = next;
    setDemoSnapshot(next);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedEvent = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      receivedEvent = true;
      setSession(next); setReady(true);
      if (next) setAuthError('');
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    supabase.auth.getSession().then(({ data: result, error: err }) => {
      if (!active || receivedEvent) return;
      if (err) setAuthError(err.message);
      setSession(result.session); setReady(true);
    }).catch(err => {
      if (!active || receivedEvent) return;
      setAuthError(errorMessage(err)); setReady(true);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const readStudio = useCallback(async (userId: string): Promise<Data> => {
    const client = supabase;
    if (!client) return empty(userId);
    const profile = await client.from('profiles').select('id,full_name').eq('id', userId).single();
    if (profile.error) throw profile.error;
    const getMembership = () => client.from('memberships').select('studio_id').eq('user_id', userId).maybeSingle();
    const membership = await getMembership();
    if (membership.error) throw membership.error;
    const withoutStudio = { ...empty(userId), profile: profile.data };
    if (!membership.data) return withoutStudio;
    const studioId = membership.data.studio_id;
    const results = await Promise.all([
      client.from('studios').select('*').eq('id', studioId).single(),
      client.from('memberships').select('*,profiles(full_name)').eq('studio_id', studioId),
      client.from('projects').select('*').eq('studio_id', studioId).order('created_at', { ascending: false }),
      client.from('phases').select('*').eq('studio_id', studioId).order('position'),
      client.from('tasks').select('*').eq('studio_id', studioId).order('created_at', { ascending: false }),
      client.from('comments').select('*').eq('studio_id', studioId).order('created_at'),
      client.from('activities').select('*').eq('studio_id', studioId).order('created_at', { ascending: false }).limit(150),
      client.from('invitations').select('id,studio_id,email,expires_at,revoked,accepted_at').eq('studio_id', studioId).order('created_at', { ascending: false }),
    ]);
    const failure = results.find(result => result.error)?.error;
    if (failure) {
      const latest = await getMembership();
      if (!latest.error && !latest.data) return withoutStudio;
      throw failure;
    }
    return {
      studio: results[0].data!, profile: profile.data,
      members: results[1].data!.map(m => ({ ...m, full_name: (m.profiles as unknown as { full_name: string })?.full_name ?? '' })),
      projects: results[2].data!.map(p => ({ ...p, start_date: p.start_date ?? '', due_date: p.due_date ?? '' })),
      phases: results[3].data!, tasks: results[4].data!.map(task => ({ ...task, due_date: task.due_date ?? '' })),
      comments: results[5].data!, activities: results[6].data!, invitations: results[7].data!,
    } as Data;
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    if (!supabase || !identity) {
      setRemote(null);
      return;
    }
    const client = supabase;
    const update = (patch: Partial<NonNullable<typeof remote>>) => {
      if (identityRef.current !== identity) return;
      setRemote(previous => ({ identity, data: null, error: '', syncing: false, ...(previous?.identity === identity ? previous : {}), ...patch }));
    };
    const queue = createSyncQueue(() => readStudio(identity), next => update({ data: next }), err => update({ error: err ? errorMessage(err) : '' }), value => update({ syncing: value }));
    syncRef.current = { identity, request: queue.request };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = undefined; void queue.request(true); }, 160);
    };
    window.addEventListener('focus', schedule);
    window.addEventListener('online', schedule);
    const channel = client.channel(`studio-${identity}`).on('postgres_changes', { event: '*', schema: 'public' }, schedule).subscribe(status => { if (status === 'SUBSCRIBED') schedule(); });
    void queue.request();
    return () => {
      queue.stop(); syncRef.current = null; clearTimeout(timer);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', schedule);
      void client.removeChannel(channel);
    };
  }, [identity, readStudio]);

  const refresh = useCallback(() => syncRef.current?.request() ?? Promise.resolve(), []);
  function syncAfterWrite() {
    const scope = syncRef.current;
    return scope && scope.identity === identityRef.current && scope.identity === identity ? scope.request(true) : Promise.resolve();
  }

  function applyRemote(patch: (snapshot: Data) => Data) {
    if (!identity || identityRef.current !== identity) return;
    setRemote(previous => previous?.identity === identity && previous.data ? { ...previous, data: patch(previous.data) } : previous);
  }

  function localActivity(next: Data, action: string, subject: string, projectId: string | null) {
    next.activities = [{ id: uid(), studio_id: next.studio!.id, project_id: projectId, actor_id: next.profile.id, action, subject, created_at: new Date().toISOString() }, ...next.activities].slice(0, 150);
    return next;
  }
  function checkOnline() { if (!demo && !navigator.onLine) throw new Error('You are offline. Reconnect before saving changes.'); }

  async function save(entity: Entity, values: Record<string, unknown>, id?: string) {
    checkOnline();
    if (demo) {
      const next = structuredClone(dataRef.current);
      const now = new Date().toISOString();
      const rows = next[entity] as unknown as Record<string, unknown>[];
      const record = id ? rows.find(r => r.id === id) : null;
      if (id && !record) throw new Error('Something went wrong');
      const row: Record<string, unknown> = { ...record, ...values, id: id ?? uid(), studio_id: next.studio!.id, ...(id ? {} : { created_at: now }), ...(entity === 'comments' ? { updated_at: now, author_id: next.profile.id } : {}) };
      if (id) rows.splice(rows.findIndex(r => r.id === id), 1, row); else rows.unshift(row);
      replace(localActivity(next, entity === 'comments' ? 'commented' : id ? 'updated' : 'created', String(row.title ?? row.name ?? 'comment'), String(row.project_id ?? (entity === 'projects' ? row.id : '')) || null));
      return String(row.id);
    }
    const normalized = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, ['start_date', 'due_date'].includes(key) && value === '' ? null : value]));
    const query = id ? supabase!.from(entity).update(normalized).eq('id', id) : supabase!.from(entity).insert({ ...normalized, studio_id: dataRef.current.studio!.id, ...(entity === 'comments' ? { author_id: draftUser } : {}) });
    const result = await query.select('*').single();
    const row = acknowledgeWrite(result, syncAfterWrite, saved => {
      if (!saved) return;
      if (entity === 'projects') {
        saved.start_date ??= '';
        saved.due_date ??= '';
      } else if (entity === 'tasks') saved.due_date ??= '';
      applyRemote(snapshot => {
        if (!snapshot.studio || saved.studio_id !== snapshot.studio.id) return snapshot;
        const rows = snapshot[entity];
        if (!id) return { ...snapshot, [entity]: entity === 'comments' ? [...rows, saved] : [saved, ...rows] };
        return { ...snapshot, [entity]: rows.map(old => old.id === id ? saved : old) };
      });
    });
    return row!.id as string;
  }

  async function createProject(values: Partial<Project>) {
    checkOnline();
    if (demo) {
      const next = structuredClone(dataRef.current);
      const id = uid();
      const phases = defaultPhases.map((name, position) => ({ id: uid(), studio_id: next.studio!.id, project_id: id, name, position }));
      next.phases.push(...phases);
      next.projects.unshift({ id, studio_id: next.studio!.id, name: '', client: '', description: '', status: 'planning', start_date: '', due_date: '', notes: '', links: [], archived: false, cover: 0, created_at: new Date().toISOString(), ...values, current_phase: phases[0].id });
      replace(localActivity(next, 'created', values.name!, id)); return id;
    }
    const result = await supabase!.rpc('create_project', { project_values: values });
    return acknowledgeWrite(result, syncAfterWrite) as string;
  }

  async function remove(entity: 'tasks' | 'comments', id: string) {
    checkOnline();
    if (demo) {
      const next = structuredClone(dataRef.current);
      const row = (next[entity] as unknown as { id: string; project_id: string; title?: string }[]).find(r => r.id === id)!;
      next[entity] = next[entity].filter(r => r.id !== id) as never;
      replace(localActivity(next, 'deleted', row.title ?? 'comment', row.project_id)); return;
    }
    const result = await supabase!.from(entity).delete().eq('id', id).select('id,studio_id').single();
    acknowledgeWrite(result, syncAfterWrite, removed => {
      if (removed) applyRemote(snapshot => snapshot.studio?.id === removed.studio_id ? { ...snapshot, [entity]: snapshot[entity].filter(row => row.id !== id) } : snapshot);
    });
  }

  async function rpc(name: string, args: Record<string, unknown>) {
    checkOnline();
    if (demo) {
      const next = structuredClone(dataRef.current);
      if (name === 'remove_member') {
        next.members = next.members.filter(m => m.user_id !== args.target_user_id);
        next.tasks.forEach(t => { if (t.assignee_id === args.target_user_id) t.assignee_id = null; });
      }
      if (name === 'update_studio') next.studio!.name = String(args.new_name);
      if (name === 'create_invitation') throw new Error('Demo data stays in this browser. Connect Supabase for real team collaboration.');
      if (name === 'revoke_invitation') next.invitations = next.invitations.map(i => i.id === args.invitation_id ? { ...i, revoked: true } : i);
      replace(next); return null;
    }
    const result = await supabase!.rpc(name, args);
    return acknowledgeWrite(result, syncAfterWrite);
  }
  async function updateProfile(name: string) {
    if (!demo) {
      checkOnline();
      const result = await supabase!.from('profiles').update({ full_name: name }).eq('id', draftUser).select('id,full_name').single();
      acknowledgeWrite(result, syncAfterWrite, profile => {
        if (profile) applyRemote(snapshot => ({ ...snapshot, profile, members: snapshot.members.map(member => member.user_id === profile.id ? { ...member, full_name: profile.full_name } : member) }));
      });
    } else {
      const next = structuredClone(dataRef.current); next.profile.full_name = name; next.members = next.members.map(m => m.user_id === next.profile.id ? { ...m, full_name: name } : m); replace(next);
    }
  }
  return {
    demo, session, ready, recovery, setRecovery, data, loading, syncing, error, online, canWrite, refresh, save, createProject, remove, rpc, updateProfile,
    enterDemo: () => { sessionStorage.setItem('studio-demo', 'true'); setDemo(true); },
    leaveDemo: () => { sessionStorage.removeItem('studio-demo'); setDemo(false); },
    resetDemo: () => replace(demoData()),
    signOut: async () => {
      if (!supabase) return;
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      setRecovery(false);
      history.replaceState(null, '', `${location.pathname}${location.hash}`);
    },
  };
}
export type StudioController = ReturnType<typeof useStudio>;
