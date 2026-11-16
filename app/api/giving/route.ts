import { z } from 'zod';
import { createHash } from 'node:crypto';
import { getPool,isConfigured } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { sameOrigin } from '@/lib/actor-db';
import { currencies } from '@/lib/finance';
import { createCheckout } from '@/lib/payments';
import type { PoolClient } from 'pg';
export const dynamic='force-dynamic';

export async function GET(){
 if(!isConfigured())return Response.json({error:'The donation database is not configured yet'},{status:503});
 try{
  const db=getPool();
  const [projects,camps,banks,reports]=await Promise.all([
   db.query("select id,phase,title,description,target_paisa,raised_paisa,status from public.capital_projects where status<>'cancelled' order by phase"),
   db.query("select id,title,area,camp_date from public.camps where status in ('approved','in_progress') order by camp_date nulls last"),
   db.query('select id,bank_name,fund,iban,account_title from public.bank_routes where active and verified_at is not null order by bank_name'),
   db.query('select id,title,public_url,approved_at from public.published_reports order by approved_at desc limit 12'),
  ]);
  return Response.json({projects:projects.rows,camps:camps.rows,banks:banks.rows,reports:reports.rows,capabilities:{stripe:Boolean(process.env.STRIPE_SECRET_KEY),paypal:Boolean(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET),bankTransfer:banks.rowCount!==0}},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Donation services are temporarily unavailable'},{status:503})}
}

const schema=z.object({
 request_id:z.string().uuid(),full_name:z.string().trim().min(2).max(140),email:z.string().email().max(254),phone:z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
 country:z.string().trim().min(2).max(80),fund:z.enum(['ZAKAT','GENERAL']),currency:z.enum(currencies),amount_minor_units:z.coerce.number().int().min(100).max(1e12),
 provider:z.enum(['pledge','bank_transfer','stripe','paypal']),camp_id:z.string().regex(/^FMC-\d{2,3}$/).optional(),project_id:z.string().uuid().optional(),bank_route_id:z.string().uuid().optional(),campaign_id:z.string().uuid().optional(),
 tier:z.enum(['custom','single_camp','dual_camp','five_camps','half_campaign','full_campaign','capital_equipment']),dedication:z.string().trim().max(250).optional(),
 marketing_consent:z.boolean(),receipt_opt_in:z.boolean(),privacy_consent:z.literal(true),
 attribution:z.object({source:z.string().max(100).optional(),medium:z.string().max(100).optional(),campaign:z.string().max(100).optional()}).optional(),
}).refine(v=>v.fund!=='ZAKAT'||!v.project_id,'Capital expansion requires General funds').refine(v=>!v.receipt_opt_in||Boolean(v.phone),'A phone number is required for WhatsApp receipts');

export async function POST(request:Request){
 let client:PoolClient|undefined;
 try{
  sameOrigin(request);
  if(!isConfigured())return Response.json({error:'The donation database is not configured yet'},{status:503});
  const input=schema.parse(await request.json());
  const analytics={currency:input.currency,value:input.amount_minor_units/100,fund:input.fund,method:input.provider};
  if(input.provider==='stripe'&&!process.env.STRIPE_SECRET_KEY)return Response.json({error:'Stripe is not connected. You can save a sponsorship pledge instead.'},{status:503});
  if(input.provider==='paypal'&&!(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET))return Response.json({error:'PayPal is not connected. You can save a sponsorship pledge instead.'},{status:503});
  if(input.provider==='paypal'&&!['USD','GBP','CAD','EUR'].includes(input.currency))return Response.json({error:'Choose USD, GBP, CAD or EUR for PayPal'},{status:400});
  client=await getPool().connect();await client.query('BEGIN');
  const fingerprint=createHash('sha256').update((request.headers.get('x-forwarded-for')?.split(',')[0]??'local')+':'+(process.env.APP_RATE_LIMIT_SALT??'kawt-local')).digest('hex');
  const limit=await client.query("insert into public.public_request_limits(fingerprint,requests) values($1,1) on conflict(fingerprint) do update set requests=case when public_request_limits.window_start<now()-interval '1 hour' then 1 else public_request_limits.requests+1 end,window_start=case when public_request_limits.window_start<now()-interval '1 hour' then now() else public_request_limits.window_start end returning requests",[fingerprint]);
  if(limit.rows[0].requests>30){await client.query('COMMIT');return Response.json({error:'Too many donation requests. Please try again later.'},{status:429,headers:{'Retry-After':'3600'}})}
  const prior=(await client.query('select n.id,n.provider,n.provider_payment_id,n.checkout_url,n.status,n.amount_minor_units,n.currency,n.fund,d.email from public.donations n join public.donors d on d.id=n.donor_id where n.request_id=$1',[input.request_id])).rows[0];
  if(prior){
   if(Number(prior.amount_minor_units)!==input.amount_minor_units||prior.fund!==input.fund||prior.currency!==input.currency||prior.provider!==input.provider||prior.email.toLowerCase()!==input.email.toLowerCase()){await client.query('ROLLBACK');return Response.json({error:'This request reference already belongs to a different contribution. Start a new contribution.'},{status:409})}
   await client.query('COMMIT');
   if(!prior.checkout_url&&prior.status==='pending'&&(prior.provider==='stripe'||prior.provider==='paypal')){
    const checkout=await createCheckout({id:prior.id,requestId:input.request_id,amount:input.amount_minor_units,currency:input.currency,fund:input.fund,email:input.email,provider:prior.provider});
    await client.query('update public.donations set provider_payment_id=$1,checkout_url=$2 where id=$3',[checkout.id,checkout.url,prior.id]);prior.checkout_url=checkout.url;
   }
   return Response.json({donation_id:prior.id,status:prior.status,checkout_url:prior.checkout_url,replayed:true,analytics})
  }
  if(input.camp_id&&!(await client.query("select 1 from public.camps where id=$1 and status in ('approved','in_progress')",[input.camp_id])).rowCount)throw new Error('Choose an approved camp');
  if(input.project_id&&!(await client.query('select 1 from public.capital_projects where id=$1',[input.project_id])).rowCount)throw new Error('Choose an existing project');
  if(input.provider==='bank_transfer'&&(!input.bank_route_id||!(await client.query('select 1 from public.bank_routes where id=$1 and active and verified_at is not null and fund=$2',[input.bank_route_id,input.fund])).rowCount))throw new Error('Choose an active treasury-verified bank route for this fund');
  let authId:string|null=null;
  const supabase=await getSupabase();const {data:{user}}=await supabase.auth.getUser();
  if(user?.email?.toLowerCase()===input.email.toLowerCase())authId=user.id;
  const donor=(await client.query('insert into public.donors(auth_user_id,full_name,email,phone,country,marketing_consent,consent_at,receipt_opt_in) values($1,$2,$3,$4,$5,$6,now(),$7) returning id',[authId,input.full_name,input.email,input.phone??null,input.country,input.marketing_consent,input.receipt_opt_in])).rows[0];
  const donation=(await client.query('insert into public.donations(donor_id,camp_id,capital_project_id,fund,currency,amount_minor_units,provider,request_id,bank_route_id,campaign_id,attribution) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,status',[donor.id,input.camp_id??null,input.project_id??null,input.fund,input.currency,input.amount_minor_units,input.provider,input.request_id,input.bank_route_id??null,input.campaign_id??null,JSON.stringify(input.attribution??{})])).rows[0];
  await client.query('insert into public.sponsorships(donor_id,camp_id,project_id,tier,amount_minor_units,currency,dedication) values($1,$2,$3,$4,$5,$6,$7)',[donor.id,input.camp_id??null,input.project_id??null,input.tier,input.amount_minor_units,input.currency,input.dedication??null]);
  await client.query('COMMIT');
  if(input.provider==='stripe'||input.provider==='paypal'){
   const checkout=await createCheckout({id:donation.id,requestId:input.request_id,amount:input.amount_minor_units,currency:input.currency,fund:input.fund,email:input.email,provider:input.provider});
   await client.query('update public.donations set provider_payment_id=$1,checkout_url=$2 where id=$3',[checkout.id,checkout.url,donation.id]);
   return Response.json({donation_id:donation.id,status:'pending',checkout_url:checkout.url,analytics},{status:201});
  }
  return Response.json({donation_id:donation.id,status:'pending',analytics,message:input.provider==='pledge'?'Your sponsorship pledge is recorded. No payment has been collected.':'Your donation intent is recorded. Finance will confirm it after the transfer is reconciled.'},{status:201});
 }catch(error){
  if(client)await client.query('ROLLBACK').catch(()=>{});
  if(error instanceof z.ZodError)return Response.json({error:error.flatten()},{status:400});
  if(error instanceof Error&&['Choose an approved camp','Choose an existing project','Choose an active treasury-verified bank route for this fund'].includes(error.message))return Response.json({error:error.message},{status:400});
  console.error('Donation intent failed');return Response.json({error:'The donation could not be completed. No payment success has been recorded; contact finance before retrying a provider payment.'},{status:503});
 }finally{client?.release()}
}
