# KAWT live deployment — 23 November 2026

Verified update existing Netlify preview par publish ho chuka hai: **23 November 2026, 03:22 PM PKT**.

- Public source preview: https://kawt-eco-managment-preview.netlify.app/preview
- Staff signup/sign-in: https://kawt-eco-managment-preview.netlify.app/login
- Dedicated Lab sign-in: https://kawt-eco-managment-preview.netlify.app/lab/login
- Private entry: https://kawt-eco-managment-preview.netlify.app/lab
- Private reports: https://kawt-eco-managment-preview.netlify.app/lab/reports
- Private OPD/doctors/packages: https://kawt-eco-managment-preview.netlify.app/medical-centre

## Published version aur database

Deployed application commit `e0271ec57d01ce03dd3864e0c44a61435c37fd4c`; deployment `6b0413b8672ae9baf922809c`. Netlify production context aur `main` branch configuration use hui. Source GitHub par release branch se provider ko exact commit diya gaya; published site ID aur commit verify hue.

Cloud build ne core schema ko already initialized paya, phir six additive lab/Medical Centre migrations apply ki. Eight module tables create huin. Read-only backend check ne tamam required migration versions, table RLS aur private receipt bucket verify kiye. Schema upgrade ne koi live account ya business record create nahin kiya.

Runtime variables aur build guards Netlify ki existing production settings mein configured hain. Existing authorized database credential wahin reuse hua; credentials source, report, screenshot ya download artifact mein nahin rakhe gaye. Direct cloud-machine PostgreSQL route refuse hua tha, is liye guarded build Netlify par chala.

## Live checks

- `/preview`, `/lab/login` aur database-backed `/api/giving`: HTTP 200.
- `/lab`, `/lab/reports`, `/medical-centre`: unsigned request dedicated sign-in par redirect.
- Lab aur Medical Centre APIs: unsigned request HTTP 401.
- Supabase REST par lab reports aur doctors tables recognize huin aur anonymous reads deny huay.
- Actual owner/staff ke credentials use nahin kiye gaye; real staff sign-in aur entry acceptance abhi account holder ke saath honi hai.

## Owner ka agla step

Build ka first-admin result `account_required` tha. Configured owner email se `/login` par Create account aur email confirmation complete karein. Existing guarded bootstrap sirf wahi verified configured identity ko eligible banata hai. Is deployment ne account, password ya email message generate nahin kiya.

July source report aur doctor/package drafts private review bundle mein hain; unhein is deployment ne automatically hosted business records mein import nahin kiya. Admin signup ke baad historical import review/save karein aur verified dedicated lab account ko scoped entry access dein. Source dates, rates aur OCR corrections review ke baghair auto-apply nahin hotin.

Yeh lab/reporting aur Medical Centre configuration release hai. Centre-wide finance, commission/panel/MOU analysis, standalone finance-app link aur advanced external integrations [implementation scope](LAB-IMPLEMENTATION-2026-11-20.md) mein abhi baqi hain.

November 20 ke review/checkpoint documents historical state record karte hain; un ke not-deployed statements ke liye yeh November 23 record current status hai.
