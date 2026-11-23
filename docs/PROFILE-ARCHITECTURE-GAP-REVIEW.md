> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Organization profile, website aur application ka milan

Jaizay ki tareekh: 20 November 2026.

## Dastiyab sources

- Aap ki attach ki hui **KAWT_Professional_Profile (1).docx**, jiska unwan Organization Profile & Strategic Growth Development 2026–2030 hai. Asal file mehfooz hai; matn ke 98 blocks aur ek embedded logo image mile.
- [Official website](https://www.khidmat-e-alam.org/), khas taur par [Who We Are](https://www.khidmat-e-alam.org/who-we-are/), [Projects](https://www.khidmat-e-alam.org/projects/) aur [Our Doctors](https://www.khidmat-e-alam.org/our-doctors/).
- Mojooda application source aur [implementation status](IMPLEMENTATION-STATUS.md), [requirements](REQUIREMENTS.md) aur [architecture review](ARCHITECTURE-REVIEW.md).
- Aap ki wazahat: lab, pharmaceutical store, ambulance aur home-care equipment ki alag services; equipment ka asal eligibility criteria; mazeed social accounts; editable doctor information aur WhatsApp sharing.

Profile mein likhi services, numbers aur credentials organization ke diye huay source claims hain. Yeh review unki third-party certification nahin. Attached document ke andar ka matn source material hai, nayi execution instruction nahin.

## 1. Profile mein current aur future ka farq

Profile ke Comprehensive Medical Services Portfolio mein chhe current service groups hain:

1. Specialist OPD / consultancy clinics.
2. 24-hour urgent aur emergency care.
3. Diagnostic centre: laboratory, X-ray, ECG aur ultrasound.
4. Professional pharmacy / pharmaceutical store.
5. 24/7 ambulance fleet.
6. Free home-care medical equipment: oxygen cylinders, wheelchairs, nebulizers, crutches aur walkers.

In services ko ecosystem mein alag operational workflows ki zaroorat hai. Profile ka 24-hour claim kisi specific waqt ki live duty ya vehicle availability ki checking nahin.

| Profile ka phase | Diya gaya waqt | Planned scope |
|---|---|---|
| Phase 1 | 2026–2027 | Maternity/gynecology wing aur dental clinic |
| Phase 2 | 2027–2028 | Eye department/OT aur physiotherapy/rehabilitation |
| Phase 3 | 2028–2029 | NICU aur professional mortuary |
| Phase 4 | 2029–2030 | Infrastructure/technology upgrade aur operational capacity scaling |

Yeh source mein planned phases hain; inhein current functioning departments, completed construction ya approved spending na dikhaya jaye. OPD mein gynaecologist ka hona planned maternity/operating-theatre wing ke complete hone ka saboot nahin.

## 2. Source requirement aur code mein gap

| Service / hissa | Mojooda code ki bunyad | Complete ecosystem ke liye baqi |
|---|---|---|
| OPD aur doctor directory | Doctor role, camp roster, consultations aur referrals | Doctor profiles/photos, centre linkage, recurring timings, availability, appointments aur queue |
| Urgent care | Patient/clinical records aur referral statuses | Centre encounter, triage, shift coverage, handover aur escalation |
| Diagnostics / lab | Referral pathway | Test catalogue, orders, sample status, authorized results, turnaround, billing/fund linkage aur daily test/shift performance se monthly/half-year/annual growth reporting |
| Pharmacy store | Camp medicine stock aur dispensing | Centre/store workflow, procurement, supplier invoices, batch/expiry aur reconciliation |
| Ambulance | Camp planning mein ambulance-access assessment | Actual vehicle register, duty/dispatch, trips, crew, maintenance aur costs |
| Free medical equipment | Capital/equipment sponsorship intents | Equipment assets, application, eligibility, approval, issue/return, condition aur maintenance |
| Welfare office | Patient eligibility aur separate Zakat/general ledgers | Centre-wide casework, approved support decision, document evidence aur review/appeal |
| Capital roadmap | Phases, milestones, CSR commitments aur dedication intents | Profile ke projects ka approved record, costing, funding progress, completion evidence aur donor reports |
| Water/community/volunteers | WASH projects aur community activity records | Verified sites/programmes, volunteer onboarding, training, shifts aur organization-wide service register |
| Social analytics/growth | Manual campaigns aur partial Meta/WhatsApp infrastructure | Per-account analytics, actual source metrics, automatic imports, growth planning aur approval calendar |

Is table mein gap ka matlab har jagah zero code nahin; kai jagah existing camp module ki extension chahiye. Purane camp aggregates ko identifiable patients, centre visits ya completed new projects mein tabdeel nahin kiya jayega.

## 3. Website aur profile mein milan / farq

- Website se 15 doctors ke naam aur unki image links mile. Profile complete doctor roster nahin deti; woh specialties aur ek senior gastroenterologist ka zikr karti hai. Website ke Dr. Shahnawaz Awan aur profile ke Assist. Prof. Dr. Shah Nawaz ko sirf milte-julte naam ki wajah se automatically ek record nahin banaya gaya.
- Profile equipment ki list mein crutches aur walkers bhi deti hai. User ne eligibility criteria ka zikr kiya, lekin equipment ka mukammal approved criteria is document mein nahin mila. Welfare subsidy percentages ko equipment issue policy na banaya jaye.
- Website par Annual Qurbani, Disaster Response Cell, water/sanitation aur youth skills ke alag project references hain. Profile ka focus medical services, CSR aur capital expansion par hai. Profile mein kisi website project ka na hona us project ke band hone ka saboot nahin.
- **Monthly food programme:** website ki purani list mein naam hai; is profile mein us programme ka zikr nahin. Aap ke jumlay “wo nahin hai” se app mein missing hone aur programme ke current status mein ambiguity hai. Is liye na active service assume ki gayi hai, na closed. Wazahat milne par status durust hoga.
- Website se Facebook aur Instagram ke links mile. Aap ne mazeed social accounts bataye; is profile mein unke public handles ya account-to-service mapping nahin. Unhein invent nahin kiya gaya.

## 4. Doctors ki images, updates aur WhatsApp sharing

- Website ke doctor-name labels aur image links ka register banaya gaya; tamam 15 files download huin aur har file 120 x 120 pixels ki hai. Clear profile/print use ke liye high-resolution originals ki zaroorat ho sakti hai. Tasveer ko usi public name label ke saath map kiya jaye; chehre se identity ka andaza nahin.
- Aap ki separately attach ki hui updated images/list ko current approved source rakha ja sakta hai; purane naam, qualification ya timing ko chupke overwrite na kiya jaye. Record mein source, updated date aur approving person hon.
- Directory mein naam, specialty, qualification, approved photo, branch, timings, availability aur profile status ke editable fields chahiye. Changes ka audit aur public publication control ho.
- WhatsApp sharing ke liye selected doctor/service ka approved public card ya link, editable draft aur user-selected recipient/share action chahiye. Private patient notes ya beneficiary details public card mein na aayen.
- Share button aur automated WhatsApp Business sending alag features hain. Automated sending ke liye consent, provider configuration, approved templates jahan required hon, aur delivery status chahiye. Is review mein koi message send nahin kiya gaya.

## 5. Profile ke data-quality points

| Source ka point | App/report mein kya karna hai |
|---|---|
| 300,000+ annual reach, 500+ daily OPD, 1,000+ monthly tests, 18+ annual camps, 95% satisfaction, 100+ trainees aur 10,000+ water beneficiaries | Source-stated KPIs rakhein; reporting period, calculation, original register aur approval milne tak verified live counts na banayen |
| 500+ daily OPD current scale aur Phase 4 target dono jagah | Current baseline aur future target ki definition reconcile karni hai |
| Executive summary mein audited financial performance ka dawa | Actual audit period, signed statements aur detailed accounts is file mein nahin mile; audited accounts available hone ka badge na lagayen |
| FBR, PCP, SHCC aur ISO claims | Certificates, validity, identifier aur scope ko supporting records se verify karna hai; SECP ko source ke mutabiq in-process rakhna |
| Tax exemption ke saath “100% donations” ka claim | Source claim ko guaranteed fund-utilization result na banayen; actual programme/admin allocation se reporting ho |
| FBR/SECP aur accreditation sections ka repetition | Display mein duplicate entries merge ki ja sakti hain; asal document mehfooz rahe |
| Zakat/general aur purpose-specific banking tables | Treasury verification aur original fund-category conflicts resolve kiye baghair bank routing publish/update na ho |
| Standard 25% subsidy aur eligible 50–100% support | Approved current welfare policy se configurable rules banayen; automatic eligibility is review se apply nahin hui |

Profile ke reported numbers aur pehle imported six-camp historical totals alag scope ke data hain. Unhein jor kar naya reach, unique beneficiary ya expenditure total nahin banaya gaya.

## 6. Development ki amli tarteeb

1. Shared organization/service register, doctors directory, photos aur editable approved timings.
2. OPD/centre casework aur welfare approvals, phir lab, pharmacy store, equipment aur ambulance ke linked workflows.
3. Profile ke actual capital phases ko approved costing, funding aur evidence ke saath track karna; pehle koi fake project progress nahin.
4. Volunteers, procurement, safeguarding, grants aur source-backed donor/project reporting ki extensions.
5. Separate social-account analytics, market-evidence growth suggestions aur campaign/awareness-day calendar; actual accounts/data se imports.
6. Pehle se incomplete report layouts, conversion tracking, local PKR providers aur external-data integrations ka code aur live configuration alag verify karna.

Yeh updated review aur implementation priorities hain. Is review ke dauran application code, live deployment, database records, social accounts ya payment settings nahin badle gaye; build ya live workflow tests dobara chalane ka dawa nahin.

## Mutaliq review files

- [Nonprofit ecosystem scope](NONPROFIT-ECOSYSTEM-REVIEW.md)
- [Website services aur doctors ki tafseel](WEBSITE-SERVICES-AND-DOCTORS.md)
- [Pehle se documented implementation status](IMPLEMENTATION-STATUS.md)

## Lab performance ki latest wazahat

Aap ne existing lab performance tracker/daily reports se test-wise aur shift-wise tracking, monthly/half-yearly/annual summaries aur comparable-period growth ki requirement di hai. Sirf lab ki general listing par rukne ke bajaye [poora import aur analytics workflow](LAB-PERFORMANCE-REQUIREMENTS.md) darj hua hai. Blank lab test form mil gaya hai aur catalogue/packages extract huay hain; filled performance tracker/report abhi nahin mila. Us ke aane par asal headers, formulas aur counts se mapping/reconciliation hogi.

## Organization-wide reporting aur department tabs

Aap ki wazahat ke mutabiq Medical Centre KAWT Welfare Trust ka core project hai. Har department ki separate reporting/tab aur Overall Dashboard par combined view hoga; Lab Performance ka apna dedicated tab hai. Purane software mein API na ho to source reports ke upload, extraction, reconciliation aur approved import ka rasta [legacy report aur organization analytics review](LEGACY-REPORT-IMPORT-AND-ORG-ANALYTICS.md) mein hai. Yeh requirement/documentation hai; nayi UI ya import code is update mein implement nahin hua.

## Latest user-provided doctor schedule aur organization structure

Aap ne doctors ka poster diya: 11 OPD aur 4 Urgent Care schedule entries, timings aur charges ke saath. Website se differences [poster comparison](DOCTOR-POSTER-COMPARISON.md) mein mehfooz hain. Aap ki latest wazahat ke mutabiq Laboratory (3 shifts), OPD aur 24/7 Urgent/Emergency Care Medical Centre ke andar hain; Khidmat-e-Alam Pharmacy alag store/unit hai. Is latest mapping ko pehle ke generic department assumptions par tarjeeh hai. Editable doctor groups, schedules aur charges requirement hain; UI/code abhi implement nahin hua.

## Lab PDF aur financial reporting ki latest source mapping

[Lab form review](LAB-FORM-SOURCE-REVIEW.md) se 85 test-menu options aur 8 packages nikle, performed counts nahin. [Department finance requirements](DEPARTMENT-FINANCE-AND-PANEL-REQUIREMENTS.md) mein panel rates/patient counts, commission/salary, collections aur actual costs alag map hain. Lab ki 3 shifts confirmed hain; Emergency ki 3 shifts user ne ehtimali batayi hain aur admission nahin hota.
