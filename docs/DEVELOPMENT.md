# Phased terminal execution and delivery guide

## Phase 1 — database and infrastructure

Use the existing isolated environment and working directory. Do not create a Git worktree unless explicitly requested. The edited web source is `/workspace/projects/kawt-web`; `/workspace/test-struct-` is a different, unchanged configuration checkout. Preserve `/workspace/projects/kawt-android`.

Requirements: Node 22+, npm, Docker, Python 3. Chromium is needed for browser validation. In this prepared cloud environment Chromium is `/usr/bin/chromium`. Verify the managed Docker daemon rather than starting a competing daemon.

```sh
cd /workspace/projects/kawt-web
npm ci
npm run db:local
```

The local script checks the local Docker socket, starts the required Supabase services if absent, writes loopback bindings into `.env.local` with mode 600, applies local migrations, verifies actual SQL and authentication requests, prepares six synthetic roles and seeds data. It refuses remote runtime values. Existing custom local settings and passwords are preserved. Local account credentials live only in `.local/accounts.json` (600); do not paste them into chat or commit them.

The cloud sandbox restricts writes to the CLI's home telemetry directory. The agent may need an approved `require_escalated` execution for **the same isolated local Supabase command**, not for application requests. Do not weaken TLS or change the shared Docker daemon. The startup command excludes optional Studio/analytics/realtime services and uses `--ignore-health-check` because inherited proxy settings cause some BusyBox localhost probes to falsely fail. Actual native API/SQL checks remain mandatory; Docker health flags are not claimed green.

If Supabase was already running when `supabase/config.toml` auth URL settings changed, those auth settings take effect on its next start. Preserve its data and restart only this local stack when no test is using it. Local email confirmations are disabled; the local mail catcher is for development only. Production email/redirect configuration is separate.

## Phase 2 — integrated application and validation

```sh
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Use a browser on that same machine. The dashboard redirects unauthenticated users to login; public giving works at `/donate`. Localhost is not an external preview link. The source fallback exists only when database configuration is absent and does not prove operational functionality.

From a second terminal:

```sh
npm run test:data
npm run test:unit
node --env-file=.env.local --import tsx --test tests/payment-database.test.ts
npm run test:workflows
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Workflow tests refuse remote app/database targets, use clearly labelled synthetic fixtures and remove only their own records. Payment database contracts roll back their entire transaction, including synthetic certificate evidence; no test certificate is retained. Signature/WhatsApp unit tests use synthetic inputs and stub transport; they do not prove a live provider connection. Browser workflows exercise real local Auth/PostgreSQL/Storage, including encrypted offline capture/sync, clinical referrals, pharmacy, eligibility/ledgers, WASH and CSR restrictions.

For production-mode local checks, stop only the dev server you started, then:

```sh
npm run start -- --hostname 127.0.0.1 --port 3001
npm run test:workflows
```

Do not run dev and production servers against the same `.next` output concurrently. Offline-shell reload/cache verification must use the production build, not dev HMR assets.

## Phase 3 — authorized cloud binding and release

Remote configuration is deferred, not a reason to stop coding. When a target is supplied, confirm the intended development Supabase project, configure secure runtime settings from `.env.example`, inspect the network route for PostgreSQL and HTTPS, and run read-only SQL/session/health checks. Connector access does not substitute for app credentials. Do not push schema/seed to an ambiguous project.

For an explicitly approved empty development target, apply the ordered Supabase migrations and review source seeding separately. Create production staff through the governed account process, never by copying local bootstrap accounts. Set HTTPS site/auth redirect URLs and a production email provider. Configure private storage, backups, access review, retention and the operator-run integration worker before real patient use.

Build with `npm ci` and `npm run build`; serve with `npm run start` in the selected Node hosting platform. A private staging deployment and its access controls need an identified hosting target. No public deployment, remote migration, live messaging or paid provisioning was performed here.

Delivery archives exclude `.env.local`, `.local`, credentials, `node_modules`, `.next`, logs and test caches. Keep the original uploaded archives and institutional references separately with their checksums. The prepared cloud snapshot and saved setup draft do not establish successful publication or restoration in a new task.
