> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Website ki services aur doctors ka source review

Jaizay ki tareekh: 20 November 2026.

Yeh maloomat [official website](https://www.khidmat-e-alam.org/) ke dastiyab safhon aur aap ki wazahat se li gayi hai. Website ko aap ne purana/under-review hawala bataya hai. Is liye public listing ko aaj ki availability, professional registration ya service uptime ki azad tasdeeq nahin samjha gaya. Yeh review hai; is se app, live website ya database mein records import nahin huay. Baad mein attach hui organization profile ka milan [profile review](PROFILE-ARCHITECTURE-GAP-REVIEW.md) mein hai.

## Doctors aur consultants

Source: [Our Doctors](https://www.khidmat-e-alam.org/our-doctors/).

Safhay par 15 naam hain: 10 OPD listings aur 5 Urgent Care ke neeche. Neeche qualifications, specialties aur waqt website ke mutabiq hain; spelling bhi source ke qareeb rakhi gayi hai. Ghair-maujood details ko andazay se poora nahin kiya gaya.

| Naam | Website par qualification | Specialty/kaam | Website par waqt aur group |
|---|---|---|---|
| Dr. Arjun Kumar | MBBS, MCPS, FCPS | Consultant Physician | OPD: Monday, Wednesday, Friday 4–7 pm; Sunday 6–8 pm |
| Dr. Navaid Khan | MBBS, MCPS, (DCH) | Family Physician & Child Specialist | OPD: Monday–Saturday 8:30–11 pm |
| Dr. Benish Baqai | Darj nahin | Child Specialist | OPD: Monday–Saturday 7:30–10 pm |
| Dr. Eshwar Lohana | Darj nahin | Child Specialist | OPD: Monday–Saturday 12–3 pm; Sunday 6–8 pm |
| Dr. Nadia Shehzad | MBBS, MCPS, RMO (GYNAE & Obs) | Gynaecologist | OPD: Monday, Wednesday 12–2 pm |
| Dr. Jaywanti Jia | MBBS, D-DERM, Asthetic | Dermatologist | OPD: Monday–Friday 5–8 pm |
| Dr. Samreen Zehra | MBBS, RMP | Sonologist | OPD: Monday–Saturday 9 am–1 pm |
| Dr. Shahnawaz Awan | MBBS, MCPS, Prof. of Medicine | Gastroenterologist | OPD: Monday, Tuesday, Thursday 12–2 pm |
| Dr. Umair Ali | MBBS | General Physician | OPD: Monday–Saturday 9 pm–12 am |
| Dr. Mushtaq | Darj nahin | General Physician | OPD: Monday–Saturday 8–11 pm |
| Dr Ashad Aleem | MBBS | General Physician | Urgent Care; individual shift darj nahin |
| Dr. Zohaib | MBBS, RMP | General Physician | Urgent Care; individual shift darj nahin |
| Dr Arshad Hameed | MBBS, RMP | General Physician | Urgent Care; individual shift darj nahin |
| Dr Yusuf | Darj nahin | General Physician | Urgent Care; individual shift darj nahin |
| Dr Saleem Shah | Darj nahin | Pathalogist, website ki spelling | Website par Urgent Care group; individual shift darj nahin |

Tamam timings website par likhe huay waqt hain. Appointment dene, live roster banane ya public availability publish karne se pehle current list, branch, timezone aur duty timings ki organization se tasdeeq zaroori hai. Sirf website ke aam registration claim se har doctor ka registration number ya current status sabit nahin hota.

Mojooda code mein doctor role, camp staff roster, consultations aur referrals hain. Mukammal doctor profile, specialty directory, centre appointment aur recurring availability ka alag module is jaizay mein implemented nahin mila. Public website se directory milna app mein directory import ho jane ka saboot nahin.

## Services ka alag operational scope

Sources: [Who We Are](https://www.khidmat-e-alam.org/who-we-are/), [Projects](https://www.khidmat-e-alam.org/projects/), [Areas of Work](https://www.khidmat-e-alam.org/areas-of-work/), aur aap ki 20 November ki wazahat.

| Service | Saboot aur haisiyat | Ecosystem mein kya jorna hai |
|---|---|---|
| Specialist OPD / consultancy clinics | Website par doctors aur specialties listed | Current doctor directory, appointments, queue, consultation aur follow-up |
| Urgent care | Website par 24-hour claim; live coverage alag verify hogi | Triage, duty roster, encounter, escalation aur transfer records |
| Laboratory / diagnostic centre | Aap ne lab ki wazahat ki; website par laboratory, X-ray, ultrasound aur ECG ka zikr | Orders, sample tracking, authorized results, turnaround aur referral linkage |
| Pharmacy / pharmaceutical store | Aap ki wazahat aur website listing | Camp dispensing se alag store sales/issue, batch/expiry, procurement aur reconciliation |
| Ambulance service | Aap ki wazahat aur website par 24-hour claim | Fleet, dispatch, trip status, crew aur maintenance; available vehicles aur timings verify hon |
| Free/home-care medical equipment | Aap ne oxygen cylinders, wheelchairs, nebulizers aur eligibility criteria bataye | Equipment register, application, eligibility review, approval, issue/return, maintenance; asal criteria milne par configure hon |
| Water / sanitation | Website par Sabeel, RO plant aur bore wells listed | Site register, distribution, test evidence aur maintenance; certification claims ko asal reports se verify karna |
| Rural medical camps | Website aur pehle source camp reports | Mojooda camp workflows ko centre aur referral continuity se jorna |
| Annual Qurbani | Projects page par listed | Programme status, approved plan, fund allocation aur distribution evidence ki tasdeeq |
| Disaster response | Projects aur areas-of-work mein listed | Incident, needs assessment, supplies, deployment aur beneficiary support |
| Youth / volunteers aur skills training | Projects aur areas-of-work mein listed | Onboarding, skills, training, shifts aur real programme records |
| Monthly food programme | Purani website ki project list mein naam hai; aap ne inclusion par tasheeh ki hai | Current service/status assume nahin kiya gaya; wazeh tasdeeq ke baghair active programme ya fabricated distributions import nahin hon gi |

Home-care equipment ki eligibility, loan/return policy, deposit ya charges andazay se nahin banaye gaye. Oxygen aur dusre medical equipment ke clinical istemal ki hidayat is review ka hissa nahin.

## History aur future projects ko alag rakhna

Website organization ka aaghaz 2005 batati hai. Yeh website ka hawala hai, registration documents ki independent verification nahin.

Who We Are safhay par NICU, maternity wing, dental clinic, eye department, physiotherapy aur cold-storage/ghusl/burial facilities **future expansion** mein hain. Inhein sirf website ke zikr se operational departments na banaya jaye. Mojooda gynaecology consultation ka matlab planned maternity/surgical wing ka chalna nahin.

Website par financial-aid percentages bhi diye gaye hain. Inhein app ka automatic eligibility ya discount rule banane se pehle approved current policy chahiye. Page par dikhne wale zero counters aur undated statistics ko real outcomes nahin maana gaya.

## Social accounts, analytics aur growth planning

Website se do public links mile:

- [Facebook — Khidmat-e-Alam Welfare Trust](https://www.facebook.com/khidmatealamwelfaretrust)
- [Instagram — khidmat_e_alam](https://www.instagram.com/khidmat_e_alam/)

In links se account ownership, authorized API access ya live data import sabit nahin hota. TikTok ya dusre platforms ka verified organization account abhi is source review se establish nahin hua.

Har platform/account ka alag analytics view chahiye: organic aur paid reach, impressions, engagement, followers ka badlao, leads, approved donation attribution, spend aur cost metrics. Har figure ke saath source, period, currency, last sync aur definition hon; missing data ko zero na dikhaya jaye. Platforms ke mukhtalif metric definitions ko seedha mila kar unique-person total na banaya jaye.

Growth strategy aur suggestions asal campaign results, programme capacity, approved budgets aur dated market sources par mabni hon. Baseline aur uncertainty wazeh hon; fabricated forecasts ya guaranteed conversion claims na hon.

Planning mein mission se mutaliq awareness days, seasonal health/disaster campaigns, Ramadan/Zakat aur Qurbani ke relevant windows, content owner, due date, review aur approval hon. Dates official calendars se verify hon; lunar dates ko final announcement tak provisional rakhna hoga. Yeh calendar requirement hai, koi campaign schedule ya ad budget approve nahin hua.

Is jaizay se koi social post, advertisement, payment ya WhatsApp message send nahin hua.

## Review se implementation tak

1. Current doctors/roster, service list aur equipment policy organization se confirm karna.
2. Shared service/project register aur doctors directory ka implementation plan banana.
3. OPD, lab, pharmacy store, ambulance aur equipment ko alag operational workflows dena, existing patient/referral/finance records se jorna.
4. Welfare cases, volunteers, procurement, donor reporting aur programme reporting ko source-backed records ke saath jorna.
5. Social analytics aur growth/calendar modules ke liye approved account access aur actual metrics use karna.

Is review ke saath koi naya business record ya dummy data create nahin kiya gaya.

## Doctors ki image files aur latest additions

Website par naam se labelled 15 image files download ho gayi hain; har image 120 x 120 pixels ki hai. Yeh directory thumbnails hain, high-resolution originals nahin. Profile document mein ek logo image hai, doctor portraits ka mukammal set nahin. Aap ki updated/clear images ko naam aur approved details se map kiya ja sakta hai. WhatsApp sharing aur editable profiles ki requirement [profile review](PROFILE-ARCHITECTURE-GAP-REVIEW.md) mein, aur lab performance [alag requirement](LAB-PERFORMANCE-REQUIREMENTS.md) mein darj hai.

## Latest user-provided doctor schedule aur organization structure

Aap ne doctors ka poster diya: 11 OPD aur 4 Urgent Care schedule entries, timings aur charges ke saath. Website se differences [poster comparison](DOCTOR-POSTER-COMPARISON.md) mein mehfooz hain. Aap ki latest wazahat ke mutabiq Laboratory (3 shifts), OPD aur 24/7 Urgent/Emergency Care Medical Centre ke andar hain; Khidmat-e-Alam Pharmacy alag store/unit hai. Is latest mapping ko pehle ke generic department assumptions par tarjeeh hai. Editable doctor groups, schedules aur charges requirement hain; UI/code abhi implement nahin hua.
