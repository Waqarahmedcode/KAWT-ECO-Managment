# KAWT execution report — 16 November 2026

The recovered web application runs in this cloud environment against isolated local Supabase PostgreSQL, Auth and private Storage. This is verified development operation, not a production release or completion of every requirement in the product roadmap.

## Source and runtime

- Source: `/workspace/kawt-recovered/kawt-web`, extracted from the uploaded `kawt-web-current.zip`.
- The original `/workspace/test-struct-` checkout was preserved. It contains configuration/documentation rather than the runnable web application.
- Installed the frozen dependencies with `npm ci --cache /workspace/.npm-cache`.
- Started the existing project's isolated local backend with `npm run db:local`; applied its migrations, created six synthetic local roles, and seeded historical/planned records.
- Rebuilt after generating local runtime bindings and again after the source-only data changes, then restarted the production server on port 3001.
- Internal application address: `http://127.0.0.1:3001`. This is on the cloud machine, not the user's Windows PC. No supported external preview forwarding tool is available in this session.
- Local secrets remain in `.env.local` and `.local/accounts.json`; do not publish, commit or include them in delivery archives.

## Checks executed in this session

| Check | Result |
|---|---|
| Frozen dependency install | Passed; 507 packages installed |
| TypeScript | Passed |
| ESLint | Passed |
| Unit contracts | 11 passed |
| Historical source-data audit | Passed, retaining 13 source-quality warnings |
| Production build | Passed, including a rebuild with local runtime bindings |
| Real local SQL / Auth / private Storage | Passed |
| Payment database contract | 1 passed; synthetic transaction rolled back |
| Production browser/API/database/storage suite | 18 passed; no skipped checks |
| Integration worker | Dry run passed; no external messages sent |
| Retention preparation | Dry run passed; no jobs queued |
| Authenticated dashboard | Rendered; key totals match uploaded screenshot |

The eighteen workflows cover camp approval, patient registration, server pagination, encrypted offline intake and sync, UID retry safety, historical write protection, consultations/referrals, clinical prevalence, honoraria, pharmacy/oversell/adjustments, Zakat and journal reversals, capital/WASH, scoped CSR, donor pledges, synthetic bank reconciliation/PDF, reports/insights, private evidence storage, database permissions and CSRF.

## Source-only product data correction

Following the user's explicit instruction, removed six automatically generated unassigned camp slots, three default WASH projects and four default capital projects. A private local backup of just those removed placeholder rows is retained for reversibility. The seed no longer generates these entries; reseeding preserves only the six historical and six source-planned camps from the delivered JSON files. Historical JSON snapshots were compared directly with the database and are unchanged.

Verified zero operational patients, donors, donations, ledger entries, referrals, consultations, staff roster entries and medicine-catalog records. WASH and capital project tables are empty until evidence-backed entries are supplied. Historical statistics/expense/medicine/disease summaries remain separate and preserved. Local development authentication roles and the audit trail are technical records, not imported historical personnel or transactions.

The workflow suite is now guarded by an explicit opt-in for a separate disposable test database, to prevent accidental fixture creation in this source-only product database. Its 18-workflow pass was recorded before this policy change; no fixture-producing workflow suite was rerun on the product database afterward. TypeScript, lint, source audit and production build passed again after the changes.

## Screenshot comparison

`kawt-dashboard-source-only.png` is the current authenticated full-page capture after removing placeholders. Branding, navigation and historical headline totals agree with the uploaded screenshot: 2,912 patients; PKR 2,416,571 expenditure; PKR 1,863,111 Zakat; PKR 553,460 general spending.

The delivered ZIP includes additional programme progress/charts, so the rendered page is not pixel-identical to the uploaded image. After the data-policy correction, its table contains the same twelve source camps, without six extra unassigned records. The progress heading no longer hardcodes eighteen camps.

## Remaining product development

Remote connection preparation now supports the supplied Supabase publishable-key format alongside the legacy/local anon key. TypeScript, lint, all eleven unit contracts and production build passed after the compatibility change; local login and the read-only Supabase connection check passed again. Remote Auth health returned 200 with the provided public key, while app-table API probes returned PGRST205. This does not establish that the whole remote project is empty. The PostgreSQL credentials and session-pooler URL were subsequently supplied and retained privately. Direct IPv6 failed with ENETUNREACH; IPv4 pooler connections on ports 5432 and 6543 were refused, including a read-only database attempt outside the command sandbox. Authentication/schema inspection has not been reached. A working database network route or authorized management access is the remaining prerequisite for inspecting migrations and importing source data. No remote data has been modified. Details are in `kawt-web/docs/REMOTE-CONNECTION.md`.

The delivered requirements document still identifies incomplete functionality: local PKR merchant adapters, TikTok and automatic ad-spend import, validated regional/AI models, live hazard/HeRAMS integration, exact generated operational-report layout parity, and complete conversion-funnel reporting. Passing the existing workflows does not finish these features. Their provider specifications, data sources, model validation and acceptance criteria must be established before implementing or asserting them complete.

## Requirements for live organizational use

1. Identify the intended private hosting target and development/production Supabase projects; supply runtime bindings through secure settings rather than chat. No remote migration was performed.
2. Configure real staff accounts/roles, HTTPS/auth redirects, production email, private storage, backup/restore and retention. Synthetic local accounts are not production accounts.
3. Configure payment and messaging providers where required, with appropriate merchant accounts, verified webhook settings, consent and approved templates. No real provider transactions or messages were executed.
4. Obtain reviewed treasury/bank details, institutional documents and an authorized signatory for applicable financial/certificate workflows.
5. Resolve the documented historical data gaps with source evidence; no missing clinical or demographic data was invented.

Some Docker Auth/Storage health labels show unhealthy under inherited proxy probes, while native HTTP, SQL and full authenticated storage workflows pass. This discrepancy is retained, not presented as a fully green infrastructure health check.

Source code changes implement the source-only seed, remove the hardcoded programme count from the UI, and guard fixture-producing workflow tests. No environment publication, public deployment, remote database modification or paid provisioning was performed. Old cloud-task state and the user's separate VS Code session were not inspected.
