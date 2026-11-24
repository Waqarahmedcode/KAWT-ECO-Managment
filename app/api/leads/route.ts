import { createHash } from 'node:crypto';
import { z } from 'zod';
import { leadInput, leadStages } from '@/lib/leads';
import { actorTransaction, sameOrigin } from '@/lib/actor-db';
import { onboardingBody, onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
const fields = 'l.id,l.full_name,l.email,l.phone,l.provider,l.campaign_ref,l.submitted_at,l.contact_status,l.marketing_consent,l.consent_basis,l.assigned_to,l.next_follow_up::text,l.linked_donor_id,l.notes,l.revision,exists(select 1 from public.donations d where d.donor_id=l.linked_donor_id and d.status=\'confirmed\') as verified_conversion';
export async function GET(request: Request) {
 try {
  const q = new URL(request.url).searchParams, stage = z.enum(['all', ...leadStages]).parse(q.get('stage') ?? 'all'), term = z.string().max(160).parse(q.get('search') ?? ''), page = z.coerce.number().int().min(0).max(100000).parse(q.get('page') ?? 0), overdue = q.get('overdue') === '1';
  const result = await actorTransaction(['admin'], async db => {
   const params = [stage,term,overdue], where = "where ($1='all' or l.contact_status=$1) and ($2='' or strpos(lower(coalesce(l.full_name,'')||' '||coalesce(l.email,'')||' '||coalesce(l.phone,'')),lower($2))>0) and (not $3 or (l.next_follow_up<(now() at time zone 'Asia/Karachi')::date and l.marketing_consent and l.contact_status not in ('converted','do_not_contact')))";
   const total = (await db.query('select count(*)::int n from public.donor_leads l '+where, params)).rows[0].n;
   const leads = (await db.query('select '+fields+' from public.donor_leads l '+where+' order by l.submitted_at desc,l.id limit 20 offset $4', [...params,page*20])).rows;
   const stages = (await db.query('select contact_status,count(*)::int count from public.donor_leads group by contact_status order by contact_status')).rows;
   const staff = (await db.query("select id,coalesce(display_name,email,'Administrator') as name from public.profiles where role='admin' order by id limit 500")).rows;
   const donors = (await db.query("select id,full_name from public.donors where exists(select 1 from public.donations d where d.donor_id=donors.id and d.status='confirmed') order by full_name nulls last,id limit 500")).rows;
   const history = q.get('id') ? (await db.query("select action,previous,current_value,changed_at from public.kawt_operations_audit where entity_kind='lead' and entity_key=$1 order by id desc limit 30",[z.uuid().parse(q.get('id'))])).rows : [];
   return { leads,total,page,stages,staff,donors,history };
  });
  return Response.json(result,{headers:onboardingHeaders});
 } catch(e) {return onboardingError(e);}
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const input=leadInput.parse(await onboardingBody(request));
  const result=await actorTransaction(['admin'],async db=>{
   await db.query("select pg_advisory_xact_lock(hashtext('kawt-lead:'||$1))",[input.id]);
   const current=(await db.query('select revision,creation_hash from public.donor_leads where id=$1 for update',[input.id])).rows[0];
   const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
   if (!input.revision&&current) {if(current.creation_hash!==hash)throw Object.assign(new Error('CONFLICT'),{code:'23505'});return {already_saved:true};}
   if(input.revision&&(!current||current.revision!==input.revision))throw Object.assign(new Error('CONFLICT'),{code:'23505'});
   const data=[input.full_name,input.email||null,input.phone||null,input.marketing_consent,input.consent_basis,input.contact_status,input.assigned_to,input.next_follow_up,input.linked_donor_id,input.notes,input.campaign_ref||null];
   if(input.revision)await db.query('update public.donor_leads set full_name=$1,email=$2,phone=$3,marketing_consent=$4,consent_basis=$5,contact_status=$6,assigned_to=$7,next_follow_up=$8,linked_donor_id=$9,notes=$10,campaign_ref=$11 where id=$12',[...data,input.id]);
   else await db.query('insert into public.donor_leads(full_name,email,phone,marketing_consent,consent_basis,contact_status,assigned_to,next_follow_up,linked_donor_id,notes,campaign_ref,id,provider,external_lead_id,creation_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::uuid,$13,$12::text,$14)',[...data,input.id,input.provider,hash]);
   return {saved:true};
  });return Response.json(result,{headers:onboardingHeaders});
 }catch(e){return onboardingError(e);}
}
