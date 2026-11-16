import { z } from 'zod';
import { getPool } from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
 const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('reference'));
 if(!id.success)return Response.json({error:'Invalid payment reference'},{status:400});
 // The browser-generated 128-bit request ID is a status capability. Never expose PII.
 const record=(await getPool().query('select id,status,currency,amount_minor_units,fund,provider from public.donations where request_id=$1',[id.data])).rows[0];
 if(!record)return Response.json({error:'Payment reference not found'},{status:404});
 return Response.json({donation_id:record.id,status:record.status,currency:record.currency,amount_minor_units:Number(record.amount_minor_units),fund:record.fund,provider:record.provider},{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 }catch{return Response.json({error:'Payment verification is temporarily unavailable'},{status:503})}
}
