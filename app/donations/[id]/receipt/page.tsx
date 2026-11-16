import { notFound,redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { actorTransaction } from '@/lib/actor-db';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/workspace-types';
import { PrintAction } from '@/components/workspace/PrintAction';
export const dynamic='force-dynamic';
export default async function DonationReceipt({params}:{params:Promise<{id:string}>}){
 const access=await requireRole(['admin','donor']).catch(()=>null);if(!access)redirect('/login');
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))notFound();
 const record=await actorTransaction(['admin','donor'],async db=>(await db.query('select n.id,n.status,n.fund,n.currency,n.amount_minor_units,n.refunded_minor_units,n.confirmed_at,n.provider,d.full_name from public.donations n join public.donors d on d.id=n.donor_id where n.id=$1',[id])).rows[0]);
 if(!record||!['confirmed','refunded'].includes(record.status))notFound();
 return <main className="mx-auto max-w-3xl p-6 lg:p-12"><div className="no-print mb-8 flex items-center justify-between"><Link href="/dashboard?section=donors" className="text-sm underline">My workspace</Link><div className="flex gap-3"><a className="rounded-lg border px-4 py-3 text-sm" href={`/api/donations/${id}/pdf`}>Download PDF</a><PrintAction/></div></div><article className="border-t-8 border-[#0B5D3B] bg-white p-8"><Image src="/brand/kawt-logo.png" width={70} height={70} alt="KAWT"/><p className="mt-5 text-xs uppercase tracking-widest text-[#9b7b2b]">Khidmat-e-Alam Welfare Trust</p><h1 className="mt-3 font-serif text-3xl">Donation acknowledgement</h1><dl className="my-8 grid gap-6 sm:grid-cols-2">{[['Donor',record.full_name??'Supporter'],['Reference',record.id],['Fund',record.fund],['Confirmed amount',money(Number(record.amount_minor_units),record.currency)],['Received on',new Date(record.confirmed_at).toLocaleDateString('en-GB',{timeZone:'Asia/Karachi'})],['Payment channel',record.provider],['Status',record.status],['Refunded amount',money(Number(record.refunded_minor_units),record.currency)]].map(([label,value])=><div key={label}><dt className="text-xs uppercase text-[#6b8172]">{label}</dt><dd className="mt-2 break-words text-sm font-semibold">{value}</dd></div>)}</dl><p className="border-t pt-6 text-sm text-[#6b8172]">Thank you for supporting community care. This records a verified contribution. Any tax certificate is issued separately by authorized finance staff under current eligibility.</p><p className="mt-5 text-xs text-[#6b8172]">Keep this acknowledgement private. Public reports contain aggregate impact figures.</p></article></main>;
}
