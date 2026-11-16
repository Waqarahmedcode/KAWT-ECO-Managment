# Publish this source on Netlify

This is a Next.js server application, not a static website. Uploading the source ZIP into Netlify's static drag-and-drop area does not deploy its APIs/authentication.

## Repository and hosting

1. Extract the supplied ZIP. Open its `kawt-web` directory.
2. Create a private GitHub repository, for example `kawt-web`. Put the **contents** of the extracted directory at the repository root, so `package.json` and `netlify.toml` are at that root. Include the dotfiles, particularly `.gitignore`. Do not upload runtime credential files, `.local`, `node_modules` or `.next`.
3. In Netlify choose **Add new project / Import an existing project**, select GitHub and select that repository. Base directory: repository root (leave blank). Build: `npm run build`. Publish: `.next`. Node: 24. Netlify's Next.js runtime must be active.
4. Configure environment variables privately before building: `DATABASE_URL` (the Supabase session-pooler connection with the actual password and verified TLS), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (the exact HTTPS site origin), and a strong random `APP_RATE_LIMIT_SALT`. Keep private values out of Git and chat. A service-role key is not required for ordinary app runtime and must never use the NEXT_PUBLIC prefix.
5. In Supabase Auth configure the HTTPS site origin and its `/auth/callback` redirect URL. Production email/confirmation configuration must match the intended workflow.

## Database initialization is still pending

The new remote project has not had its full PostgreSQL schema inspected. Public API probes for the app tables returned PGRST205, which does not prove the whole project is empty. No remote migrations, seeding or account creation were performed in this cloud session. Publishing the UI does not initialize the database.

Use an authorized machine with PostgreSQL access, or Supabase's SQL Editor, to inspect existing tables and migration history first. For a confirmed empty development project, apply the twelve SQL files in `supabase/migrations` in filename order, each as a separate migration. Do not combine migrations into a single transaction: enum changes may need an intervening commit. Do not reset an existing database or overwrite an unrelated schema.

For the identified development target, run the source seed from an authorized machine with Node 22+ and dependencies installed. Keep the real remote bindings in a private `.env.local`. Seeding refuses remote targets unless that one process has `KAWT_ALLOW_REMOTE_SEED=approved-development-target`. The seed imports only the attached historical/planned JSON; it creates no dummy patients, donors, transactions, WASH projects or unassigned camp slots. Do not run `db:local` to configure a remote project, and do not copy local development accounts to production.

Create real user accounts through Supabase/app signup and assign the first authorized administrator deliberately through the governed profile process. Never infer an administrator from the first arbitrary signup.

## Validation and limits

After database setup and deployment, verify real login, an authorized dashboard read, and private file access. The local version passed TypeScript, lint, a production build, eleven unit contracts and eighteen operational workflows; this does not verify Netlify deployment or its network connection. Never run synthetic fixture suites against the source-only product database.

Some product-roadmap features remain incomplete as recorded in REQUIREMENTS.md. Live payments/messaging and institutional evidence also require separate configuration/review. No Netlify account was authorized or site deployed by this session. Database passwords pasted into chat should be rotated before real release, with the private runtime binding updated accordingly.
