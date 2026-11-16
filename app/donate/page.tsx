import DonorPortal from '@/components/PublicGiving';
import { GivingAnalytics } from '@/components/GivingAnalytics';
export default function Donate(){return <><DonorPortal/><GivingAnalytics ga4={process.env.NEXT_PUBLIC_GA4_ID} gtm={process.env.NEXT_PUBLIC_GTM_ID}/></>}
