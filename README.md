# KAWT shared web workspace

Next.js desktop operations, responsive field intake and a public donor portal backed by one Supabase PostgreSQL database. The separate Android project is preserved outside this directory.

1. Install Node 24, Docker and Python 3, then run `npm ci`.
2. Run `npm run db:local` to start and validate the isolated local Supabase stack, apply migrations, prepare development roles and seed the six source camps plus twelve planning slots.
3. Run `npm run dev -- --hostname 127.0.0.1 --port 3001` on the same machine. Local development credentials are in the private `.local/accounts.json` file; they are never included in the delivery ZIP.

The cloud onboarding UI does not supply a shareable localhost preview URL. Screenshots can be transferred privately; an interactive external URL requires a separately configured private staging host. Nothing has been publicly deployed.

Product data must come from the attached sources. The seed imports only `data/historical-camps.json` and `data/planned-camps.json`; it does not generate unassigned camps or default capital/WASH projects. Missing patient-level details stay missing. Local authentication accounts are technical development access, not historical staff/patient/donor records.

The workflow suite creates temporary synthetic fixtures. Do not run it on the source-only product database. A separate disposable test database and explicit `KAWT_ALLOW_SYNTHETIC_TEST_DATA=isolated-test-database` opt-in are required.

For a free preview on your own PC, see [Windows local preview](docs/WINDOWS-PREVIEW.md).

See [architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [phased execution guide](docs/DEVELOPMENT.md), [integration configuration](docs/INTEGRATIONS.md), and [requirements/status](docs/REQUIREMENTS.md). Remote database bindings, merchant accounts and live messaging are intentionally pending.

The public source preview is `/preview`; authenticated operations are `/dashboard`. See [preview handoff](docs/PREVIEW-HANDOFF.md) and [architecture review](docs/ARCHITECTURE-REVIEW.md).

Verified local screenshots: [public preview](docs/screenshots/public-desktop.png) and [authenticated staff view](docs/screenshots/staff-desktop.png). These are screenshot evidence, not live Netlify URLs.
