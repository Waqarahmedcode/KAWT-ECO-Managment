# Private Lab patient/test entry

The department now has a patient-wise register alongside the existing source report editor. Staff sign-in opens `/lab/visits`. Medical Centre and the aggregate reports link to the same operational entry page; no standalone HTML preview is embedded.

The entry form uses the 85 source catalogue options and categories, patient name or reference, referral source/name, paid/free/subsidized/panel category, test quantity and optional reference price. Reference charges do not produce bills or initiate payments. Reception billing remains in the existing software.

Pakistan date/time defaults from the server clock. Staff may explicitly enter a historical service time. Shift hours and reference rates are administrator settings with a visible valid-from date. An older entry cannot inherit a later configuration. If actual hours are not configured for that date, staff choose the shift; missing prices stay unknown rather than zero. Previously saved shift/price snapshots are preserved when an unrelated correction is made.

Saved patient visits and test quantities are separate counts. In-house, MOU, Urgent Care and external referrals are subsets of those totals. Welfare categories are also subsets. Imported monthly aggregates are a different data source, never added again to patient entries. Visits are not independently deduplicated unique people.

Staff can correct records; every version is audited. Cancellation is reversible and excludes the entry from totals. Stale revisions are rejected. Retried or concurrent submissions with the same identity cannot create duplicate visits. The browser preserves an uncertain submission's time for retry.

Reports support today, last seven days, calendar month, half-year, year and custom dates. CSV, real XLSX and print/PDF contain performance totals rather than patient identities. Viewers receive only aggregate statistics. Operators access patient records only for their assigned laboratory; unrelated staff and partner labs cannot access those identities or audit history. Private routes are excluded from the existing service worker cache; this portal requires an online connection.

The additive migration `202611230019` creates three RLS-protected tables and the scoped aggregate function. It does not seed patients, actual shift hours or prices. The existing project-specific migration/readiness checks run before publishing.

Validation: 50 unit tests, TypeScript, ESLint, optimized production build, isolated SQL/API/browser checks, independent XLSX reopening, mobile layout, correction history, role boundaries, configuration date boundaries and a browser retry after a committed response is lost. Tests use synthetic records in a disposable local database and existing local Auth fixtures; no live test patients or Auth accounts are created. See `LAB-PATIENT-ENTRY-VALIDATION-2026-11-23.json`. Live deployment is verified in `LAB-PATIENT-ENTRY-LIVE-2026-11-23.json`: the approved database migration created three private tables, readiness passed, the 15 doctor source records remained intact, and protected routes rejected unsigned requests.

Live department entry: https://kawt-eco-managment-preview.netlify.app/lab/visits

Live Medical Centre: https://kawt-eco-managment-preview.netlify.app/medical-centre

Remaining external source work: the private July aggregate sample is not converted into individual patient records and has not been imported by this change. Existing admin PDF/Excel/JSON import remains available through the source report editor. OPD and Urgent Care patient/service registers, consumable records and integration with the separate financial-analysis app remain subsequent work; doctor schedule import is already live.
