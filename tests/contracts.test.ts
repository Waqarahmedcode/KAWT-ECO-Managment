import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac,randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { validPakistaniIban,zakatEstimate } from '../lib/finance';
import { medicineForecast,campaignPerformance,donorRetention,sponsorMatches } from '../lib/insights';
import { deriveOfflineKey,encryptDraft,decryptDraft } from '../lib/offline';
import { validMetaSignature } from '../server/meta-events';
import { verifyStripeEvent } from '../server/stripe-events';
import { DeliveryError,readUnsubscribeToken,unsubscribeToken,sendWhatsApp } from '../server/communications';
import { documentToken,verifyDocumentToken } from '../server/document-access';
import { receiptPdf } from '../server/receipt-pdf';
import { PDFDocument } from 'pdf-lib';

test('PK IBAN checksum rejects changed digits and arbitrary account strings',()=>{
 assert(validPakistaniIban('PK36 SCBL 0000 0011 2345 6702'));
 assert(!validPakistaniIban('PK37SCBL0000001123456702'));
 assert(!validPakistaniIban('unverified bank account'));
});
test('Zakat uses current user-entered nisab, liabilities and a completed lunar year',()=>{
 const base={cash:100000,gold:10000,silver:0,business:0,receivables:0,liabilities:10000,nisab:90000,heldLunarYear:true};
 assert.equal(zakatEstimate(base).amount,2500);
 assert.equal(zakatEstimate({...base,heldLunarYear:false}).amount,0);
 assert.equal(zakatEstimate({...base,nisab:110000}).eligible,false);
 assert.throws(()=>zakatEstimate({...base,cash:NaN}));
});
test('stock forecasting excludes purchase proxies and patients outside the linked cohort',()=>{
 const patients=Array.from({length:10},(_,i)=>({id:String(i)}));
 const dispensations=patients.map(p=>({patient_id:p.id,inventory_id:'batch',units:2}));
 const result=medicineForecast({patients,dispensations:[...dispensations,{patient_id:'missing',inventory_id:'batch',units:999}],inventory:[{id:'batch',medicine_id:'med',procured_units:10000}],medicines:[{id:'med',generic_name:'Synthetic',stock_unit:'tablet'}],targetPatients:300});
 assert.equal(result.sample,10);assert.equal(result.forecasts[0].recommendedUnits,600);
 assert.equal(medicineForecast({patients:[],dispensations:[],inventory:[],medicines:[],targetPatients:100}).forecasts.length,0);
});
test('campaign income excludes pending gifts and keeps foreign currency outside the PKR ratio',()=>{
 const results=campaignPerformance([{id:'campaign',title:'Local test',spend_paisa:500}], [{campaign_id:'campaign',status:'confirmed',currency:'PKR',amount_minor_units:1000},{campaign_id:'campaign',status:'confirmed',currency:'USD',amount_minor_units:9000},{campaign_id:'campaign',status:'pending',currency:'PKR',amount_minor_units:100000}]);
 assert.equal(results[0].returnOnSpend,2);assert.equal(results[0].foreignCurrencyCount,1);
 assert.equal(donorRetention([{id:'private',marketing_consent:false}],[]).length,0);
 assert.equal(sponsorMatches([{organization:'Test',consent_to_contact:false,interests:['water']}],[{title:'Clean water'}]).length,0);
});
test('offline encryption authenticates content and never exports the derived key',async()=>{
 const salt=btoa('0123456789abcdef');
 const key=await deriveOfflineKey('Synthetic offline passphrase',salt);
 assert.equal(key.extractable,false);
 const payload={name:'LOCAL TEST patient',age:14};
 const cipher=await encryptDraft(payload,key);
 assert(!cipher.data.includes(payload.name));assert.deepEqual(await decryptDraft(cipher,key),payload);
 const wrong=await deriveOfflineKey('Wrong synthetic passphrase',salt);
 await assert.rejects(()=>decryptDraft(cipher,wrong));
 const tampered={...cipher,data:Buffer.from('changed ciphertext').toString('base64')};await assert.rejects(()=>decryptDraft(tampered,key));
});
test('Meta signature validates exact raw bytes and rejects modified body',()=>{
 const body='{"entry":[]}',secret='synthetic-unit-secret';
 const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex');
 assert(validMetaSignature(body,signature,secret));assert(!validMetaSignature(body+' ',signature,secret));assert(!validMetaSignature(body,'x',secret));
});
test('Stripe signature rejects an invalid signature before application reconciliation',()=>{
 const body=JSON.stringify({id:'evt_synthetic',object:'event',type:'checkout.session.completed',data:{object:{id:'cs_synthetic'}}});
 const secret='whsec_synthetic';const signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret});
 assert.equal(verifyStripeEvent(body,signature,'sk_test_synthetic',secret).id,'evt_synthetic');
 assert.throws(()=>verifyStripeEvent(body+' ',signature,'sk_test_synthetic',secret));
});
test('unsubscribe capabilities reject tampering and expiry',()=>{
 const id=randomUUID(),secret='synthetic-test-secret',now=100000;
 const token=unsubscribeToken(id,secret,now);
 assert.equal(readUnsubscribeToken(token,secret,now+1),id);
 assert.equal(readUnsubscribeToken(token+'changed',secret,now),null);
 assert.equal(readUnsubscribeToken(token,secret,now+367*86400000),null);
});
test('receipt document capabilities expire after fifteen minutes and bind one donation',()=>{
 const id=randomUUID(),secret='synthetic-document-secret',now=100000;
 const token=documentToken(id,secret,now);
 assert(verifyDocumentToken(token,id,secret,now+1));
 assert(!verifyDocumentToken(token,randomUUID(),secret,now+1));
 assert(!verifyDocumentToken(token+'x',id,secret,now+1));
 assert(!verifyDocumentToken(token,id,secret,now+16*60000));
});
test('receipt renderer produces a readable A4 PDF using the original organization logo',async()=>{
 const bytes=await receiptPdf({id:randomUUID(),full_name:'LOCAL TEST donor',fund:'GENERAL',currency:'PKR',amount_minor_units:10000,refunded_minor_units:0,confirmed_at:new Date('2026-11-12'),status:'confirmed',provider:'test-only'});
 const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);assert.equal(Math.round(pdf.getPage(0).getWidth()),595);assert.equal(Math.round(pdf.getPage(0).getHeight()),842);
});
test('WhatsApp submission uses fixed provider host and distinguishes uncertain transport from rejection',async()=>{
 const input={token:'synthetic',phoneId:'12345678',version:'v22.0',template:'approved_test',language:'en_US',to:'+923001234567',parameters:['Synthetic']};
 let calls=0;
 const transport:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://graph.facebook.com/v22.0/12345678/messages');assert.equal(init?.method,'POST');return Response.json({messages:[{id:'synthetic-reference'}]})};
 assert.equal(await sendWhatsApp(input,transport),'synthetic-reference');assert.equal(calls,1);
 await assert.rejects(()=>sendWhatsApp(input,async()=>{throw new Error('timeout')}),(error:unknown)=>error instanceof DeliveryError&&error.uncertain);
 await assert.rejects(()=>sendWhatsApp(input,async()=>new Response('',{status:429,headers:{'retry-after':'120'}})),(error:unknown)=>error instanceof DeliveryError&&!error.uncertain&&error.retryAfter===120);
});
