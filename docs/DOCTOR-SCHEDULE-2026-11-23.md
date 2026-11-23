# Doctor schedule source import

The supplied OPD poster is now available as an editable Medical Centre source schedule: 11 OPD entries and four Urgent Care entries, with the original days, time slots and reference fees. OPD and Urgent Care are separate tables. The two Shahnawaz entries remain separate; alternate-night rotation dates are not invented.

The schedule imports as source drafts. Automatic billing remains in the existing reception software. This update creates no billing tariffs, appointments, clinical results or patient records. The source does not provide a fee effective date. Administrators can correct each source record using the existing audited editor.

The hosting importer is explicitly enabled using `KAWT_IMPORT_DOCTOR_SCHEDULE=1`. It accepts only the approved project or an isolated local validation database, requires the configured owner to be an existing verified administrator, and uses that administrator's RLS scope and correction audit. It never creates or confirms an account. Imports run in a transaction, use a source receipt, do not duplicate records, and do not overwrite subsequent corrections. Conflicting pre-existing sources stop the import.

Local validation: five integration/browser checks, 44 unit tests, TypeScript and ESLint. The integration test uses a disposable local database and existing local Auth fixtures; no live accounts are created. The optimized production build and the same integration/browser checks against the production server also pass. Live deployment is verified in `DOCTOR-SCHEDULE-LIVE-2026-11-23.json`: the owner is verified, all 15 source doctors are saved, no new schema migration was required, and automatic billing remains disabled.

Hosted Medical Centre: https://kawt-eco-managment-preview.netlify.app/medical-centre

Patient-wise Lab entry with test selection, referral source, reference charges and automatic Pakistan date/time remains the next development step. The existing Lab entry is still the aggregate report editor.
