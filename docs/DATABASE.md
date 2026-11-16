# Shared database, schema and seed

Apply every file in `supabase/migrations/` in timestamp order. They contain the complete executable schema, grants, RLS, storage policies, constraints and triggers. Do not use `drizzle-kit push` or Prisma migrations alongside these files.

| Area | Tables / behavior |
|---|---|
| Identity | `profiles`, actor role helpers; six roles including camp manager and CSR partner; guarded role changes prevent removal of the final administrator |
| Programme | `camps`, six `historical_*` source/line tables; 6 completed historical camps and 12 future capacity slots, proposed dates/budgets distinct from confirmed dates |
| EMR | `camp_patients`, `patient_eligibility`, `camp_consultations`, `camp_consultation_diagnoses`, `centre_referrals`; server UID and derived 0–14 / 15–59 / 60+ age band, independent gender, vitals and pregnancy fields |
| Pharmacy | `medicine_catalog`, `camp_pharmacy_inventory`, `camp_pharmacy_dispensations`, `inventory_adjustments`; serialized dispensing, no overselling, approval-based corrections |
| Staffing | `camp_staff_roster`; duties × agreed per-duty rate, attendance and evidence required for paid honoraria |
| Finance | `camp_financial_ledgers`; integer paisa, Zakat restrictions, immutable originals and unique reversing entries |
| Growth / WASH | `capital_projects`, `project_milestones`, `wash_projects`, `wash_readings`, `community_activities`; measured yield and distinct proposed/confirmed project funding |
| CSR | `csr_partners`, `csr_memberships`, `csr_commitments`, `institutional_documents`; consent, explicit membership, evidence review and expiry |
| Giving / CRM | `donors`, `donations`, `sponsorships`, `donor_leads`, `bank_routes`, `fundraising_campaigns`, `peer_benchmarks`; idempotent requests, consent, source attribution, treasury-verified bank publishing |
| Delivery / audit | `webhook_events`, `integration_outbox`, `published_reports`, `donation_certificates`, `audit_log`, `public_request_limits`; event hashes, delivery states and consent checks |

The SQL includes the precise field definitions; `db/schema.ts` maps the main operational tables for Drizzle. Currency amounts in `*_paisa` or `amount_minor_units` are integers. Do not combine foreign currencies into PKR totals without a recorded exchange-rate policy. Partial Stripe refunds reduce net PKR capital receipts while preserving the gross contribution.

## Permissions

| Role | Intended access |
|---|---|
| Administrator | Governance, treasury, financial posting, approvals, roles, clinical and programme management |
| Camp manager | Programme, intake, eligibility, clinical follow-up, staffing, growth, WASH and CSR; no financial confirmation, private receipt upload or direct stock edits |
| Doctor | Intake, vitals, consultation diagnoses and referrals; no treasury writes |
| Pharmacist | Medicine catalogue, stock batches, patient-linked dispensing, correction requests; no direct dispensed-stock edits |
| Donor | Own contribution/sponsorship history and verified acknowledgements; approved public institutional material |
| CSR partner | Explicitly assigned organization/commitments; no patient or donor register |

## Seeding and source limits

`npm run db:seed` loads `.env.local` explicitly. It refuses a non-loopback target unless `KAWT_ALLOW_REMOTE_SEED=approved-development-target` is deliberately supplied after target approval. Do not set that flag during local work. Existing rows are preserved.

The baseline is 2,912 attendees, PKR 2,416,571 expenditure, PKR 1,863,111 Zakat and PKR 553,460 General. These are historical source summaries, not newly reconciled bank transactions. `data/historical-camps.json` remains the supplied structured dataset. `data/source-report.html` preserves the actual full report, including rows/narrative not identical to that dataset. The independent review found 427 matching structured comparisons and 27 text differences; visible exports omit some structured line items. FMC-02 has an eligibility count ambiguity (72 narrative versus 73 dataset); printed FMC-01/02 unit costs and computed values differ. Do not silently rewrite them.

The receipt-vs-ledger rounding differences, including FMC-06's PKR 0.83, remain source evidence. New operations post exact paisa with receipt/invoice references and explicit journal corrections rather than overwriting the confirmed amount. A historical aggregate is never accepted as patient-level eligibility evidence.

Offline drafts use a fresh request UUID, encrypted IndexedDB and an in-memory key. Synchronization verifies the original authenticated account, retains failed drafts and removes only a record acknowledged with a server UID. Clearing browser storage or losing the offline passphrase makes unsynchronized drafts unrecoverable; no server recovery is implied.

Large workspace registers use authenticated server search/pagination beyond the initial 1,000 rows. Selecting a patient loads their full authorized consultation/referral/eligibility history independently of the initial table snapshot. Insights and clinical charts aggregate their full authorized cohorts.
