> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Doctors ke poster aur website ka milan

Source: aap ka attach kiya hua Doctors OPD Timing Schedule poster, review 20 November 2026. Filename ki date ko effective schedule date nahin maana gaya; poster par explicit effective date nazar nahin aati. Original image chat mein nazar aa rahi hai, lekin is workspace mein us ke original bytes nahin mile. Transcription alag source-review JSON/CSV mein mehfooz hai; app/database mein import nahin hui.

## Poster ki entries

Poster mein 15 schedule entries hain: pehli 11 OPD aur neeche 4 Urgent Care. Yeh entries zaroori nahin ke 15 independently verified unique doctor identities hon; milte-julte short names ko merge nahin kiya gaya.

| Row | Naam jaisa poster par hai | Specialty | Din | Waqt | Poster par charges |
|---|---|---|---|---|---|
| 1 | Dr. Ishwar Lohana | Pediatrician | Monday–Saturday | 12–3 pm; 9:30–11 pm | Rs 1,000 |
| 2 | Dr. Naveed Khan | Family Physician, Pediatrician | Monday–Saturday | 8:30–11 pm | Rs 800 |
| 3 | Dr. Arjun Kumar | Consultant Physician | Monday, Friday, Saturday, Sunday | 4–7 pm; 6–8 pm | Rs 1,000 |
| 4 | Dr. Shahnawaz | Gastroenterologist | Monday, Tuesday, Thursday | 12–2 pm | Rs 1,000 |
| 5 | Dr. Binesh Bakai | Pediatrician | Monday–Saturday | 7:30–10 pm | Rs 800 |
| 6 | Dr. Sajida Nadeem | Gynecologist | Monday, Wednesday, Friday | 4–7 pm | Rs 1,000 |
| 7 | Dr. Nadia Shehzad | Gynecologist | Monday, Wednesday | 12–2 pm | Rs 700 |
| 8 | Dr. Jaywanti Jha | Dermatologist | Monday, Friday | 5–6 pm | Rs 700 |
| 9 | Dr. Khalik Ahmed | Dermatologist | Thursday | 8:30–9:30 pm | Rs 300 |
| 10 | Dr. Umair Ali | General Physician | Monday–Saturday | 9 pm–12 am | Rs 600 |
| 11 | Dr. Somreen Zahra | Sonologist | Monday–Saturday | 10 am–1 pm | Ultrasound Charges Only; amount darj nahin |
| 12 | Dr. Layakat (Urgent Care) | General Physician | Monday–Saturday | 8 am–2 pm | Rs 500 |
| 13 | Dr. Shahnawaz (Urgent Care) | General Physician | Monday–Saturday | 2–8 pm | Rs 500 |
| 14 | Dr. Ashok Kumar (Urgent Care) | General Physician | Alternate Nights | 8 pm–8 am | Rs 500 |
| 15 | Dr. Arshad (Urgent Care) | General Physician | Alternate Nights | 8 pm–8 am | Rs 500 |

Arjun Kumar ke row mein do time slots hain lekin har listed day ke saath explicit mapping nahin. Sunday ka slot website ke basis par silently assign nahin kiya gaya. Alternate nights ka start/rotation date poster mein nahin; date-wise roster andazay se generate nahin hoga. Ultrasound ka unspecified charge zero nahin.

## Website se aham farq

| Hissa | Website | Poster |
|---|---|---|
| Grouping | 10 OPD + 5 Urgent Care listings | 11 OPD + 4 Urgent Care schedule entries |
| Arjun Kumar | Monday/Wednesday/Friday aur Sunday | Monday/Friday/Saturday/Sunday |
| Lohana | Eshwar spelling; Monday–Saturday 12–3 pm aur Sunday 6–8 pm | Ishwar spelling; Monday–Saturday, do slots 12–3 pm aur 9:30–11 pm |
| Jaywanti | Jia spelling; Monday–Friday 5–8 pm | Jha spelling; Monday/Friday 5–6 pm |
| Sonologist | Samreen Zehra; Monday–Saturday 9 am–1 pm | Somreen Zahra; Monday–Saturday 10 am–1 pm |
| Fees | Reviewed doctors page par individual fee listing nahin | Consultation charges aur ultrasound-only note |
| Doosre doctors | Mushtaq aur doosre urgent-care names | Sajida Nadeem, Khalik Ahmed, Layakat, Ashok Kumar aur alag urgent-care Shahnawaz entry |

Naveed/Navaid, Binesh Bakai/Benish Baqai, Lohana, Jaywanti aur Somreen/Samreen jaise naam candidate matches hain; source names alag mehfooz hon. Gastroenterologist Shahnawaz aur Urgent Care Shahnawaz ko naam ki wajah se ek identity/photo na dein. Kisi source se naam missing hone ka matlab inactive doctor nahin.

## Aap ki latest structural wazahat

- KAWT Welfare Trust parent organization hai.
- **Khidmat-e-Alam Medical Centre** ke andar Laboratory, OPD aur 24/7 Urgent/Emergency Care hain.
- Laboratory ki **3 shifts** aap ne confirm ki hain; unki boundaries/timings abhi source se nahin milin. Urgent Care ke roster ko lab shifts ke saath force-fit na karein.
- Aap ne Urgent/Emergency Care ki separate building batayi hai. Building/location ka record clinical service se alag field ho; abhi address invent nahin.
- **Khidmat-e-Alam Pharmacy** alag pharmaceutical store/unit hai; usay Medical Centre ka department assume na kiya jaye. Common finance/reporting linkage ho sakta hai.
- OPD aur Urgent Care doctors alag views/groups mein hon. Authorized staff naam, specialty, approved image, schedule, charges aur active/inactive status edit kar sake; change history aur source/effective dates mehfooz hon.

Yeh agreed structure aur source review hai; naya directory UI, database records ya live schedule is update mein create/publish nahin hua.

Mutaliq: [Website doctors](WEBSITE-SERVICES-AND-DOCTORS.md), [Organization-wide reporting](LEGACY-REPORT-IMPORT-AND-ORG-ANALYTICS.md), [Lab performance](LAB-PERFORMANCE-REQUIREMENTS.md).
