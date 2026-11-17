# Architecture and delivery review

The three newly attached technical blueprints are byte-identical (SHA-256 98ba6db75bbe76b146847165e090d9e647fcf098dc38d70b712d3e5e0f00354b). They also match the previously available architecture copy. All originals will be retained in the delivery manifest; duplicate uploads do not represent separate feature implementations.

The separate Growth & Camp Operations document is a 2,048-line React UI prototype with hard-coded source camps and no fetch/client API calls. It supplies design and historical/planning references. Its UI scaffolding is not proof of backend integrations.

| Area | Implemented capability | Remaining boundary |
|---|---|---|
| Public source preview | Explicit /preview; source totals and six historical plus six source-planned camps; no submissions or generated camp slots | Read-only inspection, not an operational service |
| Staff operations | Supabase identity/roles, shared workspace, intake, consultations/referrals, pharmacy, finance, staff, WASH/CSR, donors and reports | Live deployment, real staff authorization and target database readiness require verification |
| Architecture stack | Next.js 16, Supabase/PostgreSQL/Auth/Storage, Drizzle/SQL and parameterized pg | The supplied blueprint specifies Prisma; this is a documented implementation difference, not an instruction to run Prisma against the SQL schema |
| Offline PWA | Custom service worker and account-bound encrypted intake queue | The blueprint names next-pwa; no next-pwa package is installed. HTTPS and production offline validation are required |
| Source reports | Original source HTML preserved; authenticated source report and generated operational summaries | Exact new-camp original-layout generation remains incomplete |
| Payments/communications | Stripe/PayPal handlers and a consent-checked integration outbox | Real provider configuration/verification and local PKR merchant adapters remain separate; no live messages/payments were executed |
| Growth/analytics | Rules-based insights, manual campaign attribution and evidence-backed project workflows | TikTok/ad-spend synchronization, full server-side funnel, validated AI and live hazard/HeRAMS integration remain incomplete |

Historical data: 2,912 attendees; PKR 2,416,571 total; PKR 1,863,111 Zakat; PKR 553,460 general. These are aggregate source summaries, not 2,912 fabricated identifiable patients. The source audit retains thirteen historical quality warnings. Unassigned programme capacity and product roadmap bullets do not create database records.

Public preview access does not expose private staff records. The default URL opens the source preview; /dashboard retains role-protected operations, and explicitly reports missing backend configuration instead of silently substituting a demo.

The uncommitted CodeM CLI install in the older local checkout is preserved separately. It is not an application feature or a deployment dependency, and is not included in this implementation's runtime dependency list.
