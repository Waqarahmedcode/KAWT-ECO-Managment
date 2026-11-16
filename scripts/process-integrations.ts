import { Client } from 'pg';
import { documentToken } from '../server/document-access';
import { DeliveryError,sendWhatsApp,unsubscribeToken } from '../server/communications';

async function main(){
 const database=process.env.DATABASE_URL;if(!database)throw new Error('DATABASE_URL is required');
 const send=process.argv.includes('--send'),readLeads=send||process.argv.includes('--read-leads');
 const db=new Client({connectionString:database});await db.connect();
 try{
  const candidates=await db.query("select id,kind from public.integration_outbox where status in ('queued','needs_configuration') and (next_attempt_at is null or next_attempt_at<=now()) order by created_at limit 20");
  for(const candidate of candidates.rows){
   const config=process.env;
   const required=candidate.kind==='meta_lead_lookup'?['META_PAGE_ACCESS_TOKEN','META_GRAPH_VERSION']:['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','META_GRAPH_VERSION'];
   const templateKey=candidate.kind==='receipt'?(config.WHATSAPP_RECEIPT_DOCUMENT_TEMPLATE?'WHATSAPP_RECEIPT_DOCUMENT_TEMPLATE':'WHATSAPP_RECEIPT_TEMPLATE'):candidate.kind==='impact_report'?'WHATSAPP_IMPACT_TEMPLATE':candidate.kind==='welcome'?'WHATSAPP_WELCOME_TEMPLATE':'WHATSAPP_RETENTION_TEMPLATE';
   if(candidate.kind!=='meta_lead_lookup')required.push(templateKey);
   if(candidate.kind==='receipt'&&config.WHATSAPP_RECEIPT_DOCUMENT_TEMPLATE)required.push('APP_RECEIPT_SECRET','NEXT_PUBLIC_SITE_URL');
   if(candidate.kind!=='receipt'&&candidate.kind!=='meta_lead_lookup')required.push('APP_UNSUBSCRIBE_SECRET','NEXT_PUBLIC_SITE_URL');
   const missing=required.filter(name=>!config[name]);
   if(missing.length){await db.query("update public.integration_outbox set status='needs_configuration',last_error=$2,updated_at=now() where id=$1",[candidate.id,'Missing runtime bindings: '+missing.join(', ')]);console.log(candidate.kind+': configuration pending ('+missing.join(', ')+')');continue}
   if(candidate.kind==='meta_lead_lookup'?!readLeads:!send){console.log(candidate.kind+': ready for authorized processing; dry run performed no external request');continue}
   await db.query('BEGIN');
   const job=(await db.query("select * from public.integration_outbox where id=$1 and status in ('queued','needs_configuration') for update skip locked",[candidate.id])).rows[0];
   if(!job){await db.query('ROLLBACK');continue}
   await db.query("update public.integration_outbox set status='processing',attempts=attempts+1,updated_at=now() where id=$1",[job.id]);await db.query('COMMIT');
   try{
    if(job.kind==='meta_lead_lookup'){
     if(!/^v\d{1,3}\.\d{1,2}$/.test(config.META_GRAPH_VERSION!))throw new DeliveryError('Configure META_GRAPH_VERSION','configuration');
     const lead=(await db.query('select * from public.donor_leads where id=$1',[job.lead_id])).rows[0];if(!lead)throw new DeliveryError('Lead no longer exists','missing_record');
     const response=await fetch(`https://graph.facebook.com/${config.META_GRAPH_VERSION}/${encodeURIComponent(lead.external_lead_id)}?fields=field_data`,{headers:{Authorization:`Bearer ${config.META_PAGE_ACCESS_TOKEN}`},signal:AbortSignal.timeout(20000)});
     if(!response.ok)throw new DeliveryError('Lead lookup rejected (HTTP '+response.status+')',String(response.status));
     const value=await response.json() as {field_data?:{name:string;values:string[]}[]};
     const fields=new Map((value.field_data??[]).map(field=>[field.name,field.values[0]]));
     const consent=Boolean(config.META_CONSENT_FIELD&&['true','yes','1'].includes((fields.get(config.META_CONSENT_FIELD)??'').toLowerCase()));
     const phone=fields.get('phone_number')?.replace(/[\s()-]/g,'');
     await db.query('BEGIN');
     await db.query('update public.donor_leads set full_name=$2,email=$3,phone=$4,marketing_consent=$5,consent_basis=$6,contact_status=$7 where id=$1',[lead.id,fields.get('full_name')??null,fields.get('email')??null,phone??null,consent,'Meta explicit consent field: '+(config.META_CONSENT_FIELD??'not configured'),consent?'new':'review_consent']);
     if(consent&&phone&&/^\+[1-9]\d{6,14}$/.test(phone)){
      const donor=(await db.query('insert into public.donors(full_name,email,phone,marketing_consent,consent_at) values($1,$2,$3,true,now()) returning id',[fields.get('full_name')??null,fields.get('email')??null,phone])).rows[0];
      await db.query("insert into public.integration_outbox(kind,donor_id,dedupe_key) values('welcome',$1,$2) on conflict(dedupe_key) do nothing",[donor.id,'welcome:meta:'+lead.external_lead_id]);
     }
     await db.query("update public.integration_outbox set status='submitted',updated_at=now(),last_error=null where id=$1",[job.id]);await db.query('COMMIT');
     console.log('meta_lead_lookup: completed; outbound welcome requires consent and a separate message job');continue;
    }
    const donor=(await db.query('select * from public.donors where id=$1',[job.donor_id])).rows[0];
    if(!donor?.phone||(job.kind==='receipt'?!donor.receipt_opt_in:!donor.marketing_consent))throw new DeliveryError('Current recipient consent is not sufficient','consent');
    const parameters=[String(donor.full_name??'Supporter')];let document:{url:string;filename:string}|undefined;
    if(job.kind==='receipt'){
     const donation=(await db.query("select * from public.donations where id=$1 and status='confirmed'",[job.donation_id])).rows[0];
     if(!donation)throw new DeliveryError('Donation is not currently confirmed','payment_status');
     parameters.push(`${donation.currency} ${(Number(donation.amount_minor_units)/100).toFixed(2)}`,donation.fund,donation.id);
     if(config.WHATSAPP_RECEIPT_DOCUMENT_TEMPLATE){const origin=new URL(config.NEXT_PUBLIC_SITE_URL!);if(origin.protocol!=='https:')throw new DeliveryError('Receipt document links require HTTPS','configuration');const certificate=(await db.query('select 1 from public.donation_certificates where donation_id=$1',[donation.id])).rowCount&&Number(donation.refunded_minor_units)===0;document={url:`${origin.origin}/api/donations/${donation.id}/pdf?token=${documentToken(donation.id,config.APP_RECEIPT_SECRET!)}${certificate?'&certificate=true':''}`,filename:certificate?'KAWT-tax-certificate.pdf':'KAWT-donation-receipt.pdf'}}
    }else{
     const origin=new URL(config.NEXT_PUBLIC_SITE_URL!);if(origin.protocol!=='https:')throw new DeliveryError('Live marketing links require an HTTPS site URL','configuration');
     if(job.kind==='impact_report'){
      const report=(await db.query('select public_url from public.published_reports where id=$1',[job.report_id])).rows[0];if(!report)throw new DeliveryError('An approved impact report is required','report');parameters.push(report.public_url);if(config.WHATSAPP_IMPACT_DOCUMENT_TEMPLATE)document={url:report.public_url,filename:'KAWT-impact-report.pdf'};
     }
     parameters.push(`${origin.origin}/unsubscribe?token=${unsubscribeToken(donor.id,config.APP_UNSUBSCRIBE_SECRET!)}`);
    }
    const reference=await sendWhatsApp({token:config.WHATSAPP_ACCESS_TOKEN!,phoneId:config.WHATSAPP_PHONE_NUMBER_ID!,version:config.META_GRAPH_VERSION!,template:job.kind==='impact_report'&&config.WHATSAPP_IMPACT_DOCUMENT_TEMPLATE?config.WHATSAPP_IMPACT_DOCUMENT_TEMPLATE:config[templateKey]!,language:config.WHATSAPP_TEMPLATE_LANGUAGE??'en_US',to:donor.phone,parameters,document});
    await db.query('BEGIN');
    await db.query("update public.integration_outbox set status='submitted',provider_reference=$2,last_error=null,updated_at=now() where id=$1",[job.id,reference]);
    if(job.kind==='receipt')await db.query('update public.donations set receipt_sent_at=now() where id=$1',[job.donation_id]);
    await db.query('COMMIT');console.log(job.kind+': provider accepted the submission; delivery confirmation is separate');
   }catch(error){
    await db.query('ROLLBACK').catch(()=>{});
    const failure=error instanceof DeliveryError?error:new DeliveryError('Processing failed; operator review required','internal',job.kind!=='meta_lead_lookup');
    const status=failure.uncertain?'needs_reconciliation':failure.retryAfter&&Number(job.attempts)<4?'queued':failure.code==='configuration'||['401','403'].includes(failure.code)?'needs_configuration':'failed';
    await db.query("update public.integration_outbox set status=$2,last_error=$3,failure_code=$4,next_attempt_at=case when $5::int is null then null else now()+make_interval(secs=>$5::int) end,updated_at=now() where id=$1",[job.id,status,failure.message,failure.code,failure.retryAfter??null]);
    console.log(job.kind+': '+status+' ('+failure.code+')');
   }
  }
  console.log('Worker finished. Delivery authorization:',send?'explicit --send':'dry run; no messages sent');
 }finally{await db.end()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Integration worker failed');process.exitCode=1});
