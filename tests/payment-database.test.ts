import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client,type PoolClient } from 'pg';
import type Stripe from 'stripe';
import { applyStripeEvent } from '../server/stripe-events';
import { applyPayPalEvent,paypalEventSchema } from '../server/paypal-events';

test('local transaction reconciles payment events, rejects mismatches and nets partial refunds',async()=>{
 const url=process.env.DATABASE_URL;if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('Payment contracts refuse remote or missing databases');
 const db=new Client({connectionString:url});await db.connect();
 try{
  await db.query('BEGIN');
  const connection=db as unknown as PoolClient;
  const donor=(await db.query("insert into public.donors(full_name,phone,receipt_opt_in) values('LOCAL TEST payment contract','+19995550123',true) returning id")).rows[0].id;
  const project=(await db.query("insert into public.capital_projects(phase,title,start_year,end_year) values(1,'LOCAL TEST refund contract',2026,2027) returning id")).rows[0].id;
  const session='cs_local_'+randomUUID(),intent='pi_local_'+randomUUID();
  const donation=(await db.query("insert into public.donations(donor_id,capital_project_id,fund,currency,amount_minor_units,provider,provider_payment_id) values($1,$2,'GENERAL','PKR',10000,'stripe',$3) returning id",[donor,project,session])).rows[0].id;
  const event={id:'evt_local_'+randomUUID(),type:'checkout.session.completed',data:{object:{id:session,payment_intent:intent,payment_status:'paid',amount_total:10000,currency:'pkr'}}} as Stripe.Event;
  const raw=JSON.stringify(event);
  assert.equal((await applyStripeEvent(connection,event,raw)).duplicate,false);
  assert.equal((await applyStripeEvent(connection,event,raw)).duplicate,true);
  assert.equal((await db.query('select count(*)::int as n from public.integration_outbox where donation_id=$1',[donation])).rows[0].n,1);
  assert.equal((await db.query('select status from public.donations where id=$1',[donation])).rows[0].status,'confirmed');
  const refund={id:'evt_local_'+randomUUID(),type:'charge.refunded',data:{object:{payment_intent:intent,amount:10000,amount_refunded:2500,currency:'pkr'}}} as Stripe.Event;
  await applyStripeEvent(connection,refund,JSON.stringify(refund));
  assert.equal(Number((await db.query('select raised_paisa from public.capital_projects where id=$1',[project])).rows[0].raised_paisa),7500);
  const mismatch={...event,id:'evt_local_'+randomUUID(),data:{object:{...event.data.object,amount_total:10001}}} as Stripe.Event;
  await db.query('SAVEPOINT mismatch');await assert.rejects(()=>applyStripeEvent(connection,mismatch,JSON.stringify(mismatch)));await db.query('ROLLBACK TO SAVEPOINT mismatch');
  assert.equal((await db.query('select 1 from public.webhook_events where event_id=$1',[mismatch.id])).rowCount,0);
  const admin=(await db.query("select id from public.profiles where email='admin@kawt.local.test' and role='admin'")).rows[0]?.id;assert(admin);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin]);
  const verified=(await db.query("select count(distinct upper(kind))::int as total from public.institutional_documents where upper(kind) in ('FBR','PCP','SHCC','ISO') and status='verified' and valid_until>=current_date")).rows[0].total;
  if(verified<4){await db.query('SAVEPOINT missing_evidence');await assert.rejects(()=>db.query('select public.issue_donation_certificate($1,$2,$3,$4)',[donation,'LOCAL TEST signatory','Local test only','Synthetic certificate contract statement']));await db.query('ROLLBACK TO SAVEPOINT missing_evidence')}
  // All evidence below is explicitly synthetic, visible only in this transaction.
  for(const kind of ['FBR','PCP','SHCC','ISO'])await db.query("insert into public.institutional_documents(title,kind,source_reference,valid_until,status) values($1,$2,'LOCAL TEST synthetic evidence only','2099-01-01','verified')",['LOCAL TEST '+kind,kind]);
  // Refunded gifts cannot receive a certificate, even with current evidence.
  await db.query('SAVEPOINT refunded_certificate');await assert.rejects(()=>db.query('select public.issue_donation_certificate($1,$2,$3,$4)',[donation,'LOCAL TEST signatory','Local test only','Synthetic certificate contract statement']));await db.query('ROLLBACK TO SAVEPOINT refunded_certificate');
  const order='ORDERLOCAL'+Date.now();
  const paypal=(await db.query("insert into public.donations(donor_id,fund,currency,amount_minor_units,provider,provider_payment_id) values($1,'GENERAL','USD',1250,'paypal',$2) returning id",[donor,order])).rows[0].id;
  const capture=paypalEventSchema.parse({id:'WH-LOCAL-'+randomUUID(),event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAPTURELOCAL',status:'COMPLETED',amount:{value:'12.50',currency_code:'USD'},supplementary_data:{related_ids:{order_id:order}}}});
  assert.equal((await applyPayPalEvent(connection,capture,JSON.stringify(capture))).status,'processed');
  assert.equal((await applyPayPalEvent(connection,capture,JSON.stringify(capture))).duplicate,true);
  assert.equal((await db.query('select status from public.donations where id=$1',[paypal])).rows[0].status,'confirmed');
  const certificate=(await db.query('select public.issue_donation_certificate($1,$2,$3,$4) as id',[paypal,'LOCAL TEST signatory','Local test only','Synthetic certificate contract statement'])).rows[0].id;assert(certificate);
  const references=(await db.query('select document_references from public.donation_certificates where id=$1',[certificate])).rows[0].document_references;assert.equal(Object.keys(references).length,4);assert(references.FBR.source_reference);
 }finally{await db.query('ROLLBACK');await db.end()}
});
