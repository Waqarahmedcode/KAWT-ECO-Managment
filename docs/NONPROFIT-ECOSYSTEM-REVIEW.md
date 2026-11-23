> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Mukammal NGO Ecosystem ka Scope aur Feature Review

## Is jaizay ki bunyaad

Yeh jaiza workspace mein mojood architecture, requirements, implementation status, integration guide, attached KAWT technical blueprint aur 20 November 2026 ko parhi gayi official website ke public safhon par mabni hai. Website ko aap ne purana/under-review hawala bataya hai; us ka content independently verified current service status nahin hai.

Aap ka diya hua [official website](https://www.khidmat-e-alam.org/) link khul gaya hai. Projects, services, doctors aur public social links ka source review [Website services aur doctors](WEBSITE-SERVICES-AND-DOCTORS.md) mein hai. Aap ki KAWT Professional Profile file mil gayi aur review ho gayi hai; us ka milan [profile aur architecture gap review](PROFILE-ARCHITECTURE-GAP-REVIEW.md) mein hai. Current doctor roster aur approved policies ki tasdeeq baqi hai. Neeche izafi modules ki tajaveez ko implemented features na samjha jaye.

Sirf review documents tayyar kiye gaye hain. Application, database, permissions, records aur live integrations mein is review se koi tabdeeli nahin hoti.

## Kaam ke do alag hisse

Aap ne wazeh kiya hai ke purani website mojood hai aur nayi website par alag review/tabdeeliyan ho rahi hain. Is liye:

1. Operational ecosystem: services, doctors, beneficiaries, staff, donors, grants, procurement aur complaints ka shared back-office.
2. Website ka kaam: purani website ko historical reference rakhna; nayi website ke design/content ko us ke apne workstream mein rakhna. Sirf manzoor-shuda public maloomat ka rabt/API tay karna.

Is review se website ka redesign, replacement ya koi live synchronization shuru nahin hota.

## 1. Mojooda documents mein kya shamil hai

| Hissa | Dastiyab saboot ke mutabiq scope | Kis baat ko alag rakhna hai |
|---|---|---|
| Medical camps | Camp planning, patient intake, consultations, pharmacy, staff roster, kharch aur reports | Historical aggregate attendees ko asli patient records nahin banana |
| Medical-centre referrals | Referral slips aur follow-up ki bunyad | Mukammal centre appointments, lab aur service workflows ki profile se tasdeeq chahiye |
| WASH aur community activities | Projects, readings, activity evidence aur seasonal planning | Asal sites, readings aur services ka saboot darkar hai |
| CSR aur donors | Partner commitments, donor records, pledges, receipts aur evidence-based documents | Live providers, recurring giving aur mukammal grant lifecycle alag scope hain |
| Capital expansion | Phase aur milestone management ki bunyad | Maternity/dental, eye/physiotherapy aur dusre roadmap proposals ko current operational services na dikhaya jaye |
| Governance aur access | Roles, row-level permissions, audit aur institutional documents ki bunyad | Mukammal board, policy, expiry, approval aur operational recovery workflow mazeed wazeh karna hai |
| Offline PWA | Custom service worker aur encrypted intake ki implementation | next-pwa package ka naam aur offline feature ki salahiyat do alag cheezen hain |

Architecture ya library ka naam apne aap mein NGO ki service nahin hota. Asal ecosystem mein har service ka zimmedar, form, approval, fund, record, follow-up aur report aapas mein jura hona chahiye.

## 2. Pehle se baqi development

| Kaam | Abhi kya baqi hai |
|---|---|
| Naye camp reports | Naye operational data ke liye asal report jaisa mukammal automatic layout |
| Donor conversion | Lead se verified contribution tak mukammal attribution aur conversion reporting |
| Advertising imports | Automatic Meta/TikTok lead aur spending imports; duplicate aur consent handling |
| Local PKR payments | Chune huay merchant/provider ke mutabiq adapter, reconciliation aur verification |
| AI aur external data | Tasdeeq-shuda data, validation aur wazeh use cases; rules-based insights ko trained AI na kaha jaye |
| Weather/flood aur facility assessments | Asal feeds aur manzoor-shuda assessment instrument ke saath integration |
| Mojooda payment/WhatsApp code | Live configuration, provider approvals, approved templates aur delivery/transaction verification |

In mein kuch coding ke kaam hain aur kuch live activation ke. Sirf keys dalne se adhoori development mukammal nahin hoti.

## 3. Mukammal NGO ecosystem ke liye izafi modules

| Tarjeeh | Module | Kya hona chahiye | Mojooda bunyad se rabt |
|---|---|---|---|
| P1 | Organization profile aur tamam projects ka register | Mission, history, branches, completed/current/planned projects, ilaqa, budget, zimmedar aur tasdeeq-shuda evidence | Camp aur capital project records ko ek organization-wide nazariye se jorna |
| P1 | Doctors aur consultants ki directory | Tasdeeq-shuda doctor profiles, specialty, centre/camp linkage, consultation timings, availability aur appointment/referral follow-up | Mojooda doctor role, clinical records aur camp roster is ki bunyad hain; mukammal directory aur booking ko alag verify karna hai |
| P1 | Beneficiary aur family case management | Zaroorat ki darkhwast, consent, eligibility review, approval, di gayi madad aur follow-up | Patient UID se alag cross-program case record; zaroorat par manzoor-shuda linking |
| P1 | Procurement aur assets | Purchase request, quotations, approvals, purchase order, goods receipt, vendor invoice aur asset maintenance | Pharmacy stock aur financial ledger ko mukammal purchase workflow se jorna |
| P1 | Complaints aur safeguarding | Confidential complaint, zimmedar shakhs, escalation, waqt ki pabandi aur closure evidence | Mamooli requests aur nazuk complaints ke liye alag access aur zimmedari |
| P1 | Project aur donor reporting | Original-style reports, fund utilization, promised vs achieved results aur publication approval | Existing reports aur donor conversion ki baqi development ko mukammal karna |
| P1 | Operational readiness | Asli staff sign-in, backup/restore drill, monitoring, retention, access review aur runbooks | Existing Auth, permissions aur audit ko rozmarrah zimmedariyon se jorna |
| P2 | Volunteer aur HR workflow | Onboarding, skills, availability, training, shifts, attendance, leave aur approved payouts | Mojooda roster aur honoraria ko wasee karna; usay dobara alag system mein na banana |
| P2 | Grants aur restricted funding | Proposal, donor restrictions, budget allocation, milestones, expense evidence aur funder reports | CSR commitments, project milestones aur segregated ledgers ki extension |
| P2 | Donor self-service aur recurring giving | Apni history, receipts, communication preference, pledges aur renewals | Mojooda donor portal ki extension; automated recurring payments provider par munhasir |
| P2 | Centre appointments aur service requests | Booking, queue, referral-to-visit outcome, lab/service status aur follow-up | Sirf un clinical services ke liye jo organization profile se tasdeeq hon |
| P2 | Public website aur content workflow | Service pages, project history, approved impact, forms, publications aur Urdu/English access | Website aur operational app ke liye ek manzoor-shuda project/service record |
| P2 | Organization ke social accounts | Public handles, authorized account ownership, staff access, content calendar, approval aur campaign/service linkage | Mojooda Meta/WhatsApp scaffolding aur manual campaign records ki extension; automatic ad-spend import alag baqi kaam hai |
| P2 | Helpdesk aur operational notifications | Incoming queries, tickets, staff assignments, reminders aur consent-based updates | Mojooda outgoing messaging queue ke saath rabt; incoming helpdesk alag workflow hai |
| P3 | Advanced analytics | Programme results, retention, costs aur planning insights | Sahi data aur workflow ke baad validated models aur external feeds shamil karna |

Website par OPD, lab/diagnostics, pharmacy, ambulance, equipment, water/sanitation, rural camps aur education/skills ka zikr mila hai. Aap ne lab, pharmacy store, ambulance aur criteria ke saath home-care equipment ki wazahat bhi ki hai. In ka current operational status aur specific policies alag confirm hon gi. Monthly food programme website par listed hai, lekin aap ki tasheeh ki wajah se usay active current programme assume nahin kiya gaya. Scholarships aur orphan support ki services is review mein establish nahin huin.

## 4. Organization ki history aur projects ko kaise highlight karna hai

Har project/service ke liye yeh maloomat honi chahiye:

- Naam, programme category aur ilaqa/branch.
- Surat-e-haal: completed, current, planned ya paused.
- Shuruat aur ikhtitam ki tasdeeq-shuda tareekh.
- Programme owner, partner aur approved budget/fund.
- Source document ya official website ka hawala.
- Reported reach aur asal results ka wazeh farq.
- Public summary aur private beneficiary/patient records ki judai.
- Update aur publication ki manzoori.

Historical camp summary, future roadmap aur live operational record ko ek hi qisam ka data na banaya jaye. Unknown numbers, dates, identities aur project statuses ko invent na kiya jaye.

## 5. Amli tarteeb

1. Organization profile aur official website se mukammal service/project list ki tasdeeq.
2. Har item ko completed/current/planned aur implemented/partial/missing status dena.
3. Beneficiary cases, procurement, reporting aur zaroori operational controls ko pehli release mein rakhna.
4. Volunteers/HR, grants, website publishing aur centre workflows ko tasdeeq-shuda services ke mutabiq jorna.
5. Payment, messaging aur advertising integrations ko unke providers aur approvals ke saath mukammal karna.
6. Sahi operational data jama hone ke baad AI aur external-data features validate karna.
7. Har release ke baad updated source package, feature/status matrix, screenshots aur validation report dena.

## 6. Review ka natija

Mojooda bunyad sirf ek static dashboard nahin: documents mein clinical, pharmacy, finance, donors, projects aur shared access ka scope maujood hai. Lekin mukammal nonprofit ecosystem ke liye organization-wide service portfolio, beneficiary casework aur supporting operational workflows ko mazeed jorna hoga.

Official website ka link mil chuka hai aur public source review ho gaya hai. Organization profile mil chuki hai aur us ki current services/planned phases ka milan ho gaya hai. Approved service status, current doctor roster aur equipment eligibility policy ki tasdeeq baqi hai; website ki listing se har service ka aaj ka status final nahin hota.

## Hawalay

- [Maujooda implementation status](IMPLEMENTATION-STATUS.md)
- [Requirement comparison](REQUIREMENTS.md)
- [Architecture review](ARCHITECTURE-REVIEW.md)
- [Integration boundaries](INTEGRATIONS.md)
- [Official website se services, 15 doctors aur social/growth scope](WEBSITE-SERVICES-AND-DOCTORS.md)
- [Attach ki hui profile ka architecture se milan](PROFILE-ARCHITECTURE-GAP-REVIEW.md)
- [Daily lab performance, shifts aur period reporting](LAB-PERFORMANCE-REQUIREMENTS.md)

Yeh review tajaveez aur status ka document hai; izafi modules ki implementation ka saboot nahin.


## Doctors, social accounts aur website ke liye source checklist

| Source | Kya milna chahiye | Kis tarah istemal hoga |
|---|---|---|
| Organization profile — received aur reviewed | History, current services, reported KPIs aur 2026–2030 planned phases | Organization-wide service/project register; source claims aur independently verified records alag |
| Purani website | Purana content, project references, public contact aur social links | Historical reference; purani maloomat ko current kehne se pehle tasdeeq |
| Nayi website ka review | Approved public content, branding aur publication workflow | Alag website workstream; approved information ke liye app/API ka rabt |
| Doctors/consultants ki current list | Naam, specialty, professional details, timings aur centre/camp association | Directory, availability, consultations aur referral continuity |
| Official social links | Platform, verified public handle/page aur authorized account owner | Account register, content approvals aur baad ki integrations |

Historical camp staff names ko current doctor availability ya active consultant directory na samjha jaye. Isi tarah public social handle milne se platform API access ya live integration sabit nahin hoti. Private passwords aur tokens public source documents mein shamil nahin kiye jayen.

## Is update mein kya hua

- Official website se 15 doctors ki listings, specialties aur diye gaye timings darj huay; live availability aur professional registration independently verify nahin hui.
- Lab, pharmacy store, ambulance aur home-care equipment ko alag operational services ka scope mila.
- Social accounts, alag platform analytics, real-data growth strategy aur campaign calendar ko wazeh requirement mili.
- Website ke kaam aur operational ecosystem ko alag rakha gaya.
- Organization ki history/current/planned projects ko source evidence ke saath highlight karne ka tareeqa tay hua.
- Yeh tabdeeliyan review file mein hain; application, database aur live accounts mein koi tabdeeli nahin ki gayi.

## Social analytics aur growth planning ki wazeh requirement

Har official platform/account ke liye alag organic/paid analytics, dated sources, metric definitions, spend, leads aur verified donor attribution chahiye. No-data ko zero na dikhaya jaye. Growth advice asal campaign performance, service capacity, approved budget aur dated market evidence se nikle. Relevant awareness days aur seasonal campaigns ka owner, deadline aur approval calendar ho; koi automatic posting ya ad budget is review se authorize nahin hota. Tafseeli source mapping [website review](WEBSITE-SERVICES-AND-DOCTORS.md) mein hai.

## Lab ka performance tracker

Aap ne general lab listing ke ilawa daily test-wise/shift-wise performance aur monthly, half-yearly, annual growth reporting wazeh ki hai. Isay [dedicated lab performance requirement](LAB-PERFORMANCE-REQUIREMENTS.md) mein darj kiya gaya hai. Asal existing tracker milne par us ke columns, formulas aur test/shift definitions se mapping hogi; na-data ko zero ya completed tests ko unique patients nahin banaya jayega.

## Organization-wide reporting aur department tabs

Aap ki wazahat ke mutabiq Medical Centre KAWT Welfare Trust ka core project hai. Har department ki separate reporting/tab aur Overall Dashboard par combined view hoga; Lab Performance ka apna dedicated tab hai. Purane software mein API na ho to source reports ke upload, extraction, reconciliation aur approved import ka rasta [legacy report aur organization analytics review](LEGACY-REPORT-IMPORT-AND-ORG-ANALYTICS.md) mein hai. Yeh requirement/documentation hai; nayi UI ya import code is update mein implement nahin hua.

## Latest user-provided doctor schedule aur organization structure

Aap ne doctors ka poster diya: 11 OPD aur 4 Urgent Care schedule entries, timings aur charges ke saath. Website se differences [poster comparison](DOCTOR-POSTER-COMPARISON.md) mein mehfooz hain. Aap ki latest wazahat ke mutabiq Laboratory (3 shifts), OPD aur 24/7 Urgent/Emergency Care Medical Centre ke andar hain; Khidmat-e-Alam Pharmacy alag store/unit hai. Is latest mapping ko pehle ke generic department assumptions par tarjeeh hai. Editable doctor groups, schedules aur charges requirement hain; UI/code abhi implement nahin hua.
