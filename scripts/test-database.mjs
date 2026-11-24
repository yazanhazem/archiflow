import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL execution in memory; only Supabase's auth schema is simulated.
const db = new PGlite();
let checks = 0;
const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005'];
const [owner, otherOwner, member, guest, unverified] = ids;
const first = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const as = async (id, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.exec(`set role ${role}`);
};
const check = async (title, fn) => { await fn(); checks++; console.log(`  ✓ ${title}`); };
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/001_studio.sql', import.meta.url), 'utf8'));
  await check('migration runs successfully in PostgreSQL', async () => assert.equal((await first("select count(*)::int as n from pg_tables where schemaname='public'")).n, 9));
  for (let i = 0; i < ids.length; i++) await db.query("insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,$4)", [ids[i], ['owner@studio.test','other@studio.test','member@studio.test','guest@studio.test','unverified@studio.test'][i], JSON.stringify({ full_name: ['Owner','Other Owner','Member','Guest','Unverified'][i] }), i === 4 ? null : new Date().toISOString()]);
  await as(owner);
  const studio = (await first("select public.create_studio('Studio One') as id")).id;
  const project = (await first('select public.create_project($1::jsonb) as id', [JSON.stringify({ name: 'Courtyard', start_date: '2026-11-24', due_date: '2026-12-24' })])).id;
  await check('project creation atomically seeds six phases', async () => assert.equal((await first('select count(*)::int as n from public.phases where project_id=$1', [project])).n, 6));
  await as(otherOwner);
  const otherStudio = (await first("select public.create_studio('Studio Two') as id")).id;
  const otherProject = (await first('select public.create_project($1::jsonb) as id', [JSON.stringify({ name: 'Other project' })])).id;
  await check('studio isolation applies to projects and profiles', async () => {
    assert.equal((await db.query('select * from public.projects where id=$1', [project])).rows.length, 0);
    assert.equal((await db.query('select * from public.profiles where id=$1', [owner])).rows.length, 0);
    assert.equal((await db.query('update public.projects set name=$1 where id=$2 returning id', ['Stolen', project])).rows.length, 0);
  });
  await as(null, 'anon');
  await check('anonymous users cannot read records or create studios', async () => {
    await assert.rejects(() => db.query('select * from public.projects'), /permission denied/);
    await assert.rejects(() => db.query("select public.create_studio('No')"), /permission denied/);
  });
  await as(unverified);
  await check('unverified accounts cannot create studios', async () => { await assert.rejects(() => db.query("select public.create_studio('No')"), /Verify your email/); });
  await as(owner);
  const token = (await first("select public.create_invitation('member@studio.test') as token")).token;
  await check('invitation hashes are hidden even from owners', async () => { await assert.rejects(() => db.query('select token_hash from public.invitations'), /permission denied/); });
  await as(guest);
  await check('invitations require the matching email', async () => { await assert.rejects(() => db.query('select public.accept_invitation($1)', [token]), /invited email/); });
  await as(member);
  await first('select public.accept_invitation($1)', [token]);
  await check('invitation grants member access and cannot be reused', async () => {
    assert.equal((await first('select public.my_studio_id() as id')).id, studio);
    await assert.rejects(() => db.query('select public.accept_invitation($1)', [token]), /invalid or has expired/);
  });
  await check('members cannot manage membership or invitations', async () => {
    await assert.rejects(() => db.query("select public.create_invitation('guest@studio.test')"), /Only the studio owner/);
    await assert.rejects(() => db.query('delete from public.memberships where user_id=$1', [owner]), /permission denied/);
    await assert.rejects(() => db.query('select public.remove_member($1)', [owner]), /Only the studio owner/);
    assert.equal((await db.query('select id from public.invitations')).rows.length, 0);
  });
  const task = (await first('insert into public.tasks(studio_id,project_id,title,assignee_id) values($1,$2,$3,$4) returning id', [studio, project, 'Review plan', member])).id;
  await check('cross-studio assignment and phase references are rejected', async () => {
    await assert.rejects(() => db.query('update public.tasks set assignee_id=$1 where id=$2', [otherOwner, task]), /foreign key/);
    await db.exec('reset role');
    const foreignPhase = (await first('select id from public.phases where project_id=$1 limit 1', [otherProject])).id;
    await as(member);
    await assert.rejects(() => db.query('update public.tasks set phase_id=$1 where id=$2', [foreignPhase, task]), /foreign key/);
    await assert.rejects(() => db.query('update public.tasks set project_id=$1 where id=$2', [otherProject, task]), /row-level security/);
  });
  await check('members cannot archive projects or spoof activity', async () => {
    await assert.rejects(() => db.query('update public.projects set archived=true where id=$1', [project]), /Only the studio owner/);
    await assert.rejects(() => db.query("insert into public.activities(studio_id,actor_id,action,subject) values($1,$2,'created','forged')", [studio, owner]), /permission denied/);
  });
  const comment = (await first('insert into public.comments(studio_id,project_id,author_id,body) values($1,$2,$3,$4) returning id', [studio, project, member, 'Review tomorrow.'])).id;
  await as(owner);
  await check('comment authorship is enforced for edits and inserts', async () => {
    assert.equal((await db.query('update public.comments set body=$1 where id=$2 returning id', ['Forged', comment])).rows.length, 0);
    await assert.rejects(() => db.query('insert into public.comments(studio_id,project_id,author_id,body) values($1,$2,$3,$4)', [studio, project, member, 'Forged']), /row-level security/);
  });
  await check('owners cannot remove themselves', async () => { await assert.rejects(() => db.query('select public.remove_member($1)', [owner]), /owner cannot be removed/); });
  await db.query('update public.projects set archived=true where id=$1', [project]);
  await as(member);
  await check('archived projects reject new tasks and comments', async () => {
    await assert.rejects(() => db.query('insert into public.tasks(studio_id,project_id,title) values($1,$2,$3)', [studio, project, 'Forbidden']), /row-level security/);
    await assert.rejects(() => db.query('insert into public.comments(studio_id,project_id,author_id,body) values($1,$2,$3,$4)', [studio, project, member, 'Forbidden']), /row-level security/);
  });
  await as(owner);
  await first('select public.remove_member($1)', [member]);
  await check('removing a member clears task assignments, including archived projects', async () => assert.equal((await first('select assignee_id from public.tasks where id=$1', [task])).assignee_id, null));
  await as(member);
  await check('removed members immediately lose data access', async () => {
    assert.equal((await db.query('select * from public.projects')).rows.length, 0);
    assert.equal((await db.query('select * from public.comments')).rows.length, 0);
    await assert.rejects(() => db.query('select public.create_project($1::jsonb)', [JSON.stringify({ name: 'No' })]), /membership required/);
  });
  await as(owner);
  const revokedToken = (await first("select public.create_invitation('guest@studio.test') as token")).token;
  const invitationId = (await first("select id from public.invitations where email='guest@studio.test' order by created_at desc limit 1")).id;
  await first('select public.revoke_invitation($1)', [invitationId]);
  await as(guest);
  await check('revoked invitations cannot be accepted', async () => { await assert.rejects(() => db.query('select public.accept_invitation($1)', [revokedToken]), /invalid or has expired/); });
  await as(owner);
  const expiredToken = (await first("select public.create_invitation('guest@studio.test') as token")).token;
  await db.exec('reset role');
  await db.query("update public.invitations set expires_at=now()-interval '1 day' where email='guest@studio.test'");
  await as(guest);
  await check('expired invitations cannot be accepted', async () => { await assert.rejects(() => db.query('select public.accept_invitation($1)', [expiredToken]), /invalid or has expired/); });
  await as(owner);
  await check('one studio per account is enforced atomically', async () => {
    await assert.rejects(() => db.query("select public.create_studio('Duplicate')"), /unique constraint/);
    assert.equal((await first('select count(*)::int as n from public.studios')).n, 1);
    assert.notEqual(studio, otherStudio);
  });
  console.log(`\n${checks} database checks passed.\n`);
} finally { await db.close(); }
