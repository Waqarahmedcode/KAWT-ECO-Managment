import { notFound,redirect } from 'next/navigation';
import { actorTransaction } from '@/lib/actor-db';
import { requireRole } from '@/lib/auth';
import { ReferralSlip } from '@/components/workspace/ReferralSlip';
import QRCode from 'qrcode';
import { siteUrl } from '@/lib/payments';
export const dynamic='force-dynamic';
export default async function ReferralPage({params}:{params:Promise<{code:string}>}){
 const access=await requireRole(['admin','camp_manager','doctor']).catch(()=>null);if(!access)redirect('/login');
 const {code}=await params;if(!/^[a-f0-9]{24}$/.test(code))notFound();
 const record=await actorTransaction(['admin','camp_manager','doctor'],async db=>(await db.query('select r.referral_code,r.camp_id,r.service,r.status,r.issued_at,r.completed_at,p.uid,p.display_name,p.age_years,p.gender from public.centre_referrals r join public.camp_patients p on p.id=r.patient_id where r.referral_code=$1',[code])).rows[0]);
 if(!record)notFound();
 const qr=await QRCode.toDataURL(`${siteUrl()}/referrals/${code}`,{errorCorrectionLevel:'M',width:180,margin:1});
 return <ReferralSlip record={JSON.parse(JSON.stringify(record))} qr={qr}/>;
}
