# Department workspaces, central dashboard and Lead Management

This release extends the existing KAWT app and Supabase database. It does not replace the repository, existing Lab registers, doctor schedules, camp source records, finance modules or staff roles.

## Workspaces

- `/departments` lists only workspaces available to the current account. It links the existing Laboratory, camp, camp pharmacy, WASH, finance, Medical Centre and campaign modules.
- `/departments/opd` and `/departments/urgent-care` have separate patient/encounter registers. Staff record a name or reference, Pakistan date/time, explicit shift, department doctor, service, referral/MOU, paid/free/subsidized/panel category and optional reference/support amounts.
- The administrator assigns verified dedicated accounts an operator or aggregate-viewer grant per department, with revision checks and immediate revocation. Lab onboarding remains in its existing manager. General roles are not changed.
- Operators can correct or reversibly cancel visits. PostgreSQL enforces scope, doctor group, revision stamps and immutable audit. Viewers receive aggregates, not patient records or patient audit history.
- Tables report visits by shift, doctor, service and welfare category over a chosen date range. CSV and print/PDF performance exports exclude patient identifiers. Counts represent encounters, not deduplicated unique people. Cancelled entries do not enter totals.
- The independent pharmacy store, consumable stock/handover and full clinical results remain outside these new registers. Urgent Care does not add an inpatient/admission workflow.

## Central dashboard

`/dashboard` adds a date-filtered owner overview of OPD, Urgent Care, individual Lab visits/tests, live camp intake and leads. Department encounters remain separate; historical camp summaries and Lab aggregate source reports are not re-added as new individual records. Existing programme/finance sections remain available. Department accounts land on their assigned workspaces rather than the owner dashboard.

## Lead Management

`/leads` uses the existing `donor_leads` table. Administrators can add/edit leads, search and filter by stage or overdue follow-up, assign an administrator, record consent/source/campaign/notes, and review change history. It preserves original source identifiers and creation dates. Revoked consent/do-not-contact suppress follow-up scheduling. Converted progression requires a linked donor with a confirmed contribution; historical unsupported conversion labels are not counted as verified conversions. These controls do not send messages, activate ad integrations or create payments.

## Database and validation

Migration `202611240021` runs through the existing guarded module initializer. It adds department memberships, visits and operations audit (three RLS tables), plus lead tracking columns/indexes. It seeds no accounts, memberships, visits, donors, payments or leads. Automatic reception billing and organization-wide reset remain excluded. Actual shift hours, reference tariffs and schedule availability are not invented.

59 unit tests, lint and optimized production build passed. Disposable production SQL/API/browser checks verify scope isolation, viewer privacy, doctor/date validation, idempotent retries, optimistic corrections, cancellation/restoration, revocation, consent/assignment/conversion rules, filters, audit, central counts and five mobile screens. Existing Lab onboarding/approval/revocation browser tests also pass with the new schema. Tests reuse existing local Auth fixtures and synthetic disposable records; no live Auth account, business record or message was created.

Evidence: `DEPARTMENTS-LEADS-VALIDATION-2026-11-24.json`. Hosted publication evidence is recorded separately after verification. Real department grants, shift hours/rates, private historical imports, package drafts, external provider activation and real-user onboarding acceptance remain operational tasks.
