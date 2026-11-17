# KAWT preview and handoff

## Routes

- `/` redirects to `/preview`.
- `/preview` is a public, read-only view of attached source summaries/plans, independent of staff authentication and database availability.
- `/dashboard` is the authenticated staff application. If backend variables are missing it shows an explicit unavailable view, never a silent source preview.

## Verified staging deployment

- Public preview: https://kawt-eco-managment-preview.netlify.app/preview
- Staff route: https://kawt-eco-managment-preview.netlify.app/dashboard (backend unavailable until configured)
- Site administration: https://app.netlify.com/projects/kawt-eco-managment-preview
- Repository: `Waqarahmedcode/KAWT-ECO-Managment`, `main`, root directory.
- Initial verified deploy: `6afc37a626ebe0a88479fe5a`, application revision `79ce2cd`.
- Desktop/mobile screenshots and verification results are retained in `docs/screenshots` and `docs/NETLIFY-VERIFICATION.json`.

## Hosting

The official `@netlify/plugin-nextjs` runtime is explicitly declared in `netlify.toml` and enabled for the staging site. Publishing raw `.next` output without the runtime produces missing routes/functions.

Use a new Netlify staging site and preserve existing sites. Link the repository root of `Waqarahmedcode/KAWT-ECO-Managment`, branch `main`, Node 24, frozen dependency installation and the committed Netlify Next.js build configuration. A static drag-and-drop upload/GitHub Pages cannot serve these server APIs. This source does not itself prove that a Netlify site has been authorized or deployed; the handoff status must include verified URLs or the precise pending blocker.

The source preview can be deployed before a database is ready. Staff operation requires private `DATABASE_URL`, public Supabase URL and publishable key, the exact HTTPS site origin and a private rate-limit salt. Never copy loopback/local development credentials to hosting. Configure Supabase Auth redirects for that HTTPS origin. Rotate passwords exposed in chat before real remote release.

Inspect the identified remote project's schema and migration history before applying the twelve ordered SQL migrations. No remote reset or blind Prisma schema push is allowed. Source-only seeding must not generate patient/donor/transaction fixtures or default project/camp placeholders. Create real production users through the governed signup/role process.

## Validation

Run `npm ci`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run test:data`. The non-mutating browser checks use loopback-only targets and never create synthetic business records:

```sh
KAWT_PREVIEW_TEST_URL=http://127.0.0.1:3002 npm run test:preview
```

For full local authenticated checks, supply a private existing local development-account path through `KAWT_PREVIEW_ACCOUNTS_PATH`. `KAWT_UNCONFIGURED_TEST_URL` may identify a second loopback server without database configuration. Screenshots/results are written to the ignored `.local/preview-validation` directory. Fixture-producing workflow suites belong on a disposable test database, not a source-only product database.

The download handoff must distinguish committed source, historical ZIPs and uncommitted tool-only changes. Preserve original uploads and a hash/duplicate manifest, include real dated screenshots and review reports, and exclude credentials, `.local`, dependencies, build output and auth stores. Store original-document bundles as owner-accessible draft release assets unless public document publication is explicitly approved.
