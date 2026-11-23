> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Attach ki hui lab PDF se catalogue aur packages

Source: **sunday last lab form waqarpdf.pdf**, received aur reviewed 20 November 2026. PDF ek safhay ki scanned image hai; embedded selectable text nahin. Image ko parh kar aur OCR se cross-check karke source transcribe hua. Asal PDF mehfooz hai.

## Is file mein kya mila

Yeh Khidmat-e-Alam Diagnostic Center ka blank test-request form hai. Is mein Date, Patient Name, Age, Gender, Reference By, Phone aur Doctor Signature ke khaali fields hain; kisi patient ki bhari hui details nahin. Checkbox menu mein 85 options aur neeche 8 discount packages hain.

| Category | Printed checkbox options |
|---|---:|
| Hematology | 7 |
| Biochemistry | 21 |
| Special Chemistry | 21 |
| Parasitology | 5 |
| Serology | 6 |
| Microbiology | 25 |
| Kul | 85 |

85 options ka matlab performed tests, unique patients ya 85 mutually exclusive single-component assays nahin. CBC ESR jaise combined labels aur specimen-specific Culture & Sensitivity options source ke mutabiq alag rakhe gaye hain.

## Printed packages

| Package | Form par amount |
|---|---:|
| Diabetic Profile | 1700/- |
| Gynae Profile | 1600/- |
| Dengue/Malaria Profile | 1500/- |
| Dengue Screening | 1000/- |
| Lipid Profile | 650/- |
| Renal Profile | 1100/- |
| Liver Function Test | 700/- |
| Malaria profile | 600/- |

Package amounts form se liye gaye hain; currency explicitly print nahin, effective date nahin, aur individual menu tests ke rates nahin. Yeh live approved billing rates ke taur par apply nahin huay. FBS/RBS ya SGPT & CBC ko bina definition individual performed counts mein expand na kiya jaye. HDL, LDL, Total Lipid aur Gamma GT packages mein hain, lekin main menu mein separate checkboxes nahin; is liye package component labels ko reviewed mapping chahiye.

## Is file mein kya nahin hai

Daily/weekly/monthly test counts, shift entries, completed/pending/cancelled statuses, actual collection, panel rates, doctor commission/salary aur historical performance observations is blank form mein nahin. Filename mein Sunday ka lafz kisi completed activity ya service date ka saboot nahin.

## Is source se tayyar outputs

- 85-row test menu: CSV aur JSON, category aur source-page ke saath.
- 8 packages: CSV aur JSON, printed component labels aur amounts ke saath.
- Source checksum, extraction method aur absent performance fields ki metadata.

Yeh source files hain; application database mein catalogue ya transaction records import nahin huay. Koi patient, shift count, revenue ya growth value invent nahin ki gayi.

## Lab performance ke liye upload ka agreed workflow

Aap ki wazahat ke mutabiq lab ki actual weekly/monthly ya shift report image/PDF ki form mein upload ho sake. Extraction ke baad test/date/shift/count/price ka preview, source ke totals se reconciliation, editable corrections aur approval ho. Correction ka audit aur original value/source mehfooz rahe; confirmed revision ke baad derived reports dobara calculate hon aur duplicate import na ho.

AI/OCR ka kaam text/table extraction, mapping suggestions aur explainable exceptions hai. Deterministic validated calculations totals, amounts aur comparable-period growth nikalein. Illegible values ko andazay se fill na karein; image mein na hone wale historical results invent na hon. Missing-data aur confidence/source-coverage wazeh dikhai jaye.

Pehli sample report **lab** ki chahiye; overall finance ki report ki jagah nahin. Overall finance, doctor remuneration aur panel rates ke liye unke apne source reports aur definitions alag map honge.

Mutaliq: [Lab performance requirements](LAB-PERFORMANCE-REQUIREMENTS.md), [Legacy report import](LEGACY-REPORT-IMPORT-AND-ORG-ANALYTICS.md), [Department finance scope](DEPARTMENT-FINANCE-AND-PANEL-REQUIREMENTS.md).
