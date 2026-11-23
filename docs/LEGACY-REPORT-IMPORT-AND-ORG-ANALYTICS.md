> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Purane software ki reports se organization-wide tracking

Source: aap ki 20 November 2026 ki wazahat. Yeh review aur implementation requirement hai; purane software mein login, data import ya live integration nahin ki gayi.

## Organization ka sahi structure

KAWT Welfare Trust overall nonprofit organization hai. Medical Centre us ka core project hai, poori organization ka dusra naam nahin. Medical Centre ke confirmed departments — OPD, urgent/emergency care aur lab — alag operational reporting rakhein. Aap ki latest wazahat ke mutabiq Khidmat-e-Alam Pharmacy alag pharmaceutical store/unit hai; usay Medical Centre ka department assume nahin kiya jayega. Ambulance/equipment ka approved operational linkage service register mein rahe. Welfare aur dusre projects ki reporting bhi alag ho, phir authorized organization-wide view mein mile.

Har imported record par available source ke mutabiq organization, project, department/cost centre, branch, operational date, shift aur fund category map ho. Departments aur projects ki list user-approved sources se aaye; andazay se default business records na banaye jayen.

## API ke baghair pehla amli rasta

1. Purane software se available original export ya report lena: CSV/XLSX ho to structured import; PDF ya print scan ho to extraction/OCR ke baad review.
2. Original file, source software, report title, period, department aur upload batch ka record mehfooz rakhna.
3. Columns aur report definitions map karna. Dates, codes, currency, count, amount aur totals ka preview dena.
4. Source ke printed totals se extracted rows ka reconciliation. OCR confidence akela approval nahin: decimal, comma, minus sign, date aur subtotal ki checking bhi ho.
5. Authorized approval ke baad normalized analytics data import karna. Duplicate file aur revised report ko pehchan kar double counting rokna.
6. Daily reports se monthly, half-yearly aur annual department/project summaries aur growth views banana; source coverage aur last update dikhana.

Is file-based workflow ko source software ke API ki zaroorat nahin. Jahan software direct print deta ho, print-to-PDF ki available sahulat original digital report hasil karne ka rasta ho sakti hai; physical print scan bhi review ke saath liya ja sakta hai.

## Data ki mukhtalif qisamain

| Report ki qisam | Kya nikala ja sakta hai | Kya infer nahin karna |
|---|---|---|
| Lab daily test/shift report | Test volumes aur comparable growth | Sirf completed totals se pending orders ya unique patients nahin |
| OPD activity report | Reported consultations aur shift/service totals | Visits ko automatically unique patients nahin |
| Urgent/emergency report | Actual encounters aur available shift counts | Clinical outcomes, acuity ya staffing quality source fields ke baghair nahin |
| Pharmacy/diagnostic billing | Source-defined sales, discounts, receipts aur refund aggregates | Billed amount ko cash received ya profit nahin |
| Financial ledger/cashbook | Verified income/expense aur fund/cost-centre summaries | Cash aur accrual bases, internal transfers aur receipts ko double count nahin |
| Welfare/project report | Approved assistance, activities aur project utilization | Aggregate beneficiaries ko named cases mein nahin badalna |

Daily reports aur monthly summary reports mein wohi activity overlap kar sakti hai. Ek approved canonical dataset count hoga; dusri summary reconciliation ka hawala hogi, additional activity nahin.

## Organization-wide financial aur growth view

- Har project aur department ki service volume, costs aur available revenue/collection alag dikhayen.
- Zakat, general aur restricted funds source ke approved categories ke saath rakhein; unknown allocation ko invent na karein.
- Organization total banate waqt departments ke darmiyan internal charges/transfers aur overlapping source reports ka double count resolve ho.
- Financial reporting ke accounting basis, report period, currency, branch aur fiscal-year definitions clear hon.
- Daily/shift/monthly/half-year/annual comparisons same definitions aur comparable periods se hon; missing data ko zero na banayen.
- Aggregate operational reporting mein unnecessary patient identities na hon. Raw financial/patient documents aur extracts authorized roles tak mehdood rahen.

## Baad ki automation ke options

API na ho to full integration ka dawa na kiya jaye. Pehle actual file workflow chale. Agar source software ijazat deta ho to scheduled exports ya authorized read-only reporting access ka alag assessment ho sakta hai. UI/login-based report download bhi sirf documented permission, supported access aur secure session ke saath evaluate hoga; login page ka milna automatic reliable integration ka saboot nahin.

Purana software apne operational records ka source rahega jab tak approved migration plan na ho. Analytics import ka matlab us software mein transactions create/edit/delete karna ya replacement nahin.

## Agli source file se kya tay hoga

Existing performance tracker aur ek actual departmental report se fields, report grain, test/shift definitions, available totals aur import mapping samajh aaye gi. Financial files milne par un ka alag authorized mapping aur reconciliation hoga. Is waqt koi dummy figures ya uploaded financial records create nahin kiye gaye.

Mutaliq: [Lab performance](LAB-PERFORMANCE-REQUIREMENTS.md), [Profile aur architecture review](PROFILE-ARCHITECTURE-GAP-REVIEW.md), [Overall nonprofit ecosystem](NONPROFIT-ECOSYSTEM-REVIEW.md).

## Department ke alag tabs — aap ki tasdeeq-shuda requirement

Lab Performance ka dedicated tab hoga. OPD, Urgent/Emergency Care, Pharmacy, Ambulance, Medical Equipment, Welfare/Projects aur Finance ke apne department tabs/views honge. Har department mein us ke relevant daily, shift-wise, monthly, half-yearly aur annual filters/reporting ho; jis metric ka actual source na ho usay invent na kiya jaye. Organization ka combined overview Overall Dashboard par ho aur common date/branch/project filters se linked ho. Yeh approved navigation requirement hai; in naye tabs ka UI/code is review mein implement nahin hua.

## Latest organization mapping

Medical Centre ke andar OPD, Laboratory (3 shifts) aur 24/7 Urgent/Emergency Care honge. Khidmat-e-Alam Pharmacy alag store/unit hai. OPD aur Urgent Care doctors ke alag editable groups hon. Poster/source differences [doctor schedule comparison](DOCTOR-POSTER-COMPARISON.md) mein hain. Lab ki shift timings aur urgent-care building ka address abhi invent nahin kiya gaya.

## Received lab form aur alag financial mapping

Lab ki scanned PDF se actual test catalogue aur package labels/amounts milay, completed test counts nahin. [Lab source review](LAB-FORM-SOURCE-REVIEW.md) aur [panel/doctor financial requirements](DEPARTMENT-FINANCE-AND-PANEL-REQUIREMENTS.md) is farq ko record karte hain. Uploaded image/PDF ke numbers user-editable review, original-value history, reconciliation aur approved recalculation se guzren.
