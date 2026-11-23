# KAWT — Pending features aur next-session plan

Checkpoint: 23 November 2026. Live portal user ne khol kar confirm kiya. Yeh current backlog hai; purane review documents ke completed/pending jumlay historical hain.

Main dashboard: https://kawt-eco-managment-preview.netlify.app/dashboard

## Ab mukammal aur live

- Verified owner/admin login; main dashboard, Medical Centre aur Lab aik hi hosted app mein.
- 11 OPD aur 4 Urgent Care doctor source entries, timings, reference fees aur editable/audited details.
- Private Lab patient/test entry: 85 source catalogue options/categories, quantity, referral aur welfare/panel category.
- Automatic Pakistan date/time; configured shift/rate valid-from dates; saved snapshots aur correction history.
- Assigned Lab operator, aggregate-only viewer aur partner-lab separation; retries se duplicate visits nahin bante.
- Patient visits aur test quantities alag totals; MOU/Urgent/External groups dobara add nahin hote.
- Saved-entry date/period reports, source-report comparisons, real Excel/CSV aur print/PDF exports.
- 50 unit tests, production build aur isolated browser/SQL/API checks pass; hosted schema/RLS aur private routes verify huay.

## Pehle technical kaam

- P1 — Staff onboarding: signup/access-request list, admin notification, approve/reject, department assignment aur access revocation ka saada interface. Filhal verified email ko admin manually Lab access deta hai; signup apne aap admin ya Lab access nahin deta.
- P1 — Asal Lab configuration: teen shifts ke approved start times, reference test rates aur unki valid-from date darj karna. Unknown hours/rates invent nahin karne; tab tak manual shift aur khaali price supported hain.
- P1 — Historical source import: private July 2026 aggregate ko review/import karna. Monthly sample se fictional daily dates ya individual patient records nahin banane.
- P1 — Aath discount packages: tayyar source drafts ko import/review karna; editable components aur approved reference prices/dates set karna. Yeh abhi live import nahin huay.
- P1 — Source originals: imported PDF/Excel/image ko private archive aur saved report reference ke saath permanently link karna; existing Lab extraction/review ko naye legacy formats tak barhana.
- P1 — Operational continuity: backup/export, restore drill, source traceability aur maintenance/runbook ko verify karna, khaas taur par future reset/new-data workflow se pehle.

## Medical Centre ke baqi workflows

- P1 — OPD ka alag patient/service register: doctor selection, date/time, actual schedule, visits, reference charges, paid/free/subsidized/panel counts aur reports. Reception billing yahan dobara nahin banana.
- P1 — 24/7 Urgent Care ka alag limited staff portal: actual services, encounters, shifts/handover aur welfare/referral reporting. User ke mutabiq admission nahin hota; inpatient workflow assume nahin karna.
- P2 — Urgent Care consumables: actual used items, quantities, stock movements aur source-backed costs. Yeh tafseeli hissa user ne baad ke liye rakha.
- P2 — Doctor availability: draft/source approval, clear updated images aur dated duty/rotation rules. Alternate-night anchor aur ambiguous day/time mapping khud se nahin banani.
- P2 — Diagnostic services: X-ray, ECG aur ultrasound ke operational records/reporting ko unke actual service formats aur roles se map karna; test catalogue ko clinical-result authorization ka badal nahin samajhna.
- P2 — Separate pharmacy store: existing camp stock/dispensing ko independent store workflow, batch/expiry, supplier aur reconciliation se jorna.
- P2 — Ambulance aur home-care equipment: vehicle/trip/duty records; oxygen cylinders, wheelchairs, nebulizers waghera ki eligibility, issue/return aur maintenance. Approved criteria source se lena.

## Finance aur organization-wide reporting

- P1/P2 — Existing separate financial-analysis app ka URL/repo review karke pehle link dena; data sync ya shared login us ke baad. Nayi app se usay replace nahin karna.
- P2 — Purane software ki daily/monthly reports ka approved PDF/Excel import: OPD, Lab, Urgent Care, panels aur departments ka alag mapping.
- P2 — Doctor salary/commission, actual collections, panel support, consumables aur other costs ki source-backed analysis. Reference fee ko received cash ya final surplus nahin kehna; purane amounts dobara price nahin karne.
- P2 — MOU/partner register, actual agreements, rates, effective periods aur settlements. Filhal Lab form MOU referral naam/count record karta hai, full contract/settlement workflow nahin.
- P2 — Organization profile/history aur current/completed/planned projects ka shared register; Medical Centre, welfare camps, WASH/water aur capital phases alag dimensions rahen.
- P2 — Organization-wide dashboard aur branded original-style report templates; department overlaps aur fund categories reconcile karke combined reporting.

## Advanced features aur integrations

- P2 — Lead se verified donation tak complete donor conversion/attribution aur campaign reporting; existing donor/payment code ki live acceptance alag verify karni hai.
- P2 — Meta/TikTok leads aur ad-spend automatic imports; separate social-account organic/paid analytics, dated sources aur deduplication.
- P2 — Growth planning, awareness-day/content calendar aur actual market evidence par suggestions. Existing rules/period comparisons ko trained AI nahin kehna.
- P2 — Existing Stripe/PayPal aur WhatsApp Business code ka selected accounts/providers ke saath activation, template/delivery/transaction verification; local PKR merchant adapters aur reconciliation.
- P2/P3 — Validated weather/flood/hazard feeds aur approved facility assessments; source/data quality ke baghair generated certainty nahin dikhani.
- P2/P3 — Current camp offline PWA se department workflows tak extension, agar zaroorat ho. Naya Lab portal abhi online hai; private patient data ko aam page cache mein nahin rakhna.
- P2/P3 — Public website integration sirf approved services/projects/content ke liye; website redesign aur back-office operational work alag workstreams rahen.
- Tajweez, scope confirm karna hai — Volunteers/HR, grants/restricted funding, procurement/assets aur confidential complaints/case-management ki existing modules par extensions. Inhein completed ya fully approved operational modules na dikhaya jaye.

## Technicalities ke baad product/interface

- P2 — Admin logo upload/preview/change option; main product/Trust branding aur Medical Centre/Diagnostic branding ko sahi jagah use karna; headers aur exports mein consistent display.
- P2 — Interface simplify karna: role ke mutabiq kam controls, quick entry, clear tabs, kam Notes/configuration noise, mobile-friendly tables aur obvious report actions.
- P3, baad mein — Overall data reset aur naya dataset setup: pehle backup/export, scope/count preview aur controlled restore/new import. Owner accounts, permissions aur configuration ka behavior pehle define karna. Is session mein koi reset nahin hua.

## Agli session ka starting order

- 1. Staff onboarding/access requests aur actual shifts/rates.
- 2. July source aur package drafts ka private import.
- 3. OPD aur Urgent Care ke separate operational registers.
- 4. Financial app/source reports aur consolidated reporting.
- 5. Advanced integrations, phir logo/interface; overall reset sab se baad.

## Source aur continuity references

- START-HERE.md mein repo, environment, live URLs, verified checkpoint aur resume instructions hain.
- Current evidence: LAB-PATIENT-NAVIGATION-LIVE-2026-11-23.json aur LAB-PATIENT-ENTRY-VALIDATION-2026-11-23.json.
- Earlier scope: PROFILE-ARCHITECTURE-GAP-REVIEW.md, NONPROFIT-ECOSYSTEM-REVIEW.md aur DEPARTMENT-FINANCE-AND-PANEL-REQUIREMENTS.md. Un ke purane implementation-status claims ko current deployment par apply na karein.
- Source roster/profile claims, actual recorded data aur future phases alag rahen. Monthly food programme ka current status confirm huay baghair active service assume nahin karna.
- Private owner email, passwords, API keys aur source documents is public backlog ka hissa nahin. Personal Gmail/WhatsApp wali side conversation is project backlog mein shamil nahin.
