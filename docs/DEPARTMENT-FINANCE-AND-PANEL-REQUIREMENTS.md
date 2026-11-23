> Yeh source/scope review implementation se pehle record hua tha. Lab entry/reporting, imports, directory aur package rates ki current code status ke liye [20 November implementation checkpoint](LAB-IMPLEMENTATION-2026-11-20.md) dekhein. Neeche review-only/pending ke jumlay us waqt ka jaiza hain.

# KAWT — Department finance, panel patients aur doctor remuneration

Source: aap ki 20 November 2026 ki wazahat. Yeh requirements hain; source financial reports abhi import nahin huin aur actual financial results calculate nahin huay.

## Aap ki di hui maloomat

- Purane software mein departments ki operational aur financial reports mojood hain.
- OPD doctors ke consultation charges hain; panel sheets par panel name, rates aur patient counts alag milte hain.
- Kuch doctors commission-based aur kuch salary-based hain.
- Organization ko collections, doctor payments, expenses aur bachne wali raqam ka department-wise aur overall view chahiye.
- Lab ki 3 shifts confirmed hain. Emergency ki 3 shifts ka aap ne ehtimali zikr kiya; source roster milne se pehle unhein confirmed 3-shift pattern na banaya jaye.
- Emergency 24/7 hai, treatment beds/stretcher hain aur aap ke mutabiq inpatient admission nahin hota. Isay inpatient ward/admission workflow assume na kiya jaye.

## Source mapping aur calculations

| Hissa | Kya map karna hai |
|---|---|
| Department/project | Medical Centre ke OPD, lab, urgent care; alag pharmacy store aur approved welfare/project dimensions |
| Panel | Source panel name/code, rate agreement, effective period, service eligibility, payer aur receivable/settlement |
| Service charges | Doctor/test/service, actual applied rate, quantity, gross bill, approved discount/support, refund aur net bill |
| Collections | Actual received amount, payment date/method aur source receipt; billed amount ko cash collection na kahen |
| Doctor commission | Agreed percentage/fixed basis, applicable services/panels, earned vs paid aur adjustments; koi default percentage invent na ho |
| Salary-based doctors | Actual payroll period, salary expense/payment aur approved department allocation; har patient par poori salary repeat na ho |
| Costs | Supplies, wages, rent/utilities aur dusre source-backed direct/allocated costs, defined period/basis ke saath |
| Welfare subsidy | Approved fund/payment support aur panel discount alag; ek benefit do martaba subtract na ho |
| Department result | Full cost available ho to defined-basis surplus/deficit; sirf direct costs hon to contribution ka label, final net result nahin |
| Overall result | Same period/accounting basis aur internal transfers/department overlaps ko resolve karke consolidated result |

Panel ko automatically Zakat, free patient ya ek religion/identity group ke saath map na kiya jaye. Asal panel contract/policy se meaning tay ho. Current rate ko purani transactions par apply na karein; historical source rate/effective period mehfooz ho.

Raw source reports, original extracted values, edited values, approving user aur revision/audit history hon. Correction ke baad related summaries dobara calculate hon; cash, billed revenue aur receivables ko mix na karein. Misread numbers ya missing accounts ko AI se fabricate na kiya jaye.

## Lab upload se alag scope

Lab ki weekly/monthly test-count report us ki performance mapping ka pehla sample hai. Overall financial reporting ke liye OPD/panel, remuneration, collections aur expense reports ka alag mapping hoga. Ek blank lab test-request form is financial dataset ka badal nahin.

Yeh requirements record huin; authorized import/editor aur finance reporting UI/code is review mein implement nahin hua.
