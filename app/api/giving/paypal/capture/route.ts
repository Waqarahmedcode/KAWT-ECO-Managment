import { z } from 'zod';
import { getPool } from '@/lib/db';
import { sameOrigin,workspaceError } from '@/lib/actor-db';
import { paypalBase,paypalToken } from '@/lib/payments';
export async function POST(request:Request){
 try{
  sameOrigin(request);
  const input=z.object({order_id:z.string().regex(/^[A-Z0-9]{5,40}$/),donation_id:z.string().uuid()}).parse(await request.json());
  const db=getPool();const donation=(await db.query("select id,amount_minor_units,currency,status from public.donations where id=$1 and provider='paypal' and provider_payment_id=$2",[input.donation_id,input.order_id])).rows[0];
  if(!donation)return Response.json({error:'Unknown payment reference'},{status:404});
  if(donation.status==='confirmed')return Response.json({confirmed:true,duplicate:true});
  const token=await paypalToken();
  const capture=await fetch(paypalBase()+`/v2/checkout/orders/${encodeURIComponent(input.order_id)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':'capture-'+input.donation_id},signal:AbortSignal.timeout(20000)});
  if(!capture.ok)return Response.json({error:'PayPal has not confirmed this capture'},{status:409});
  const value=await capture.json() as {status:string;purchase_units?:{payments?:{captures?:{id:string;status:string;amount:{value:string;currency_code:string}}[]}}[]};
  const payment=value.purchase_units?.[0]?.payments?.captures?.[0];
  if(value.status!=='COMPLETED'||payment?.status!=='COMPLETED'||Math.round(Number(payment.amount.value)*100)!==Number(donation.amount_minor_units)||payment.amount.currency_code!==donation.currency)return Response.json({error:'Payment status, amount or currency does not match'},{status:409});
  await db.query("update public.donations set status='confirmed',confirmed_at=now(),provider_payment_intent_id=$1 where id=$2 and status='pending'",[payment.id,input.donation_id]);
  return Response.json({confirmed:true});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Invalid capture reference'},{status:400});return workspaceError(error)}
}
