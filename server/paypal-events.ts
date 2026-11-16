import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';

export const paypalEventSchema=z.object({id:z.string().max(200),event_type:z.string().max(100),resource:z.object({id:z.string().max(200),status:z.string().optional(),amount:z.object({value:z.string().regex(/^\d+\.\d{2}$/),currency_code:z.string().regex(/^[A-Z]{3}$/)}).optional(),supplementary_data:z.object({related_ids:z.object({order_id:z.string().optional()})}).optional()}).passthrough()});
export async function applyPayPalEvent(db:PoolClient,event:z.infer<typeof paypalEventSchema>,raw:string){
 const hash=createHash('sha256').update(raw).digest('hex');
 await db.query("insert into public.webhook_events(provider,event_id,payload_sha256) values('paypal',$1,$2) on conflict(provider,event_id) do nothing",[event.id,hash]);
 const saved=(await db.query("select payload_sha256,status from public.webhook_events where provider='paypal' and event_id=$1 for update",[event.id])).rows[0];
 if(saved.payload_sha256!==hash)throw new Error('Event ID has conflicting content');
 if(saved.status!=='received')return {duplicate:true,status:saved.status};
 let status='ignored';
 if(event.event_type==='PAYMENT.CAPTURE.COMPLETED'){
  const resource=event.resource,order=resource.supplementary_data?.related_ids.order_id;
  if(!order||resource.status!=='COMPLETED'||!resource.amount)throw new Error('Verified capture is incomplete');
  const amount=Number(resource.amount.value.replace('.',''));
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Invalid capture amount');
  const donation=(await db.query("select id,status,amount_minor_units,currency from public.donations where provider='paypal' and provider_payment_id=$1 for update",[order])).rows[0];
  if(!donation||Number(donation.amount_minor_units)!==amount||donation.currency!==resource.amount.currency_code)throw new Error('Capture does not match a donation');
  if(donation.status==='pending')await db.query("update public.donations set status='confirmed',confirmed_at=now(),provider_payment_intent_id=$1 where id=$2",[resource.id,donation.id]);
  else if(!['confirmed','refunded'].includes(donation.status))throw new Error('Donation cannot be confirmed in its current state');
  status='processed';
 }else if(/REFUND|REVERSED|DENIED/.test(event.event_type))status='needs_reconciliation';
 await db.query("update public.webhook_events set status=$1,processed_at=now() where provider='paypal' and event_id=$2",[status,event.id]);
 return {duplicate:false,status};
}
