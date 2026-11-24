# Archiflow

A bilingual English/Arabic organizer for architecture studios. The React frontend deploys to **Vercel** from [yazanhazem/archiflow](https://github.com/yazanhazem/archiflow). Supabase provides authentication, PostgreSQL data, database access policies, and Realtime updates.

## What is included

- Public English/Arabic landing page with demo access, account entry, theme controls, and a free early-access overview. Paid subscriptions are not connected yet.
- Confirmation email resending and dismissible studio invitations.
- Dashboard with shortcuts to active projects, open tasks, overdue tasks, and tasks due within seven calendar days.
- Project task lists grouped by phase and a status board with keyboard-accessible status controls. Both views support direct links.
- Projects with six editable architectural phase names, notes, safe external reference links, status, date ranges, and archive/restore.
- Tasks with one assignee, phase, priority, status, and due date.
- Desktop monthly calendar and mobile deadline agenda.
- Project discussion with author-controlled edits/deletion, plus database-generated activity history.
- One private studio per user, owner/member roles, expiring email-bound invitation links, and member removal.
- English/Arabic switching and right-to-left layouts. User-entered content is preserved in its original language.
- Follow device, Light, and Dark themes in Settings → Appearance. The browser remembers the selected theme.
- A separate browser-local demo. Without configuration, the app opens the clearly labeled demo. Choose **Connect your studio** to see setup requirements. Demo invitations cannot grant real access, and demo data is never uploaded when you connect.

No file uploads, subscriptions, client portal, email notifications, offline synchronization, or drawing viewer are included. Invitations are shared manually by copying a link; authentication emails are sent by Supabase.

## Run locally

Use **Node.js 24** and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. You can explore and edit the demo immediately; changes stay in this browser. Settings includes a reset option that replaces demo changes with sample data.

For real collaboration, copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Restart Vite after changing these values. Use **Connect your studio** if the demo is open. These two values are public frontend configuration, not privileged credentials. Never use a Supabase secret/service-role key or database password in `VITE_` variables, source code, or build artifacts.

## Configure Supabase

1. Create a Supabase project. In its SQL Editor, run the complete contents of `supabase/migrations/001_studio.sql` **once**, against a new database. The migration is transactional and creates tables, policies, database functions, triggers, indexes, and Realtime publication entries. It is not an idempotent migration for an existing installation.
2. Under Authentication, enable email/password sign-in and **keep email confirmation enabled**. The application requires verified accounts before studio creation or invitation acceptance.
3. Set Authentication → URL Configuration → Site URL to your actual production Vercel domain or custom domain with a trailing slash, for example `https://YOUR_PROJECT.vercel.app/`.
4. Add these exact allowed Redirect URLs, replacing the sample origin/path:
   - `https://YOUR_PROJECT.vercel.app/`
   - `https://YOUR_PROJECT.vercel.app/?flow=recovery`
   - Your printed local development URL, e.g. `http://127.0.0.1:5173/`
   - The same local URL with `?flow=recovery`
5. Keep the default Supabase confirmation/recovery templates or ensure custom templates link through `{{ .ConfirmationURL }}`. The app uses PKCE and handles query-string callbacks before its hash router. Confirmation/reset links should be opened in the same browser that requested them. Open the original studio invitation again after confirming an account if your email app opened a different tab or browser.
6. Configure a production SMTP provider in Supabase before inviting a real team; the built-in mail sender has delivery/rate restrictions. No SMTP credentials belong in this repository or the browser.
7. Get the project URL and **publishable** API key from Supabase and configure the local variables above or the Vercel environment variables below.
8. Create and verify your first account, sign in, and create your studio. On Team, create an invitation for a teammate's email and copy the link. Only the matching verified email can accept it. An invitation expires in seven days and is single-use; creating another for the same email revokes the earlier unused link.

Owners manage membership, invitations, studio names, and archive/restore. All members can edit shared projects, phases, and tasks. Authors control their own comments. Archived projects retain their tasks and discussion and are read-only until restored. Removing a member clears their task assignments and immediately removes their database access; their historical comments and activity remain attributed while their profile exists.

## Deploy to Vercel

The repo includes `vercel.json` with the Vite framework preset, `npm ci`, `npm run build`, and `dist` output. Node.js 24 is specified in `package.json`. Vercel serves the built frontend, and Supabase handles accounts and shared data.

1. In Vercel, choose **Add New → Project**, connect GitHub, and import `yazanhazem/archiflow`.
2. Keep the root directory at the repository root, framework **Vite**, and production branch **main**. The checked-in configuration supplies the build settings.
3. Under Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with your public Supabase values for **Production**. If omitted, the published site runs in local demo mode.
4. Choose **Deploy**. After the initial import, pushes to `main` trigger production deployments. Pull requests can receive Vercel preview deployments.
5. Use the domain Vercel actually assigns to configure the Supabase Site URL and redirect allowlist above. When adding a custom domain later, update those URLs too. Environment variable changes require a new deployment.

The app uses root asset paths and `#/…` routes, so project links, invitation links, and page reloads work at your Vercel domain without a rewrite rule. The repository name is not part of the deployed URL. `npm run build` produces `dist/`.

Preview deployments run in local demo mode unless you explicitly configure Preview environment variables. Use a separate Supabase project for shared preview data and allowlist the exact preview URLs you use for authentication. Production data should stay in the production Supabase project.

GitHub Actions runs unit tests, database policy tests, and a build on pushes and pull requests using `.github/workflows/ci.yml`. Vercel controls deployment independently, so these GitHub checks do not automatically gate a Vercel deployment. See [Vercel Git integration](https://vercel.com/docs/git) and [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Verification

```sh
npm test
npm run test:db
npm run build
```

`npm test` checks deadline boundaries, dashboard counts, calendar and progress calculations, reference URLs, and how the app handles a confirmed write followed by a failed refresh. `npm run test:db` runs the migration and access policies in an in-memory PostgreSQL engine (PGlite) with Supabase's auth schema simulated. It checks isolation, anonymous access, owner and member permissions, invitation lifecycle, authorship, cross-studio references, archival, and member removal. Hosted email delivery and Realtime transport require a configured Supabase project to verify.

Before using real client data, check the connected deployment with two accounts: sign up/confirm, create a studio, accept an invitation, create/edit tasks, verify updates across tabs, reset a password, and remove a member. Confirm that the removed member cannot fetch studio data. Check a project deep link and a page refresh at the production domain. Repeat key screens in Arabic and on a narrow display.

Realtime updates and focus/reconnect refresh keep views current. Notes preserve a local draft while editing. Other record edits use normal last-successful-write behavior; this release has no collaborative text editor or offline write queue. Data is not backed up to GitHub. Configure database backups separately in Supabase.

## Files and interfaces

- `src/`: React views, English/Arabic translations, demo storage, and Supabase client/data controller.
- `supabase/migrations/001_studio.sql`: schema, RLS policies, restricted grants, and transactional functions.
- `scripts/test-database.mjs`: PostgreSQL authorization/invitation integration checks.
- `.github/workflows/ci.yml`: automated checks; `vercel.json`: Vercel deployment settings.

Database functions available to signed-in users: `create_studio(studio_name)`, `create_project(project_values)`, `create_invitation(invited_email)`, `accept_invitation(invitation_token)`, `revoke_invitation(invitation_id)`, `remove_member(target_user_id)`, and `update_studio(new_name)`. Permission checks happen in PostgreSQL, independently of the visible UI. Invitation tokens are hashed at rest, omitted from normal reads and activity, and excluded from Realtime publication. The frontend renders all user text as plain text and only opens HTTP(S) reference links.
