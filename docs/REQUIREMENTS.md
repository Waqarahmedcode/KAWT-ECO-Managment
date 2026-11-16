# Requirement-to-current-status comparison

Source locations below refer to the uploaded `Pasted text.txt`, **PART 1** / **PART 3**, and `kawt_system_architecture_database_schema_seed_script_api_webhooks.md`. The source prompt was located and read in full; it is not missing. Later instructions authorize implementation and defer only dependent live configuration.

| Prompt location / requirement | Current result | Remaining boundary |
|---|---|---|
| Module 1.1 — 18-camp tracker/KPIs | 6 historical + 12 planning slots; editable future sites; source-preserving totals, funding/reach charts and unit-cost benchmark | Unassigned slots have no invented sites/dates; unknown historical units remain unknown |
| Module 1.2 — segregated ledgers | DB eligibility/category constraints, paisa, reversal audit, real private upload/download | Official treasury/Shariah review and bank evidence remain human responsibilities |
| Module 1.3 — independent age/gender, UID/vitals | Working online and encrypted offline intake with real local sync and retry deduplication | Age wording “Under 12/14” resolved to 0–14; no old missing genders invented |
| Module 1.4 — clinical and referral gateway | Patient-linked diagnoses and prevalence chart, protected QR slip, follow-up statuses | QR opens the authorized record; scanning does not silently mark a clinical visit completed |
| Module 1.5 — stock reconciliation | Opening + purchased − dispensed − wastage = closing, unit/batch records and approval-controlled changes | Existing medicine purchase proxies do not become past dispensed records |
| Module 1.6 — assessment/roster | Flood/heat/access/need checklist, approval, named staff, duties × agreed rate, paid evidence rules | Live weather/flood feed and a standardized HeRAMS scoring instrument remain unspecified/unimplemented |
| Module 1.7 — A4 report | Authenticated original single/all-camp source layout and current operational report; browser print/save PDF | Operational report is a draft until review; exact automatic original-layout generation for newly recorded detailed camps needs further work |
| Module 2.1 — four capital phases | Shared project/milestone CRUD and donation-linked confirmed net PKR receipts | Approved budgets/procurement and actual operational capacity need organizational data |
| Module 2.2 — WASH/climate | Three project placeholders, real readings/yield, seasonal/community activity evidence | No invented historical water readings or real-time hazard feed |
| Module 2.3 — CSR/ESG/certificates | Four pillars, SDGs, partner commitments, scoped corporate membership and document review | Contribution tax certificate generation/PDF is evidence-gated; real current documents and an authorized signatory remain pending. Separate ESG certification is not asserted. |
| Module 3.1/3.2 — markets/peers | Seasonal/geographic campaign planning, spend attribution, sourced peer metric matrix | No invented live peer/diaspora data or automatic ad-spend import |
| Module 3.3 — AI insights | Cohort-based stock estimate, consented retention review and interest-based CSR matching | Trained/validated regional disease, churn and high-net-worth models are not implemented; available methods are labelled rules |
| Module 4.1 — donor calculator/tiers/routing | Nisab/lunar-year calculator, scope/budget planner, sponsorship intents, equipment dedication, treasury-verified routing | Uploaded bank category conflicts need treasury verification before publication |
| Module 4.2 — Meta/TikTok | Signed Meta lead ingestion + secure lookup worker; campaign/CRM records | TikTok and automatic ad-spend adapters remain unfinished, beyond absent credentials |
| Module 4.2 — WhatsApp | Consent-checked receipt/welcome/retention/report queue and explicit worker with delivery tracking | Receipt/impact PDF template support and monthly queue preparation are implemented; live credentials, approved templates, schedule and institutional verification remain pending |
| Module 4.2 — payment gateways | Stripe/PayPal checkout and verified handlers; real local transaction contracts | Live accounts/configuration deferred; PKR merchant adapters require contracts and implementation |
| Module 4.2 — GA4/GTM | Opt-in public-only event hooks | Live tag/container configuration, external verification and full server-side funnel remain pending |
| Deliverables 1/2 — architecture/schema/seed | Architecture + ordered complete SQL/RLS + source-preserving seed + Drizzle mapping | Master allows either ORM; Prisma example was not applied as a second schema authority |
| Deliverables 3/4/5 — UI/APIs/guide | Functional integrated UI, local API workflows, provider scaffolds and phased CLI guide | Production release, credentials and acceptance checks remain separate |

## Ambiguities and evidence conflicts

The master is broad enough to define the four product areas. It does not specify all production workflows, a tax certificate/signatory format, validated AI training data, campaign retention policy, the WHO assessment instrument, local merchant contracts, or exact ad-account mappings. Those are incomplete or ambiguous requirements. Features explicitly identified as unfinished above are specified-but-unimplemented features, not merely missing credentials. Live provider checks are a third category, pending runtime configuration.

Reference budgets differ: PKR 105k/250 attendees, 158k/300 and actual six-camp expenditure are not interchangeable. The UI labels proposals versus source actuals. Source bank categories and accreditation identifiers differ between documents, so accounts/certificates are not automatically marked verified. The uploaded architecture's claimed “complete Prisma schema” omits several models, and its six aggregate camp seed is not a patient/line-item seed. The existing supplied SQL/Drizzle source plus ordered migrations and original full HTML are the implementation authority here.

## Validation record

The current environment has passed TypeScript, ESLint without errors/warnings, a production build, eleven pure contract tests, one rollback-only local payment transaction contract, and eighteen real local browser/API/database/storage workflow checks. Final check details are recorded in `VALIDATION.md`; do not infer that remote services or public deployment were tested. Historical data audit retains thirteen documented source-quality warnings rather than suppressing them.
