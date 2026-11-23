# KAWT lab aur Medical Centre — 20 November 2026

Yeh implementation is checkout mein tayyar aur local isolated database par verify hui hai. Nayi functionality abhi Netlify/GitHub par publish nahin hui. Pehle se hosted November 17 release aur yeh development checkpoint alag versions hain.

## Ab code mein kya hai

| Hissa | Amal mein mojood functionality |
|---|---|
| Medical Centre | OPD aur Urgent/24-7 Emergency doctors ke alag groups; editable names, specialties, qualifications, timings, source, photo reference aur draft/active/inactive status |
| Lab entry | Dedicated sign-in aur private entry page; teen shifts, tests, reported patients aur alag Outsource/Emergency referral fields; direct Save/Edit |
| Permissions | Admin aur lab operator/viewer alag; partner lab ka account apne assigned lab tak; server aur SQL RLS dono par checks; self-grant aur unrelated clinical access mana |
| Corrections | Har save ka revision, original/current audit; stale revision overwrite reject; invalid dates/counts aur bilkul khaali reports reject |
| Report book | Latest saved period, year/month dropdowns, actual daily records, week, half-year, annual aur manual From/To |
| Tables | Main metrics, Morning/Evening/Night performance, test ranking/search/sort aur source coverage |
| Source import | Native-text PDF, .xlsx, CSV aur structured JSON se editable drafts; PNG/JPEG aur scanned PDF ke liye local OCR; multiple valid periods ka atomic admin batch save |
| Exports | Print / browser Save as PDF, actual .xlsx workbook, CSV; entry draft JSON; user-initiated WhatsApp sharing |
| Packages/rates | Editable components/status; PKR paisa integer amounts; append-only effective-date rates aur as-of selection; purani source amounts dobara price nahin hotin |
| Navigation | Main workspace se Medical Centre, admin Lab entry aur Lab reports; limited lab account ko poora workspace nahin milta |

Pharmacy ek alag store/unit hai. Camps aur WASH/water Welfare Trust ke alag projects hain. Lab/Emergency referral counts ko tamam emergency encounters nahin kaha gaya.

## Dates aur calculation

- Operational dates date-only ISO values hain; display/report context Asia/Karachi hai. Filename se service date nahin nikali jati.
- Monthly source ko daily numbers mein divide nahin kiya jata. Asal daily file/entry na ho to **Is tareekh ya period ka data available nahin** dikhta hai; available monthly source ka link bhi milta hai.
- Monthly aur us ke andar saved daily detail ko dobara jor kar total nahin barhaya jata. Non-overlapping sources se aggregate banta hai; incomplete annual coverage ko partial label milta hai.
- Blank/null count aur explicit zero alag hain. Catalogue mein naam hona performance report mein zero hone ka saboot nahin.
- Outsource aur Urgent/Emergency blocks main total mein dobara add nahin hote. Un ki inclusion/referral direction ka andaza nahin lagaya gaya.
- Reported patient counts ko independently verified unique individuals nahin kaha jata. Comparable purana data na ho to growth percentage ya prediction nahin banayi jati.

## Source review aur limits

Blank lab form se test catalogue aur package drafts nikle. Doctor poster aur website ke conflicting names/timings ko aliases samajh kar merge nahin kiya gaya. Poster ki effective date aur alternate-night rotation anchor maloom nahin; unhein invent nahin kiya. Source amounts notes mein hain; approved date ke baghair live tariff create nahin hua.

Native supplied PDF aur Excel ke tamam extracted counts/private reporting period source se match hue. Approved-template image OCR ke computed totals bhi source se match hue; kuch low-confidence/blank cells **null** rahin. OCR abhi manual review/correction maangta hai, aur import kabhi khud database mein save nahin hota.

Import size 8 MB tak; native PDF 24 pages tak; .xlsx expansion bounded hai. Legacy .xls ko .xlsx ya PDF mein export karna hoga. Rotated, unclear ya mukhtalif scanned templates ki exact extraction ki guarantee nahin. Originals workspace/owner bundle mein hain; runtime uploader abhi file bytes ka permanent document archive nahin banata.

## Verify kiye gaye checks

- TypeScript, ESLint aur unit suites pass.
- Optimized Next.js production build pass, including corrected production OCR worker resolution.
- Fresh disposable PostgreSQL mein baseline aur six module migrations, repeat initialization, role checks, revisions, audit aur partner-lab isolation pass.
- Actual local Auth ke saath entry/correction/login redirects aur denied clinical/self-grant access pass.
- Native PDF/Excel import, daily/no-data/month/annual/manual selectors, atomic duplicate rollback, rate history, desktop/mobile aur exports browser/API checks pass.
- Exported workbook ko independent Python/openpyxl se dobara khol kar source totals aur dates verify ki gayin.
- Runtime npm audit: zero reported vulnerabilities. Production import trace mein PDF worker, OCR worker, English model aur WASM files present.
- Local setup ke staged workdir mein tamam eighteen core/module migrations hain; Supabase CLI ne disposable database par repeated push ko up-to-date verify kiya.

Private source reports, screenshots aur test account bindings `.local` mein hain; public source archive/Git mein nahin. Synthetic tests disposable local DB tak mehdood hain; naya live staff account, payment ya WhatsApp message create/send nahin hua.

## Deployment ke liye tayyar, abhi apply nahin hua

1. Is reviewed checkout ke source ko intended Git branch mein transfer/push karein. `package.json`, `netlify.toml`, public OCR model/license aur dono migration directories shamil hon; `.env`, `.local`, dependencies aur build output shamil na hon.
2. Netlify ka existing Next.js project/repository/branch verify karein. Build command **npm run build:netlify**, publish **.next**, Node **24**.
3. Private runtime bindings: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, browser-safe publishable/anon key, canonical NEXT_PUBLIC_SITE_URL aur APP_RATE_LIMIT_SALT. Build checks ke liye KAWT_READINESS_DATABASE_URL aur KAWT_READINESS_STRICT=1. Approved selected target ka KAWT_INITIALIZE_PROJECT_REF initializer ko enable karta hai.
4. Baseline initializer purane records preserve karta hai. Naya `backend:lab-initialize` sirf pending six additive module migrations apply karta hai; us se eight protected tables banti hain. Nayi module migrations abhi sirf disposable test DB mein applied hain. `backend:check` dono directories ki migration history, required tables/RLS aur private receipt bucket verify karta hai.
5. Hosted build ke baad actual owner account se sign-in, `/lab`, `/lab/reports` aur `/medical-centre` check karein. Source drafts/imports private admin flow se save hon; verified dedicated lab accounts ko scoped entry access assign ho.

## Baqi ecosystem scope

Existing separate finance-analysis app ka URL/source abhi nahin mila, is liye us ka link/data sync nahin banaya gaya. Centre-wide OPD/urgent financial imports, doctor salary/commission settlement, panel/welfare cost analysis aur partner-lab MOU settlements abhi pending hain. Doctors directory completed appointment/clinical service system nahin hai.

Automatic Meta/TikTok spend imports, complete donor conversion tracking, local PKR merchant activation, WhatsApp Business live configuration, validated AI/hazard feeds aur extended volunteer/procurement/complaint workflows mukammal nahin. Existing offline PWA camp intake ke liye hai; private lab records ko offline browser cache mein add nahin kiya gaya.
