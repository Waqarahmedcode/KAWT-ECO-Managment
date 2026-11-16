# Free local preview on a Windows PC

The cloud workspace's running app and database do **not** automatically run on your PC. First transfer and extract the current `kawt-web-current.zip` into a private user folder on your PC. The archive excludes all cloud/local credentials and dependencies. The original uploaded source ZIP does not contain the subsequent implementation.

Install Node.js 22+ and Docker Desktop, enable its Linux container engine, and start Docker Desktop. No paid hosting, cloud account, remote database key, payment account or public publication is required for this local test. Initial dependency/container downloads require Internet access and sufficient disk space.

In PowerShell, change to the extracted application directory and run:

```powershell
npm ci
npm run db:local
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Once those commands finish successfully **on that PC**, type `127.0.0.1:3001` in its browser. This is a same-machine address, not an already accessible cloud preview URL. Open `/donate` for the public donor structure, `/login` for staff sign-in, and `/dashboard` for the shared workspace.

Read the generated `.local/accounts.json` privately on that PC to choose a synthetic development account. Do not paste this file, `.env.local` or keys into chat. Keep the extracted project under your private Windows user profile and preserve restrictive folder permissions. Unix mode flags alone do not establish Windows NTFS access controls.

The startup script uses the local Docker engine, creates a fresh local Supabase stack and locally generated settings, applies the schema and seeds reference camps. It refuses a remote `DATABASE_URL`; do not load remote secrets for this preview. Database/login/storage readiness checks must succeed before treating setup as complete.

The portable Node startup script was executed successfully in Linux cloud. Windows Docker Desktop execution has not been tested in this environment; report the precise command error if a platform prerequisite fails. No Windows installation was performed remotely.

Stripe, PayPal and WhatsApp remain disconnected. Pledges and staff workflows use the PC's own local database. Bank destinations and tax certificates remain gated by human evidence verification. Changes to this local test instance do not update the cloud workspace automatically; transfer source changes deliberately during subsequent development.
