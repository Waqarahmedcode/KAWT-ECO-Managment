import Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { createHash } from 'node:crypto';

export function verifyStripeEvent(raw:string,signature:string,apiKey:string,signingSecret:string){
 return new Stripe(apiKey).webhooks.constructEvent(raw,signature,signingSecret);
}

/** Caller supplies a verified event and a transaction-scoped server connection. */
export async function applyStripeEvent(db:PoolClient,event:Stripe.Event,raw:string){
 const hash=createHash('sha256').update(raw).digest('hex');
 await db.query("insert into public.webhook_events(provider,event_id,payload_sha256,status) values('stripe',$1,$2,'received') on conflict(provider,event_id) do nothing",[event.id,hash]);
 const stored=(await db.query("select * from public.webhook_events where provider='stripe' and event_id=$1 for update",[event.id])).rows[0];
 if(stored.payload_sha256!==hash)throw new Error('Event identifier reused with a different payload');
 if(stored.status==='processed')return {duplicate:true};
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
  const session=event.data.object as Stripe.Checkout.Session;
  if(session.payment_status==='paid'){
   if(!session.amount_total||!session.currency)throw new Error('Missing verified payment amount/currency');
   const updated=await db.query("update public.donations set status='confirmed',confirmed_at=now(),provider_payment_intent_id=$1 where provider='stripe' and provider_payment_id=$2 and status='pending' and amount_minor_units=$3 and currency=$4 returning id",[typeof session.payment_intent==='string'?session.payment_intent:null,session.id,session.amount_total,session.currency.toUpperCase()]);
   if(!updated.rowCount&&!(await db.query("select 1 from public.donations where provider='stripe' and provider_payment_id=$1 and status='confirmed' and amount_minor_units=$2 and currency=$3",[session.id,session.amount_total,session.currency.toUpperCase()])).rowCount)throw new Error('Payment does not match a pending donation');
  }
 }else if(event.type==='charge.refunded'){
  const charge=event.data.object as Stripe.Charge;
  const intent=typeof charge.payment_intent==='string'?charge.payment_intent:null;
  if(intent)await db.query("update public.donations set refunded_minor_units=$1,status=case when $1=amount_minor_units then 'refunded' else status end where provider='stripe' and provider_payment_intent_id=$2 and amount_minor_units=$3 and currency=$4 and $1<=amount_minor_units",[charge.amount_refunded,intent,charge.amount,charge.currency.toUpperCase()]);
 }
 await db.query("update public.webhook_events set status='processed',processed_at=now() where provider='stripe' and event_id=$1",[event.id]);
 return {duplicate:false};
}
