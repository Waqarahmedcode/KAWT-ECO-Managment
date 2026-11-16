# Remote Supabase connection status

Target API: `https://ftuyaeljayonfaxolwqi.supabase.co`.

The supplied browser-safe publishable key was accepted by Auth health checks and by the installed Supabase JS client. API probes for `camps` and `profiles` returned HTTP 404 / PGRST205. This means those tables were unavailable in the API schema cache for these requests, not proof that the entire project contains no data. The dashboard project title was not inspected or verified.

The application now accepts `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` for legacy/local stacks. Server session handling, browser login, session refresh, configuration detection and integration health checks use the same selection. Existing helper dependencies and the Next.js proxy already exist; no tutorial todos page or duplicate middleware was added.

No remote writes, migrations, seeds, account creation or messages have been executed. The working app continues using its local source-only database until the remote schema and runtime bindings can be verified together.

## Database transport blocker

The user subsequently supplied the PostgreSQL password and the project's session-pooler address. These were combined only in a private local runtime file excluded from source archives. No password is recorded in this document.

The direct database endpoint resolves to IPv6 and failed with ENETUNREACH. The session pooler resolves to IPv4, but PostgreSQL connection attempts on port 5432 failed with ECONNREFUSED both inside and outside the command sandbox. A socket probe of the supported transaction-pooler port 6543 was refused as well. Authentication and SQL schema inspection were therefore not reached; the database password has not been verified. This evidence does not identify which network/service layer refuses the connection. Changing the password again is not a diagnosis for this transport failure.

The app remains on its working local source-only database. Further remote progress needs a working supported PostgreSQL route from this environment or authorized database-management access; repeatedly asking for the same public key or connection string will not resolve it. Cloudflare bindings were not verified in this session.

## Runtime configuration reference

Configure `DATABASE_URL` privately for this exact project, using the PostgreSQL connection string from Supabase Connect. The supplied session-pooler URL is now retained privately for the pending connection check. Do not include it in an archive. Because passwords were pasted into chat, rotate the database password through Supabase and update the private runtime binding before real deployment.

The URL and public key have already been supplied; a legacy anon key is not additionally required. Optional MCP access can help inspect or manage schema but does not itself provide this application's PostgreSQL runtime connection.

Once access is available: inspect existing tables and migration history read-only; resolve conflicts before applying the app's twelve ordered migrations; then import only the attached source records without generating placeholders or synthetic business data. Verify roles, Auth and private Storage before changing the app's runtime target. Do not run fixture-producing workflow suites against the source-only remote product database.

For Node's native outbound requests in this managed cloud environment, `NODE_USE_ENV_PROXY=1` was needed to use the existing configured proxy. TLS verification remained enabled.
