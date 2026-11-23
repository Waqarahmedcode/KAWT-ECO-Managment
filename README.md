> **23 November 2026: lab/Medical Centre update live hai.** [Verified deployment, URLs aur owner setup](docs/LIVE-DEPLOYMENT-2026-11-23.md). Neeche purane checkpoint ki dates/status historical hain.

# KAWT shared web workspace

Current development checkpoint: **20 November 2026**. Next.js operations, private departmental entry and a public donor portal use Supabase PostgreSQL/Auth. [Current implementation, checks, remaining work and deployment steps](docs/LAB-IMPLEMENTATION-2026-11-20.md).

November 17 ka staging baseline https://kawt-eco-managment-preview.netlify.app/preview par hosted hai. Is source mein naye private Lab aur Medical Centre modules hain; un ka naya hosted deployment abhi nahin hua.

## Apne computer par run karein

1. Node 24, Docker aur Python 3 install karein; is folder mein `npm ci` chalayein.
2. `npm run db:local` local Supabase start/configure karta hai aur core/module migrations ka combined ignored workdir use karta hai. Original SQL/config files nahin badaltin. Local credentials `.env.local` aur `.local/accounts.json` mein rehte hain; ZIP/Git mein nahin.
3. `npm run dev -- --hostname 127.0.0.1 --port 3001` chalayein. Isi computer par `/preview`, `/login`, `/dashboard`, `/medical-centre`, `/lab/login`, `/lab` aur `/lab/reports` khol sakte hain.

`localhost` us machine ka address hai jahan server chal raha ho; cloud machine ka loopback user ke Windows computer ka address nahin.

## Data aur private access

Source seed sirf six documented historical aur six planned camps import karta hai. Missing patient-level details, new donations, WASH/capital projects aur business transactions invent nahin hote. Technical local Auth fixtures actual historical staff ya production accounts nahin.

Lab reports ki real files/source drafts private owner review package mein hain, is public source ZIP mein nahin. Administrator historical file import ko review/save karta hai; department account apne assigned lab mein direct entry/correction karta hai. Main workspace ka access alag hai. Monthly source se daily observations nahin banayi jatin; missing day unavailable rehta hai.

Routine checks: `npm run test:unit`, `npm run lint`, `npm run build`. Database/browser fixture tests sirf guarded disposable local targets par chalayein. Product/source-only database par synthetic test suites na chalayein.

## Hosting

Git repository root mein isi folder ka content rakhein. [Netlify instructions](docs/DEPLOY-NETLIFY.md): Node 24, Next.js runtime, build `npm run build:netlify`, publish `.next`. Source ZIP ko static drag-and-drop upload karna authentication/APIs deploy nahin karta. Private runtime/build variables secure hosting settings mein hon.

[Architecture](docs/ARCHITECTURE.md), [source review](docs/PROFILE-ARCHITECTURE-GAP-REVIEW.md), [requirements](docs/REQUIREMENTS.md), aur [current status](docs/CURRENT-EXECUTION-STATUS.md). Centre-wide finance/commission imports, standalone finance-app linkage aur advanced external integrations ka baqi scope current implementation report mein wazeh hai.
