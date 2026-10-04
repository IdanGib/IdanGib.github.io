# Magic Bag Editor (first milestone)

A React/strict-TypeScript editor backed by PocketBase. It includes owner/admin authentication, owner-managed email invitations, schools, and draft class-pack metadata. Parent onboarding, setup requests, timetable/media data, packing contents, and publication are deliberately out of scope.

## Pinned versions

- PocketBase server `0.40.4`
- Official `pocketbase` JavaScript SDK `0.28.1`
- Existing React 18 / TypeScript 5.5 / Vite 5 stack

## Local setup

1. Run `npm install` and copy `.env.example` to `.env`.
2. Download PocketBase 0.40.4 for your OS into `pocketbase/pocketbase` and make it executable. Do not commit it.
3. Start once with `npm run pocketbase`; migrations apply automatically.
4. Create the first PocketBase superuser locally: `./pocketbase/pocketbase superuser create you@example.com 'a-long-unique-password' --dir pocketbase/pb_data`.
5. Open `http://127.0.0.1:8090/_/`, create one `editor_users` record with matching lowercase `email` and `approvedEmail`, `role=owner`, `enabled=true`, `verified=true`, and a strong password. The dashboard is the only bootstrap path; no superuser credential reaches the frontend.
6. Run both services with `npm run dev:all`, or separately with `npm run pocketbase` and `npm run dev`. Open `/magic-bag-editor.html#login`.

## Email invitations

Configure PocketBase **Settings → Mail settings** with SMTP and set the application URL to the Vite origin (production: the public site origin). For local tests, Mailpit is convenient: run `docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit`, then configure SMTP host `127.0.0.1`, port `1025`, no TLS/auth, and inspect mail at `http://127.0.0.1:8025`.

An owner invitation normalizes the address, creates a disabled-for-login pending admin with a random server-generated password, and sends PocketBase's native password-reset email. The reset template links to `magic-bag-editor.html#setup?token=…`. Reset tokens expire after 30 minutes. Mail failures are returned as failures, leaving the pending record available for retry. Pending reinvites reuse the record; revoked accounts require the route's explicit `allowRevoked` approval. Revocation rotates the token key, and reset confirmation also checks membership, so old auth/reset tokens cannot restore access.

## Security model

`editor_users` is the whitelist; public create/update/delete rules are locked. OAuth, OTP, and MFA are disabled. Collection rules require an authenticated, verified, enabled `editor_users` record whose current email equals immutable `approvedEmail`. Auth hooks repeat these checks at login and refresh. Owners alone can list members and use invitation/revocation routes. Metadata fields have server validation and the class identity has a database unique index. Shared packs contain no child-name field.

The browser uses a namespaced auth store and performs `authRefresh` before protected rendering. Failed refresh clears protected state. The backend remains the authority: every records request evaluates current membership rules.

## Checks and deployment

Run `npm run lint`, `npm run build`, and—with a clean test PocketBase and Mailpit—`npm run test:integration`. The integration test expects `PB_TEST_URL`, `PB_TEST_OWNER_EMAIL`, and `PB_TEST_OWNER_PASSWORD`; it covers login/refresh, invitation/setup, privilege boundaries, revocation with an old token, duplicate class identity, and persisted edits.

Deploy the Vite output as usual and deploy PocketBase separately on persistent storage with HTTPS, `pocketbase/pb_migrations` and `pocketbase/pb_hooks`. Set `VITE_POCKETBASE_URL` at build time and configure PocketBase CORS/application URL/SMTP for the public origin. Back up `pb_data`; never publish it or the executable in the static site.
