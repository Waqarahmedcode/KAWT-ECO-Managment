# Backend and external integration configuration

Local PostgreSQL, Supabase Auth and private Storage have passed real requests. Stripe/PayPal/Meta/WhatsApp code exists, but no remote credentials or provider account connection has been verified. The admin **Governance & access → connections** panel reports binding presence separately from a real read-only check. It never returns secret values. Browser-visible `NEXT_PUBLIC_*` values are limited to publishable API settings/site/analytics IDs.

## Runtime and networking

`DATABASE_URL` is an actual PostgreSQL connection setting, not a proxy-held HTTPS secret placeholder. Use a validated Supabase direct/pooler connection with certificate verification and an appropriate server-side role. Runtime also needs `NEXT_PUBLIC_SUPABASE_URL`, publishable anon key and the correct HTTPS `NEXT_PUBLIC_SITE_URL`; RLS protects the public key's access. Supabase Auth redirect/site URLs must match. This local instance has generated loopback settings; it is not connected to a remote project.

No remote target has been inferred from document filenames or a connector account. Configure exact Supabase API/pooler hosts only when identified. Optional provider hosts include `api.stripe.com`, `api-m.sandbox.paypal.com` / `api-m.paypal.com`, `graph.facebook.com`, and the selected analytics domains. Request narrowly scoped network settings through the cloud environment settings; do not replace an unknown allowlist or send credentials to arbitrary hosts. Actual outbound access must be checked after settings are applied.

## Giving and payments

| Method | Implemented behavior | Pending live prerequisite |
|---|---|---|
| Pledge | Real idempotent donor/sponsorship intent, pending status; collects no payment | None for local validation |
| Bank transfer | Only checksum-valid, active treasury-verified destinations are published; administrator confirmation requires reconciled evidence | Human confirmation of official IBAN/category/account title and actual bank receipt |
| Stripe | Idempotent checkout, signature verification, amount/currency match, duplicate-event protection, partial/full refund accounting | Secret key, signing secret, merchant eligibility and HTTPS webhook registration |
| PayPal | Sandbox-default OAuth/order creation/capture, verified webhook signature through PayPal's verification endpoint, exact amount/currency reconciliation | Client ID/secret, webhook ID, supported merchant account/currency and webhook registration |
| PayFast / Kuickpay / Meezan | PayFast route deliberately returns 501; no unsigned event can credit a donation | Merchant contract, official signature/callback specification, credentials and sandbox acceptance tests; adapters remain unfinished |

PayPal returns support USD/GBP/CAD/EUR; AED/PKR must use a supported alternative. The prompt's universal gateway/currency list does not override provider/merchant restrictions. Pledges remain possible in all displayed currencies. Provider configuration flags are presence checks, not successful connectivity. PayPal refund/reversal/denial events are retained as `needs_reconciliation`; automated PayPal refund accounting is not claimed.

`/api/webhooks/payments/stripe` verifies raw-body signatures before its database transaction. `/api/webhooks/payments/paypal` uses fixed PayPal hosts for verification and then reconciles known order IDs. A checkout return alone does not confirm a gift. `/api/giving/status` exposes only non-PII status/amount via the original random request reference. Printable `/donations/[id]/receipt` acknowledgements require authenticated ownership or finance access. They are not automatically tax-exemption certificates.

## Lead CRM and WhatsApp outbox

`/api/webhooks/meta` implements verification-token challenge and HMAC signatures. Lead notifications create deduplicated secure-lookup jobs, not invented donor records. The worker retrieves fields only when explicitly run with `--read-leads` or `--send`. A form's explicitly mapped `META_CONSENT_FIELD` must indicate affirmative marketing consent before a welcome message is queued. Unknown consent requires review.

```sh
# No external requests or messages; missing configuration is recorded.
npm run integrations:dry-run
# Only after the relevant account/read access is authorized and configured:
node --env-file=.env.local --import tsx scripts/process-integrations.ts --read-leads
# Only with explicit authorization for the real recipients and approved templates:
node --env-file=.env.local --import tsx scripts/process-integrations.ts --send
```

Receipt jobs are automatically queued after a confirmed payment only when a phone and separate receipt opt-in are present. `/api/whatsapp/receipt` queues a verified, consented receipt; HTTP 202 means queued, never delivered. Marketing/welcome/retention/impact jobs re-check current consent, use approved templates and carry signed expiring unsubscribe links. An approved impact report URL must exist before queuing its broadcast. WhatsApp template parameter ordering is documented directly in `scripts/process-integrations.ts`; register matching templates before enabling a worker.

Provider acceptance records `submitted`; delivery/read callbacks separately record delivery. Timeouts and ambiguous submissions require reconciliation instead of blind retries. Rate-limited jobs have bounded retries. Crashed `processing` jobs require operator review. `scripts/prepare-retention.ts` previews consented inactive donors and `--queue` prepares deduplicated monthly jobs; it never sends. A monthly schedule and audience review are operational tasks; there is no silently enabled scheduler and no live message was sent during development.

The current receipt template sends contribution details. A4 acknowledgement PDFs and evidence-gated tax certificate PDFs are implemented at `/api/donations/[id]/pdf`. Certificates require an administrator, a confirmed unrefunded contribution, a named authorized signatory/statement, and current verified FBR/PCP/SHCC/ISO evidence. The issue record snapshots that evidence. Real institutional verification remains pending. Optional receipt document templates use fifteen-minute HMAC links (`APP_RECEIPT_SECRET`); impact document templates use approved public report URLs. These outbound templates have not been submitted to a live provider. Standard PDF text currently renders Latin characters; Unicode names remain intact in the database and HTML acknowledgement, but unsupported PDF glyphs are replaced. FBR/PCP/SHCC/ISO claims in reference material remain pending document verification/expiry review, not blanket software-certified claims.

TikTok campaign labels/CRM planning are available. Direct TikTok Ads lead/spend synchronization and automatic Meta spend import are not implemented; authenticated campaign spend and evidence can be recorded manually. Official app permissions, signature specifications and account binding are still required for these adapters. No website scraping is required for the supplied institutional evidence.

## Analytics and insights

Optional GA4/GTM load on `/donate` only after analytics consent. Events allowlist amounts/fund/currency/method and transaction references, never patient data or donor contacts. Calculator completion, donation intent, checkout start/cancel and verified Stripe-return completion have distinct events. Provider-return URLs containing capability/order references skip script loading. Configure consent-aware GTM tags and avoid duplicate GA4 tags. No analytics key is currently configured and no delivery to Google was verified. Server-side conversion reporting and a complete abandonment funnel remain future work.

Decision insights use full authorized database cohorts, not the workspace's latest 1,000 rows. Medicine estimates need at least ten patient-linked dispensations and state their observed-rate method. Retention uses consented donors and explicit 90/180-day review bands; CSR matches use consented interest tags. These are transparent operational rules, not validated trained churn models, regional forecasting or high-net-worth inference. No clinical/pharmacy proxy is represented as a confirmed diagnosis.
