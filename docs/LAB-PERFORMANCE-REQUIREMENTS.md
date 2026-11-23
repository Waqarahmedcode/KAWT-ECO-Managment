# Lab performance — confirmed requirements aur current implementation

20 November 2026: blank catalogue form ke baad filled monthly source bhi mil chuka hai. Owner ne period ko poora July 2026 confirm kiya; filename se kisi din ki date nahin banayi gayi. [Current code, checks, limits aur deployment](LAB-IMPLEMENTATION-2026-11-20.md) is requirement file ko supersede karta hai jahan purana review implementation ko pending kehta tha.

| Requirement | Current state |
|---|---|
| Medical Centre ke andar Laboratory, OPD aur 24/7 Urgent/Emergency | Navigation aur directory mein alag sections; Pharmacy aur welfare camp/WASH projects alag |
| Morning, Evening, Night counts | Private editable direct-entry page aur table reports |
| Main reported patients/tests; alag Outsource/Emergency referrals | Implemented; supplementary blocks ko dobara add nahin karte |
| Year/month dropdown, actual daily date, week, half-year, annual, manual range | Implemented; missing day unavailable; aggregate ko daily numbers mein divide nahin karte |
| File se data extraction | Native PDF, Excel .xlsx, CSV/JSON drafts; local image OCR with warnings/corrections; no autosave |
| Historical imports aur duplicate safety | Admin-only batch; duplicate period rollback; corrections optimistic revision se |
| Limited external login | Dedicated account ko assigned lab entry/edit; SQL RLS aur API checks; no self-grant or general clinical permissions |
| Print/PDF, Excel, CSV aur WhatsApp share | Implemented; share user initiated; private access ke baghair linked record nahin khulta |
| Packages editable aur price history | Source draft/components editable; append-only approved effective-date rates |
| Partner labs/MOU | Source lab isolation implemented; actual MOU rate/settlement workflow pending |

Blank count null rehta hai. Explicit zero aur no-data alag hain. Test count se patients, revenue, clinical quality, turnaround, salary/commission ya unique beneficiaries infer nahin kiye jate. Monthly source tab tak daily detail nahin hai jab tak actual daily entry/report na ho.

Test names source labels ke saath preserve hote hain; unmatched names ko automatically kisi aur test mein merge nahin karte. Performance catalogue coverage, missing shifts aur incomplete annual coverage visible hain. Source rows aur totals ka reconciliation hota hai; low-confidence OCR ko editable review chahiye.

Comparable prior period data ke baghair growth percentage/prediction nahin. Growth trend panels, lab order/sample/result workflow aur raw file archive abhi separate extensions hain. Financial/panel/commission records [department-finance requirements](DEPARTMENT-FINANCE-AND-PANEL-REQUIREMENTS.md) mein alag dataset hain.
