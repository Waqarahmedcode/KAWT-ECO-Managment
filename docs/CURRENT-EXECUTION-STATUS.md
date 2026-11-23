> Latest update, 23 November 2026: private patient-wise Lab entry is deployed and verified, alongside the imported 11 OPD / 4 Urgent Care doctor schedule. See [patient-entry release](LAB-PATIENT-ENTRY-2026-11-23.md) and [live verification](LAB-PATIENT-ENTRY-LIVE-2026-11-23.json). Actual shift hours/rates must be configured with their valid-from date; no billing or live test patients were created.

> **23 November 2026: lab/Medical Centre update live hai.** [Verified deployment, URLs aur owner setup](LIVE-DEPLOYMENT-2026-11-23.md). Neeche purane checkpoint ki dates/status historical hain.

# KAWT current execution — 20 November 2026

Current checkout: `kawt-preview-implementation`, local development branch `codex/kawt-previews`. November 17 ka hosted baseline pehle se Netlify/Supabase par hai. November 20 ke lab reporting aur Medical Centre changes abhi local reviewed working tree mein hain; naya push/deploy claim nahin kiya gaya.

[Latest implementation, verification, limits aur exact deployment steps](LAB-IMPLEMENTATION-2026-11-20.md).

Is update mein private Lab entry/login, revisions/audit, lab-scoped permissions, table-based reports, month/year/day/custom selection, native PDF/Excel import, reviewed local image OCR, real Excel/print exports, OPD/Urgent doctor groups aur dated package rates banay gaye. Local Auth/SQL/browser checks aur optimized build pass hue. Owner ke private source reports/screenshots public repository mein nahin hain.

Existing hosted baseline: https://kawt-eco-managment-preview.netlify.app/preview — yeh nayi lab screens ka live deployment nahin. Staff login: https://kawt-eco-managment-preview.netlify.app/login.

Private development server cloud machine ke loopback port 3012 par test hua. `localhost` user ke apne computer par us cloud server ka address nahin; is session mein HTTP forwarding portal available nahin. Review ke liye actual screen captures, PDF, Excel aur credential-free source package diye ja sakte hain.

Overall product roadmap mukammal nahin. Finance app linkage/input, real staff activation aur external provider credentials walay modules ko confirmed implementation se alag rakha gaya hai. Koi live payment, message ya naya production account create nahin hua.
