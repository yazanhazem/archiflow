-- Run once in a new Supabase project. All authorization is enforced in Postgres.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 100)
);
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  unique (studio_id, user_id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  client text not null default '' check (length(client) <= 160),
  description text not null default '' check (length(description) <= 5000),
  status text not null default 'planning' check (status in ('planning','active','on_hold','completed')),
  start_date date,
  due_date date,
  current_phase uuid,
  notes text not null default '' check (length(notes) <= 20000),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 100),
  archived boolean not null default false,
  cover integer not null default 0 check (cover between 0 and 2),
  created_at timestamptz not null default now(),
  unique (id, studio_id),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create table public.phases (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  project_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  position integer not null check (position between 0 and 100),
  foreign key (project_id, studio_id) references public.projects(id, studio_id) on delete cascade,
  unique (id, project_id, studio_id), unique (project_id, position)
);
alter table public.projects add constraint project_current_phase_fk foreign key (current_phase, id, studio_id) references public.phases(id, project_id, studio_id) deferrable initially deferred;
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  project_id uuid not null,
  phase_id uuid,
  title text not null check (length(trim(title)) between 1 and 240),
  description text not null default '' check (length(description) <= 5000),
  assignee_id uuid,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  created_at timestamptz not null default now(),
  foreign key (project_id, studio_id) references public.projects(id, studio_id) on delete cascade,
  foreign key (phase_id, project_id, studio_id) references public.phases(id, project_id, studio_id),
  foreign key (studio_id, assignee_id) references public.memberships(studio_id, user_id) deferrable initially deferred
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  project_id uuid not null,
  author_id uuid not null references public.profiles(id),
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, studio_id) references public.projects(id, studio_id) on delete cascade
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject text not null,
  created_at timestamptz not null default now()
);
create index projects_studio_idx on public.projects(studio_id);
create index phases_project_idx on public.phases(project_id);
create index tasks_studio_due_idx on public.tasks(studio_id, due_date);
create index tasks_project_idx on public.tasks(project_id);
create index comments_project_idx on public.comments(project_id, created_at);
create index activities_studio_idx on public.activities(studio_id, created_at desc);
create index invitations_studio_idx on public.invitations(studio_id);

create function public.my_studio_id() returns uuid language sql stable security definer set search_path = '' as $$
  select studio_id from public.memberships where user_id = auth.uid()
$$;
create function public.owns_studio(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.studios where id = target and owner_id = auth.uid())
$$;
create function public.project_is_open(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.projects where id = target and studio_id = public.my_studio_id() and not archived)
$$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name) values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Architect'), 100));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Protect identities, tenant keys, timestamps and owner-only archival, even for direct API calls.
create function public.guard_record() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.studio_id <> old.studio_id then raise exception 'Record identity cannot be changed'; end if;
  if (to_jsonb(new)->>'created_at') is distinct from (to_jsonb(old)->>'created_at') then raise exception 'Creation time cannot be changed'; end if;
  if tg_table_name = 'projects' then
    if new.archived is distinct from old.archived and not public.owns_studio(old.studio_id) then raise exception 'Only the studio owner can archive projects'; end if;
    if old.archived and new.archived then raise exception 'Restore the project before editing'; end if;
  elsif tg_table_name = 'comments' then
    if new.author_id <> old.author_id or new.project_id <> old.project_id then raise exception 'Comment identity cannot be changed'; end if;
    new.updated_at := now();
  elsif tg_table_name = 'phases' then
    if new.project_id <> old.project_id or new.position <> old.position then raise exception 'Phase identity cannot be changed'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_projects before update on public.projects for each row execute function public.guard_record();
create trigger guard_tasks before update on public.tasks for each row execute function public.guard_record();
create trigger guard_comments before update on public.comments for each row execute function public.guard_record();
create trigger guard_phases before update on public.phases for each row execute function public.guard_record();

create function public.record_activity() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  project uuid;
  subject_name text;
begin
  project := case when tg_table_name = 'projects' then (row_data->>'id')::uuid else (row_data->>'project_id')::uuid end;
  subject_name := coalesce(row_data->>'title', row_data->>'name', case when tg_table_name = 'comments' then 'comment' when tg_table_name = 'memberships' then (select full_name from public.profiles where id = (row_data->>'user_id')::uuid) else 'studio' end);
  insert into public.activities(studio_id, project_id, actor_id, action, subject)
  values ((row_data->>'studio_id')::uuid, project, auth.uid(), case when tg_table_name = 'comments' and tg_op = 'INSERT' then 'commented' when tg_table_name = 'memberships' then case when tg_op = 'DELETE' then 'removed' else 'joined' end when tg_op = 'INSERT' then 'created' when tg_op = 'DELETE' then 'deleted' else 'updated' end, coalesce(subject_name, 'Member'));
  return null;
end;
$$;
create trigger audit_projects after insert or update on public.projects for each row execute function public.record_activity();
create trigger audit_phases after update on public.phases for each row execute function public.record_activity();
create trigger audit_tasks after insert or update or delete on public.tasks for each row execute function public.record_activity();
create trigger audit_comments after insert or update or delete on public.comments for each row execute function public.record_activity();
create trigger audit_memberships after insert or delete on public.memberships for each row execute function public.record_activity();

alter table public.profiles enable row level security;
alter table public.studios enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.phases enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.invitations enable row level security;
alter table public.activities enable row level security;

create policy profile_read on public.profiles for select to authenticated using (id = auth.uid() or exists(select 1 from public.memberships m where m.user_id = profiles.id and m.studio_id = public.my_studio_id()));
create policy profile_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy studio_read on public.studios for select to authenticated using (id = public.my_studio_id());
create policy membership_read on public.memberships for select to authenticated using (studio_id = public.my_studio_id());
create policy project_read on public.projects for select to authenticated using (studio_id = public.my_studio_id());
create policy project_update on public.projects for update to authenticated using (studio_id = public.my_studio_id()) with check (studio_id = public.my_studio_id());
create policy phase_read on public.phases for select to authenticated using (studio_id = public.my_studio_id());
create policy phase_update on public.phases for update to authenticated using (studio_id = public.my_studio_id() and public.project_is_open(project_id)) with check (studio_id = public.my_studio_id() and public.project_is_open(project_id));
create policy task_read on public.tasks for select to authenticated using (studio_id = public.my_studio_id());
create policy task_insert on public.tasks for insert to authenticated with check (studio_id = public.my_studio_id() and public.project_is_open(project_id));
create policy task_update on public.tasks for update to authenticated using (studio_id = public.my_studio_id() and public.project_is_open(project_id)) with check (studio_id = public.my_studio_id() and public.project_is_open(project_id));
create policy task_delete on public.tasks for delete to authenticated using (studio_id = public.my_studio_id() and public.project_is_open(project_id));
create policy comment_read on public.comments for select to authenticated using (studio_id = public.my_studio_id());
create policy comment_insert on public.comments for insert to authenticated with check (studio_id = public.my_studio_id() and author_id = auth.uid() and public.project_is_open(project_id));
create policy comment_update on public.comments for update to authenticated using (studio_id = public.my_studio_id() and author_id = auth.uid() and public.project_is_open(project_id)) with check (studio_id = public.my_studio_id() and author_id = auth.uid() and public.project_is_open(project_id));
create policy comment_delete on public.comments for delete to authenticated using (studio_id = public.my_studio_id() and author_id = auth.uid() and public.project_is_open(project_id));
create policy invitation_read on public.invitations for select to authenticated using (public.owns_studio(studio_id));
create policy activity_read on public.activities for select to authenticated using (studio_id = public.my_studio_id());

create function public.create_studio(studio_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email first'; end if;
  insert into public.studios(name, owner_id) values (trim(studio_name), auth.uid()) returning id into result;
  insert into public.memberships(studio_id, user_id, role) values (result, auth.uid(), 'owner');
  return result;
end;
$$;
create function public.create_project(project_values jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; studio uuid := public.my_studio_id(); first_phase uuid; phase_id uuid; phase_name text; pos integer := 0;
begin
  if studio is null then raise exception 'Studio membership required'; end if;
  insert into public.projects(studio_id,name,client,description,status,start_date,due_date,cover)
  values(studio,trim(project_values->>'name'),coalesce(project_values->>'client',''),coalesce(project_values->>'description',''),coalesce(project_values->>'status','planning'),nullif(project_values->>'start_date','')::date,nullif(project_values->>'due_date','')::date,coalesce((project_values->>'cover')::integer,0)) returning id into result;
  foreach phase_name in array array['Brief','Concept','Design Development','Technical Documentation','Construction','Handover'] loop
    insert into public.phases(studio_id,project_id,name,position) values(studio,result,phase_name,pos) returning id into phase_id;
    if pos = 0 then first_phase := phase_id; end if;
    pos := pos + 1;
  end loop;
  update public.projects set current_phase = first_phase where id = result;
  return result;
end;
$$;
create function public.create_invitation(invited_email text) returns text language plpgsql security definer set search_path = '' as $$
declare studio uuid := public.my_studio_id(); raw_token text; normalized_email text := lower(trim(invited_email));
begin
  if not public.owns_studio(studio) then raise exception 'Only the studio owner can invite members'; end if;
  perform 1 from public.studios where id = studio for update;
  update public.invitations set revoked = true where studio_id = studio and email = normalized_email and accepted_at is null and not revoked;
  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.invitations(studio_id,email,token_hash) values(studio,normalized_email,encode(sha256(convert_to(raw_token,'UTF8')),'hex'));
  return raw_token;
end;
$$;
create function public.accept_invitation(invitation_token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.invitations; verified_email text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select lower(email) into verified_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verify your email first'; end if;
  select * into invite from public.invitations where token_hash = encode(sha256(convert_to(invitation_token,'UTF8')),'hex') for update;
  if invite.id is null or invite.revoked or invite.accepted_at is not null or invite.expires_at <= now() then raise exception 'This invitation is invalid or has expired'; end if;
  if invite.email <> verified_email then raise exception 'Sign in with the invited email address'; end if;
  insert into public.memberships(studio_id,user_id,role) values(invite.studio_id,auth.uid(),'member');
  update public.invitations set accepted_at = now() where id = invite.id;
  return invite.studio_id;
end;
$$;
create function public.revoke_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations set revoked = true where id = invitation_id and public.owns_studio(studio_id) and accepted_at is null;
  if not found then raise exception 'Invitation not found or access denied'; end if;
end;
$$;
create function public.remove_member(target_user_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare studio uuid := public.my_studio_id();
begin
  if not public.owns_studio(studio) then raise exception 'Only the studio owner can remove members'; end if;
  if target_user_id = auth.uid() then raise exception 'The studio owner cannot be removed'; end if;
  -- Lock membership to serialize removal with any concurrent writes that reference it.
  perform 1 from public.memberships where studio_id = studio and user_id = target_user_id for update;
  if not found then raise exception 'Member not found'; end if;
  update public.tasks set assignee_id = null where studio_id = studio and assignee_id = target_user_id;
  delete from public.memberships where studio_id = studio and user_id = target_user_id;
end;
$$;
create function public.update_studio(new_name text) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.studios set name = trim(new_name) where id = public.my_studio_id() and owner_id = auth.uid();
  if not found then raise exception 'Only the studio owner can update settings'; end if;
end;
$$;

-- Supabase installations can grant broad default privileges; revoke them explicitly.
revoke all on public.profiles, public.studios, public.memberships, public.projects, public.phases, public.tasks, public.comments, public.invitations, public.activities from anon, authenticated;
grant select on public.profiles, public.studios, public.memberships, public.projects, public.phases, public.tasks, public.comments, public.activities to authenticated;
grant select(id,studio_id,email,expires_at,revoked,accepted_at,created_at) on public.invitations to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant update(name,client,description,status,start_date,due_date,current_phase,notes,links,archived,cover) on public.projects to authenticated;
grant update(name) on public.phases to authenticated;
grant insert(studio_id,project_id,phase_id,title,description,assignee_id,priority,due_date,status), update(project_id,phase_id,title,description,assignee_id,priority,due_date,status), delete on public.tasks to authenticated;
grant insert(studio_id,project_id,author_id,body), update(body), delete on public.comments to authenticated;

revoke all on function public.my_studio_id(), public.owns_studio(uuid), public.project_is_open(uuid), public.handle_new_user(), public.guard_record(), public.record_activity(), public.create_studio(text), public.create_project(jsonb), public.create_invitation(text), public.accept_invitation(text), public.revoke_invitation(uuid), public.remove_member(uuid), public.update_studio(text) from public, anon;
grant execute on function public.my_studio_id(), public.owns_studio(uuid), public.project_is_open(uuid), public.create_studio(text), public.create_project(jsonb), public.create_invitation(text), public.accept_invitation(text), public.revoke_invitation(uuid), public.remove_member(uuid), public.update_studio(text) to authenticated;

-- Publish only data the app displays. Invitation hashes are never published.
do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['studios','memberships','profiles','projects','phases','tasks','comments','activities'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
commit;
