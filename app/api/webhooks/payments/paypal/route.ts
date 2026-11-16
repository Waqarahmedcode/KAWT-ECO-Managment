import { getPool } from '@/lib/db';
import { paypalBase,paypalToken } from '@/lib/payments';
import { applyPayPalEvent,paypalEventSchema } from '@/server/paypal-events';
export const runtime='nodejs';
export async function POST(request:Request){
 const webhookId=process.env.PAYPAL_WEBHOOK_ID;
 if(!webhookId||!process.env.PAYPAL_CLIENT_ID||!process.env.PAYPAL_CLIENT_SECRET)return new Response('PayPal webhook is not configured',{status:503});
 const raw=await request.text();if(raw.length>1048576)return new Response('Payload too large',{status:413});
 let payload:unknown;try{payload=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
 const fields=['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time'];
 if(fields.some(field=>!request.headers.get('paypal-'+field)))return new Response('Missing PayPal signature headers',{status:400});
 try{
  const token=await paypalToken();
  const response=await fetch(paypalBase()+'/v1/notifications/verify-webhook-signature',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({auth_algo:request.headers.get('paypal-auth-algo'),cert_url:request.headers.get('paypal-cert-url'),transmission_id:request.headers.get('paypal-transmission-id'),transmission_sig:request.headers.get('paypal-transmission-sig'),transmission_time:request.headers.get('paypal-transmission-time'),webhook_id:webhookId,webhook_event:payload}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)return new Response('Verification service unavailable; retry later',{status:503});
  if((await response.json()).verification_status!=='SUCCESS')return new Response('Signature verification failed',{status:400});
  const event=paypalEventSchema.safeParse(payload);if(!event.success)return new Response('Unsupported event payload',{status:400});
  const db=await getPool().connect();
  try{await db.query('BEGIN');const result=await applyPayPalEvent(db,event.data,raw);await db.query('COMMIT');return Response.json({received:true,...result})}
  catch{await db.query('ROLLBACK');return Response.json({error:'Verified payment needs reconciliation; retry is safe'},{status:409})}
  finally{db.release()}
 }catch{return new Response('PayPal verification unavailable',{status:503})}
}
