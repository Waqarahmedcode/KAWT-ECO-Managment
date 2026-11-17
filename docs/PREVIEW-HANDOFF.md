# KAWT preview and handoff

## Routes

- `/` redirects to `/preview`.
- `/preview` is a public, read-only view of attached source summaries/plans, independent of staff authentication and database availability.
- `/dashboard` is the authenticated staff application. If backend variables are missing it shows an explicit unavailable view, never a silent source preview.

## Verified staging deployment

- Public preview: https://kawt-eco-managment-preview.netlify.app/preview
- Staff route: https://kawt-eco-managment-preview.netlify.app/dashboard (authenticated; anonymous users reach /login)
- Site administration: https://app.netlify.com/projects/kawt-eco-managment-preview
- Repository: `Waqarahmedcode/KAWT-ECO-Managment`, `main`, root directory.
- Initial verified deploy: `6afc37a626ebe0a88479fe5a`, application revision `79ce2cd`.
- Desktop/mobile screenshots and verification results are retained in `docs/screenshots` and `docs/NETLIFY-VERIFICATION.json`.

## Hosting

The official `@netlify/plugin-nextjs` runtime is explicitly declared in `netlify.toml` and enabled for the staging site. Publishing raw `.next` output without the runtime produces missing routes/functions.

Use a new Netlify staging site and preserve existing sites. Link the repository root of `Waqarahmedcode/KAWT-ECO-Managment`, branch `main`, Node 24, frozen dependency installation and the committed Netlify Next.js build configuration. A static drag-and-drop upload/GitHub Pages cannot serve these server APIs. This source does not itself prove that a Netlify site has been authorized or deployed; the handoff status must include verified URLs or the precise pending blocker.

The source preview can be deployed before a database is ready. Staff operation requires private `DATABASE_URL`, public Supabase URL and publishable key, the exact HTTPS site origin and a private rate-limit salt. Never copy loopback/local development credentials to hosting. Configure Supabase Auth redirects for that HTTPS origin. Rotate passwords exposed in chat before real remote release.

Inspect the identified remote project's schema and migration history before applying the twelve ordered SQL migrations. No remote reset or blind Prisma schema push is allowed. Source-only seeding must not generate patient/donor/transaction fixtures or default project/camp placeholders. Create real production users through the governed signup/role process.

## Validation

Run `npm ci`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run test:data`. The non-mutating browser checks use loopback-only targets and never create synthetic business records:

```sh
KAWT_PREVIEW_TEST_URL=http://127.0.0.1:3002 npm run test:preview
```

For full local authenticated checks, supply a private existing local development-account path through `KAWT_PREVIEW_ACCOUNTS_PATH`. `KAWT_UNCONFIGURED_TEST_URL` may identify a second loopback server without database configuration. Screenshots/results are written to the ignored `.local/preview-validation` directory. Fixture-producing workflow suites belong on a disposable test database, not a source-only product database.

The download handoff must distinguish committed source, historical ZIPs and uncommitted tool-only changes. Preserve original uploads and a hash/duplicate manifest, include real dated screenshots and review reports, and exclude credentials, `.local`, dependencies, build output and auth stores. Store original-document bundles as owner-accessible draft release assets unless public document publication is explicitly approved.

## Read-only hosted database check

The backend:check script inspects schema metadata, migration versions, row-level-security flags and the private receipt bucket. It never seeds, migrates, resets or reads patient/donor records. Queries run within a PostgreSQL READ ONLY transaction with timeouts and remote TLS certificate verification. Logs contain a sanitized KAWT_BACKEND_READINESS JSON summary, never connection strings or exception messages.

For a hosted check, configure the private KAWT_READINESS_DATABASE_URL in Netlify, production context. Paid plans can additionally restrict it to builds with the secrets controller. The current plan requires a standard account-protected private variable with default scopes; its name is never prefixed NEXT_PUBLIC_, so it is not exposed to browsers. This is independent of runtime DATABASE_URL; the check does not enable the staff application. The Netlify build runs it before Next.js. A failed backend check leaves the source preview available; KAWT_READINESS_STRICT=1 makes a standalone check fail for unavailable or incomplete backends. Remove the temporary readiness credential after the check. Rotate the earlier chat-exposed database password before real staff release.

The hosted PostgreSQL endpoint was reachable, but needed the Supabase public database CA for chain validation. The readiness check now trusts the vendor CA only for Supabase hostnames and keeps full certificate/hostname verification enabled. Certificate provenance and SHA-256 are recorded in data/certs/README.md.

## Guarded initialization of the selected project

The initializer is inactive unless KAWT_INITIALIZE_PROJECT_REF explicitly identifies the selected Supabase project. It requires the matching pooler user/project reference and an empty KAWT namespace: no existing KAWT tables, functions, types, migration versions, authentication trigger or receipt storage objects. Unrelated project objects, rows, migration history and storage buckets are preserved. An already initialized KAWT migration set is preserved. Partial or colliding KAWT schemas are refused.

Initialization applies the twelve committed SQL migrations in order and imports only the six supplied historical and six documented planned camps, in one transaction. It validates 2,912 historical attendees, PKR 2,416,571 expenditure, twelve camp rows, zero live patient/donation/default KAWT project records and zero created accounts before commit. Any error rolls back. Public source summaries remain separate from operational patients.

Shared PostgreSQL TLS verification is used by the initializer, readiness check, seed CLI and runtime pool. The public Supabase CA is explicitly packaged in the Netlify function. The initializer and readiness flags are removed after setup; production runtime variables are configured independently.

The isolated initialization test creates and removes its own local database, verifies first import, unchanged repeat, all required schema/RLS/private bucket checks and refusal of the existing local product database. It refuses remote targets.

The selected remote project contained unrelated objects, so the initial whole-namespace guard stopped without writes. Initialization now checks every KAWT table/function/type/trigger/storage-policy/migration name specifically; unrelated objects remain untouched. The isolated test proves that an existing unrelated table and row survive initialization and repeat runs.
\nAuthentication provisioning uses KAWT-prefixed trigger/function names so existing unrelated account hooks remain intact. Other migration-history entries are retained, and repeat setup recognizes the KAWT versions as a subset of that history. The isolated test covers retained unrelated rows, migration versions and authentication hooks.\n
Coexisting storage policies are constrained with KAWT-bucket-only restrictive rules: anonymous/donor receipt access is blocked, managers read and administrators write, and the receipt bucket cannot be changed to public. Unrelated buckets retain their existing access rules. The disposable validation covers these behaviors even with deliberately broad pre-existing policies.

## First real administrator

KAWT_FIRST_ADMIN_EMAIL is a private server variable chosen by the owner. The build may activate an existing verified account; otherwise a verified sign-in or confirmation callback activates that same account. This never creates an authentication account, invents a password, sends an operator email, or grants roles from user-editable metadata. Verification must come from the database's email challenge or a trusted identity for the exact configured email.

The first grant is serialized and audited. Existing administrators or an existing bootstrap marker close automatic activation, including after revocation. Remove the private bootstrap setting after administrator activation if desired.

For email links, set the Supabase Auth Site URL to the canonical HTTPS site and add its /auth/callback redirect. Passwords and provider keys belong in private settings or the account holder's browser.
