import { getPool } from '@/lib/db';
import { verifyStripeEvent,applyStripeEvent } from '@/server/stripe-events';
export const runtime='nodejs';
export async function POST(request:Request){
 const key=process.env.STRIPE_SECRET_KEY,secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!key||!secret)return new Response('Stripe not configured',{status:503});
 const signature=request.headers.get('stripe-signature');if(!signature)return new Response('Missing signature',{status:400});
 const raw=await request.text();if(raw.length>1048576)return new Response('Payload too large',{status:413});
 let event;try{event=verifyStripeEvent(raw,signature,key,secret)}catch{return new Response('Signature verification failed',{status:400})}
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');const result=await applyStripeEvent(client,event,raw);await client.query('COMMIT');
  return Response.json({received:true,...result});
 }catch{await client.query('ROLLBACK');return Response.json({error:'Verified event could not be reconciled; retry is safe'},{status:409})}
 finally{client.release()}
}
