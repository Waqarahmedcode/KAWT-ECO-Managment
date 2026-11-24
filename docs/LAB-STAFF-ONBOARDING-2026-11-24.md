# Lab staff onboarding and access requests

Staff can create a dedicated account from `/lab/login`, confirm their email and request department access at `/lab/access`. Signup alone grants no Lab permissions. The administrator sees pending requests in the main dashboard badge and the **Staff access / requests** link, assigns the laboratory and either entry/correction or aggregate-view access, and approves or rejects with a reason.

The same screen lists existing assignments. Administrators can change the assigned laboratory/access, disable or re-enable an eligible verified account, or grant access manually by verified email. Changes take effect on the next private request. Historical entries are retained. An account with a different existing staff role is never silently downgraded or promoted.

## Data and authorization

- Migration `202611240020` adds two RLS-protected tables and a revision column on existing Lab assignments. It does not create accounts, memberships or business records.
- Each requester sees only their own requests. One pending request per account, bounded submissions, immutable decisions and administrator-only audit history are enforced in PostgreSQL.
- Approval updates the request and actual Lab assignment atomically. Stale decisions/assignment changes cannot overwrite a newer revision through the interface/API.
- Verified identity, laboratory scope, operator/viewer permissions and revocation are enforced server-side. Unassigned or disabled accounts return to the access-request screen.
- Notifications are inside the app. No outgoing email/invitation service was added; email confirmation uses the existing Auth provider.

## Validation

54 unit tests, lint, TypeScript and optimized production build passed. Disposable local SQL/API/browser tests covered concurrent requests, self-approval denial, isolation, approval/rejection, changed identity, stale revisions, immediate revocation, immutable audit, staff signup UI, dashboard notification and mobile layout. Existing local Auth fixtures were reused; synthetic signup responses were mocked, so no real staff account or message was created. Live email delivery and a real department's first signup still require operational acceptance.

Evidence: `LAB-ONBOARDING-VALIDATION-2026-11-24.json`. Publication and cloud migration evidence is recorded separately after deployment.

## Still pending

Actual shift start times, approved reference rates/effective dates, private July 2026 aggregate import, eight package drafts and the separate OPD/Urgent Care patient workflows remain in the backlog. Automatic reception billing and organization-wide reset are outside this release.
