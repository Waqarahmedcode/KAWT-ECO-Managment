# KAWT — Start here / project handoff

Updated: 24 November 2026. This is the continuation checkpoint for a new chat.

## Repository and live system

- Repository: `Waqarahmedcode/KAWT-ECO-Managment`.
- Resume the latest `main`. The release branch is `codex/kawt-staff-onboarding-2026-11-24`.
- Current development checkout: `/workspace/kawt-preview-implementation`. Older checkouts and ZIPs are historical snapshots; verify the remote and revision before using them.
- Main dashboard: https://kawt-eco-managment-preview.netlify.app/dashboard
- Medical Centre: https://kawt-eco-managment-preview.netlify.app/medical-centre
- Department entry: https://kawt-eco-managment-preview.netlify.app/lab/visits
- Staff access requests, approvals and assignment manager: https://kawt-eco-managment-preview.netlify.app/lab/access
- Staff signup / sign-in: https://kawt-eco-managment-preview.netlify.app/lab/login
- Historical source editor: https://kawt-eco-managment-preview.netlify.app/lab
- Source reports and comparisons: https://kawt-eco-managment-preview.netlify.app/lab/reports
- Hosting: existing Netlify site `kawt-eco-managment-preview`, GitHub `main`, Node 24 / Next.js runtime. Do not create a replacement site merely to resume.
- Backend: Supabase project `ftuyaeljayonfaxolwqi`, PostgreSQL/RLS and Supabase Auth. The runtime uses Drizzle/SQL and a custom service worker; Prisma/next-pwa belong to the older blueprint.
- Latest functional deployment: `e975921` (staff onboarding, admin notifications, approvals and access revocation). Netlify deployment `6b05506ef092732de7c1ef44`. Later documentation commits use `[skip netlify]`. Deployment evidence: `docs/LAB-ONBOARDING-LIVE-2026-11-24.json`.

## Verified checkpoint

- Owner account verified and first administrator bootstrapped. Do not repeat owner signup or create dummy users.
- Doctor source imported: 11 OPD and 4 Urgent Care entries, separately editable, with reference fees and audit. Records are source drafts, not verified live availability.
- Private Lab register: 85 source test options, patient/name or reference, quantities, referrals, paid/free/subsidized/panel categories, reference prices, saved visits, corrections and reversible cancellation.
- Pakistan date/time, configuration valid-from boundaries, scoped staff permissions, aggregate-only viewer access, duplicate/retry protection, Excel/CSV and print/PDF are implemented.
- Old aggregate reports and patient entries remain separate; do not double count or manufacture daily patients from a monthly report.
- Staff can sign up, confirm their email and request Lab access. Admin sees an in-app pending badge, approves/rejects with assigned laboratory/access, and changes/revokes existing grants. Signup grants no Lab/admin permissions. Decisions and assignment changes are audited; requester isolation, stale-update protection and revocation are enforced server-side.
- 54 unit tests, optimized production build, disposable SQL/API/browser checks and deployed private-route checks passed. Migrations through `202611240020` are applied; the required 52 tables have RLS and the receipt bucket is private.
- Signup UI/confirmation routing was tested with a mocked response; real staff first-signup/email delivery remains operational acceptance. No invitation/notification emails were sent; notification badges are in-app.
- No live test patients or test Auth accounts were created. Historical camps remain six past and six planned source records.
- July 2026 private aggregate sample and eight package drafts are NOT live-imported. Actual Lab shift hours, reference rates and real staff grants still need their source configuration.

## Resume next

1. Read `docs/NEXT-SESSION-BACKLOG-2026-11-24.md` and the latest live verification. Older dated review documents describe earlier checkpoints.
2. Verify Git state, the current Netlify deployment and private configuration; preserve existing edits and user data.
3. Staff onboarding/access requests are deployed. Start with actual shift/rate configuration and historical source import. Then extend separate OPD and Urgent Care registers.
4. Keep automatic billing in the existing reception software. The requested portal is for entries, references, performance and source analysis.
5. Logo upload and interface simplification are pending. Organization-wide data reset/new-data setup was explicitly deferred; no reset was performed.
6. Reuse the separately existing financial-analysis app after its URL/source is supplied; do not silently replace it. Personal Gmail/WhatsApp conversations were unrelated to this project.

## Environment and checks

- Private hosting credentials and actual owner email are not in Git. A fresh chat/environment must reconnect the repository and authorized hosting configuration; this file does not transfer credentials or guarantee automatic access.
- Direct PostgreSQL access from this cloud workspace has been refused. Netlify cloud builds successfully run the guarded initializer and read-only readiness check. Do not assume a database password reset is needed.
- Netlify build: `npm run build:netlify`; it applies guarded migrations, checks existing owner/source import, verifies schema readiness and builds Next.js before publishing.
- Local checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`. Department integration scripts require disposable loopback databases and existing private local Auth fixtures. Never point those tests at live data.
- Read `AGENTS.md` and the installed Next.js documentation before application edits. The current Next version has version-specific behavior.
- New chat prompt: “Continue KAWT from the latest main of Waqarahmedcode/KAWT-ECO-Managment. Read START-HERE.md and docs/NEXT-SESSION-BACKLOG-2026-11-24.md first; resume from the verified live checkpoint, technical work before redesign.”
