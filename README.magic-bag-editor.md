# Magic Bag Editor

A React/strict-TypeScript editor backed by [Supabase](https://supabase.com/). It includes owner/admin authentication, owner-managed email invitations, schools, and draft class-pack metadata. Parent onboarding, setup requests, timetable/media data, packing contents, and publication remain outside this milestone. Shared packs contain no child names.

## Requirements

- Node.js 22 or newer and npm.
- Docker for the local Supabase stack.
- Pinned `@supabase/supabase-js` SDK `2.117.2` and Supabase CLI `2.119.0`, installed by `npm ci`.
- Existing React 18 / strict TypeScript / Vite stack.

The static site and the backend deploy independently: Vite produces the frontend; Supabase supplies Auth, Postgres, and the `editor-admin` Edge Function. No application server binary or backend data directory belongs in the Pages output.

The npm wrapper bundles the Edge Function with the SDK installed from the lockfile before starting or deploying it. Local containers therefore need no package-registry access. The generated bundle is ignored by Git; `npm run supabase:build` rebuilds it explicitly, and `npm run supabase:functions` watches source changes while serving.

## Local setup

```bash
npm ci
npm run supabase:start
npm run dev:all
```

Start Docker before starting Supabase. Its first run downloads the local service images and applies `supabase/migrations/`. `dev:all` starts or reuses the stack and passes its URL and public key directly to Vite, so no frontend env file is needed for this workflow. Open `http://localhost:5173/magic-bag-editor.html#login` after the services are ready. Stop Vite with Ctrl+C and use `npm run supabase:stop` when you also want to stop the backend.

The local stack includes Auth, Postgres, the API, Studio, captured mail, and the Edge Function runtime. Realtime, storage, image processing, analytics, and connection pooling are excluded because this editor does not use them. Startup creates `supabase/functions/.env` with the non-secret local `EDITOR_SITE_URL` only if that file does not exist.

When running `npm run dev` separately or using a hosted backend, browser configuration uses the API URL and public key:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<your-project-public-key>
```

`VITE_SUPABASE_ANON_KEY` is also supported when using a project's legacy anon key. These are public browser settings; never put a service-role key or secret key in a `VITE_` variable. For a hosted backend, copy `.env.example` to an ignored local env file and replace the placeholders with the project's URL and public key.

Useful local commands:

| Command | Purpose |
| --- | --- |
| `npm run supabase:status` | Show local service URLs without printing keys. |
| `npm run supabase:functions` | Serve Edge Functions locally during function development. |
| `npm run dev` | Run only Vite after backend and env configuration are ready. |
| `npm run supabase:stop` | Stop the local stack. |
| `npm run supabase:reset` | Reapply migrations after resetting the local database; deletes local database data. |

Local authentication mail is captured by the local mail service at `http://127.0.0.1:54324`; SMTP credentials are unnecessary for local testing. Keep the frontend at `http://localhost:5173` so native email links match the configured local redirects.

## Bootstrap the first owner

Public signup is disabled. The first owner must be created through trusted backend administration, rather than through the editor.

1. In the Supabase dashboard, create an Auth user with your email, a strong password, and email confirmation enabled. For local development, use Studio at `http://127.0.0.1:54323`.
2. Copy that user's UUID from Authentication → Users.
3. Run this SQL in the project's SQL editor, substituting the UUID. For a local stack, run it against the local Postgres database.

```sql
insert into public.editor_users (id, approved_email, role, enabled)
select id, lower(trim(email)), 'owner', true
from auth.users
where id = '<confirmed-auth-user-uuid>'::uuid
  and email_confirmed_at is not null;
```

Confirm that one row was inserted, then sign in to the editor. This bootstrap keeps passwords in Supabase Auth and does not expose an administrative key to the browser. It does not overwrite an existing membership row.

## Email invitations and revocation

An owner invites an admin from the editor's administration page. The `editor-admin` Edge Function validates the caller's session and current owner membership, normalizes the address, prepares a pending membership, and asks Supabase Auth to send a native invitation or recovery email. The email returns to `/magic-bag-editor.html?setup=1`. After setting a password, the frontend calls `complete_editor_setup` to activate access.

Pending members cannot edit until password setup completes. Resending reuses the pending membership; mail failures are reported so the owner can retry. Re-enabling a revoked admin requires the owner's explicit approval in the editor. Owners cannot revoke other owners through this route.

Revocation disables database access immediately through membership checks. The function also rotates the Auth password, invalidates sessions and outstanding setup links, and records the session cutoff in the membership. An old token or previously opened link cannot restore access.

For a hosted project, configure a production SMTP provider in Supabase Auth and use Supabase's standard invitation/recovery email templates. Preserve the native confirmation URL so Supabase can verify the link and redirect to the editor's setup page. Local mail capture is intended for development and isolated tests.

## Security model

`editor_users` is the whitelist, separate from `auth.users`. Browser clients cannot create or change memberships. The membership's approved email is immutable, and authorization requires a confirmed Auth email matching it, an enabled membership, completed password setup, and a session newer than any revocation cutoff.

Postgres row-level security enforces these checks on `schools` and `class_packs` for every request. `current_editor` returns a validated current member; `list_editor_users` and the administration Edge Function require an owner. Database constraints validate metadata and prevent duplicate class identities. Auth alone does not grant editor access.

The browser uses a namespaced session store and refreshes/validates the session before protected rendering. Failed validation clears protected state. Administrative Auth access belongs only in the Edge Function's server runtime; public browser keys rely on row-level security.

## Checks

```bash
npm run lint
npm test
npm run build
npm run test:integration:local
```

Start the local stack before running `test:integration:local`. The wrapper obtains local credentials in memory, provisions temporary accounts and test records, reads captured invitation mail, and cleans up its fixtures. It covers authentication, setup, privilege boundaries, revoked-token access, duplicate class identities, and persisted metadata edits. Run it only against the local test backend; never supply production administrative credentials to a test run.

`npm run test:integration` runs the underlying suite for an explicitly configured isolated test stack, using `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`, and `SUPABASE_TEST_MAIL_URL`. Prefer the local wrapper, which supplies these without saving credentials to files.

## Hosted Supabase and deployment

1. Create a Supabase project. Use the project's URL and publishable key for the frontend.
2. Authenticate the CLI and link this checkout to the project:

   ```bash
   npm run supabase -- login
   npm run supabase -- link --project-ref <project-ref>
   ```

3. Set `EDITOR_SITE_URL` in the Edge Function's secrets to your frontend origin, such as `https://idangib.github.io`. Supabase injects the function's backend URL and administrative credentials; keep them server-side. Use Supabase's secret settings for secret values, never tracked files or frontend variables.
4. Review the migration, then apply it and deploy the administration function:

   ```bash
   npm run supabase -- db push
   npm run supabase -- functions deploy editor-admin
   ```

5. In Auth URL configuration, set the site URL to the frontend origin and allow the exact redirect `https://idangib.github.io/magic-bag-editor.html?setup=1` (substitute your deployment origin). Keep public signup disabled, require passwords of at least 12 characters, and set email link expiry to 30 minutes to match local settings. Configure SMTP and bootstrap the first confirmed owner as described above.
6. Configure the GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then build/deploy the Vite frontend through the existing Pages workflow. These values are public and baked into the frontend at build time; changing them requires a rebuild.

Backend deployment, secret configuration, and invitations are explicit administrator actions. Local setup and tests do not deploy a hosted project or email real users. Back up the hosted database through Supabase's supported backup facilities and retain the checked-in migration history.
