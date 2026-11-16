import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { sameOrigin } from '@/lib/actor-db';
const schema=z.object({donation_id:z.string().uuid()});
export const runtime='nodejs';
export async function POST(req:Request){try{sameOrigin(req);await requireRole(['admin']);const {donation_id}=schema.parse(await req.json());
 const db=getPool();const result=await db.query('select n.id,n.donor_id,n.status,n.currency,n.amount_minor_units,n.receipt_sent_at,d.phone,d.full_name,d.receipt_opt_in from public.donations n join public.donors d on d.id=n.donor_id where n.id=$1',[donation_id]);
 const record=result.rows[0];if(!record)return Response.json({error:'Donation not found'},{status:404});
 if(record.status!=='confirmed'||!record.receipt_opt_in||!record.phone)return Response.json({error:'Confirmed donation, verified phone and receipt opt-in are required'},{status:409});
 if(record.receipt_sent_at)return Response.json({error:'Receipt already dispatched'},{status:409});
 const job=await db.query("insert into public.integration_outbox(kind,donation_id,donor_id,dedupe_key) values('receipt',$1,$2,$3) on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id,status",[donation_id,record.donor_id,'receipt:'+donation_id]);
 return Response.json({status:'queued',job:job.rows[0]},{status:202});
 }catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
