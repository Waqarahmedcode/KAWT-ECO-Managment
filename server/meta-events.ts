import { createHmac,timingSafeEqual,createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';

export function validMetaSignature(raw:string,signature:string,secret:string){
 const expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 return signature.length===expected.length&&timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
const payloadSchema=z.object({entry:z.array(z.object({changes:z.array(z.object({field:z.string().optional(),value:z.object({leadgen_id:z.string().regex(/^\d{1,40}$/).optional(),ad_id:z.string().max(100).optional(),form_id:z.string().max(100).optional(),statuses:z.array(z.object({id:z.string().max(300),status:z.enum(['sent','delivered','read','failed']),timestamp:z.string().max(40).optional(),errors:z.array(z.object({code:z.number()})).optional()})).optional()})})).default([])})).default([])});

export async function applyMetaEvent(db:PoolClient,payload:unknown,raw:string){
 const data=payloadSchema.parse(payload),hash=createHash('sha256').update(raw).digest('hex');
 for(const entry of data.entry)for(const change of entry.changes){
  if(change.field==='leadgen'&&change.value.leadgen_id){
   const id=change.value.leadgen_id;
   await db.query("insert into public.webhook_events(provider,event_id,payload_sha256,status) values('meta',$1,$2,'processed') on conflict(provider,event_id) do nothing",[id,hash]);
   const lead=(await db.query("insert into public.donor_leads(provider,external_lead_id,campaign_ref,contact_status) values('meta',$1,$2,'needs_secure_lookup') on conflict(provider,external_lead_id) do update set external_lead_id=excluded.external_lead_id returning id",[id,change.value.ad_id??null])).rows[0];
   await db.query("insert into public.integration_outbox(kind,lead_id,dedupe_key) values('meta_lead_lookup',$1,$2) on conflict(dedupe_key) do nothing",[lead.id,'meta-lead:'+id]);
  }
  for(const status of change.value.statuses??[]){
   if(status.status==='delivered'||status.status==='read'){
    await db.query('update public.integration_outbox set delivered_at=coalesce(delivered_at,now()),updated_at=now() where provider_reference=$1',[status.id]);
    await db.query('update public.donations set receipt_delivered_at=coalesce(receipt_delivered_at,now()) where id in (select donation_id from public.integration_outbox where provider_reference=$1)',[status.id]);
   }else if(status.status==='failed')await db.query("update public.integration_outbox set status='failed',failure_code=$2,last_error='Provider reported delivery failure',updated_at=now() where provider_reference=$1",[status.id,String(status.errors?.[0]?.code??'unknown')]);
  }
 }
}
