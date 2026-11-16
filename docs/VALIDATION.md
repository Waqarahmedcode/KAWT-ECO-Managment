# Validation — 12 November 2026

Verified on the selected managed Linux cloud environment, using the production Next.js server and isolated local Supabase PostgreSQL/Auth/Storage. These results do not verify Windows execution, a remote database, public/private Internet hosting, or live external providers.

| Check | Completed result |
|---|---|
| Frozen dependency installation | `npm ci` passed with the current lockfile; Supabase JS pinned to 2.49.0 for SSR compatibility |
| TypeScript / ESLint | Passed again after portable startup and delivery changes |
| Production build | Passed, 29 static generation targets plus dynamic API/page routes and session proxy |
| Pure contracts | 11 passed: IBAN, Zakat, cohort forecasting, currency/consent boundaries, authenticated encryption, Meta/Stripe signatures, unsubscribe/document expiry, A4 PDF rendering and WhatsApp transport failure states |
| Local payment database contract | 1 passed: duplicate events, amount mismatch rollback, net partial refunds, PayPal reconciliation, missing/refunded certificate gates and evidence snapshot; the entire synthetic transaction rolled back |
| Production browser/API/database/storage workflows | 18 passed, no skipped checks, zero external payments/messages and no remote DB changes |
| Source data arithmetic | Passed with 13 explicit historical quality warnings retained |
| Integration worker / retention preparation | Dry runs passed; no external requests/messages and no retention jobs created |
| Portable startup command | Passed on Linux against actual SQL/Auth/private storage; Windows Docker Desktop remains untested |
| Original source preservation | Historical/planned JSON byte-identical, full report byte-identical, Android archive difference count 0; original Git configuration checkout clean |

The eighteen workflows cover authenticated/anonymous access, site assessment and approval, whitelisted server pagination, browser patient registration, UID retry safety, closed-history write rejection, **production offline-shell reload**, encrypted intake/vitals with wrong-key rejection and synchronization, consultation/referral follow-up, clinical prevalence, calculated honoraria, dispensing/oversell/adjustment approval, Zakat eligibility/journal reversal and role separation, capital/WASH, scoped CSR access, donor pledge idempotency, synthetic bank reconciliation with owned PDF download, protected reports/insights, actual local SQL/Auth checks, private Storage upload/download, direct database permission checks and CSRF rejection.

The local stack was stopped with backup enabled and restarted without deleting data; the updated local auth callback configuration is active. Some inherited-proxy Docker health probes still display `unhealthy`; native Auth and Storage HTTP requests and actual SQL queries passed. An early production workflow ran before Storage finished restarting and failed upload readiness; after Storage returned HTTP 200 the complete workflow passed. No failing assertion was disabled.

Provider contract tests use synthetic events/stub transport. They do not demonstrate real Stripe, PayPal, Meta, WhatsApp or Google connectivity. Tax certificate tests use explicit synthetic evidence inside a rolled-back local transaction; no institutional claim was verified and no certificate was issued to a real donor.

An interactive preview URL was not created. This environment offers no supported private forwarding/preview URL tool. The coordinating chat's Vercel lookup reported a team-scope 403 requiring team access; no project/deployment target was established and nothing was deployed. PNG previews were transferred privately to that Windows chat. The existing cloud app address is not a usable URL on the user's PC.

Remaining specified but unfinished features are listed in `REQUIREMENTS.md`: local merchant adapters, TikTok/direct spend synchronization, validated regional/AI models, live hazard/HeRAMS integration, full generated report layout parity and complete conversion-funnel reporting. These are distinct from absent live configuration. The core application is a tested development implementation, not an assertion of whole-product production completion.
