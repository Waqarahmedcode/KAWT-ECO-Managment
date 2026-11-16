/* Isolated local integration checks. Never run against a remote target. */
if(process.env.KAWT_ALLOW_SYNTHETIC_TEST_DATA!=='isolated-test-database')throw new Error('Workflow checks create synthetic fixtures. Run only on a separate disposable test database with KAWT_ALLOW_SYNTHETIC_TEST_DATA=isolated-test-database; never on the source-only product database.');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID,randomInt} from 'node:crypto';
import {request,chromium} from '@playwright/test';
import {Client} from 'pg';
const base=process.env.KAWT_TEST_URL||'http://127.0.0.1:3001';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)||!process.env.DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error('Workflow tests refuse all remote application/database targets');
const accounts=JSON.parse(fs.readFileSync('.local/accounts.json','utf8'));
const contexts=[];
let passed=0;
const created={camp:null,medicines:[],projects:[],wash:[],partners:[],donations:[],storage:[],banks:[]};
const note=name=>{passed++;console.log('PASS:',name)};
async function call(context,url,data,method='post',expected=201){
 const response=await context[method](url,{data});
 const value=await response.json();
 assert.equal(response.status(),expected,`${url}: ${typeof value.error==='string'?value.error:JSON.stringify(value.error)}`);
 return value;
}
async function action(context,action,data){return (await call(context,'/api/workspace',{action,data})).record}
async function signIn(role){
 const user=accounts.find(a=>a.role===role);assert(user,'Missing isolated local test role '+role);
 const context=await request.newContext({baseURL:base});contexts.push(context);
 await call(context,'/api/auth/session',{action:'signin',email:user.email,password:user.password},'post',200);
 return context;
}
async function reject(context,url,data,expected){const response=await context.post(url,{data});assert.equal(response.status(),expected);return response}
async function snapshot(context){const response=await context.get('/api/workspace');assert.equal(response.status(),200);return response.json()}

async function cleanup(){
 for(const path of created.storage){
  const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert(['127.0.0.1','localhost'].includes(url.hostname));
  const response=await fetch(url.origin+'/storage/v1/object/private-camp-receipts',{method:'DELETE',headers:{Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});assert(response.ok,'Local test storage cleanup failed');
 }

 const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
 try{
  await db.query('BEGIN');
  // The test created these exact IDs. Bypass immutable-journal triggers only for
  // cleanup inside this guarded local transaction; never alter unrelated rows.
  await db.query("set local session_replication_role='replica'");
  if(created.camp){
   const owner=await db.query("select 1 from public.camps where id=$1 and title like 'LOCAL TEST:%'",[created.camp]);
   if(owner.rowCount){
    const ids=(await db.query('select id from public.camp_patients where camp_id=$1',[created.camp])).rows.map(r=>r.id);
    const inv=(await db.query('select id from public.camp_pharmacy_inventory where camp_id=$1',[created.camp])).rows.map(r=>r.id);
    await db.query('delete from public.inventory_adjustments where inventory_id=any($1::uuid[])',[inv]);
    await db.query('delete from public.camp_pharmacy_dispensations where inventory_id=any($1::uuid[])',[inv]);
    await db.query('delete from public.camp_consultation_diagnoses where consultation_id in (select id from public.camp_consultations where camp_id=$1)',[created.camp]);
    await db.query('delete from public.patient_eligibility where camp_patient_id=any($1::uuid[])',[ids]);
    for(const table of ['centre_referrals','camp_consultations','camp_staff_roster','camp_financial_ledgers','camp_pharmacy_inventory','camp_patients','csr_commitments'])await db.query(`delete from public.${table} where camp_id=$1`,[created.camp]);
    await db.query('delete from public.camps where id=$1',[created.camp]);
   }
  }
  for(const id of created.donations){
   const donor=(await db.query('select donor_id from public.donations where id=$1',[id])).rows[0]?.donor_id;
   await db.query('delete from public.integration_outbox where donation_id=$1',[id]);
   await db.query('delete from public.donations where id=$1',[id]);
   if(donor){await db.query('delete from public.sponsorships where donor_id=$1',[donor]);await db.query('delete from public.donors where id=$1',[donor])}
  }
  await db.query('delete from public.bank_routes where id=any($1::uuid[])',[created.banks]);
  await db.query('delete from public.medicine_catalog where id=any($1::uuid[])',[created.medicines]);
  await db.query('delete from public.project_milestones where project_id=any($1::uuid[])',[created.projects]);
  await db.query('delete from public.capital_projects where id=any($1::uuid[])',[created.projects]);
  await db.query('delete from public.wash_readings where project_id=any($1::uuid[])',[created.wash]);
  await db.query('delete from public.wash_projects where id=any($1::uuid[])',[created.wash]);
  await db.query('delete from public.csr_commitments where partner_id=any($1::uuid[])',[created.partners]);
  await db.query('delete from public.csr_memberships where partner_id=any($1::uuid[])',[created.partners]);
  await db.query('delete from public.csr_partners where id=any($1::uuid[])',[created.partners]);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error}finally{await db.end()}
}

(async()=>{
 let browser;
 try{
  const admin=await signIn('admin'),doctor=await signIn('doctor'),pharmacist=await signIn('pharmacist'),donor=await signIn('donor'),partner=await signIn('csr_partner');
  const unauthed=await request.newContext({baseURL:base});contexts.push(unauthed);
  assert.equal((await unauthed.get('/api/workspace')).status(),401);
  const loaded=await snapshot(admin);assert(Array.isArray(loaded.tables.capital_projects));
  note('real local sessions and authenticated shared workspace; anonymous access rejected');
  const code='FMC-'+randomInt(100,999);
  await call(admin,'/api/camps',{id:code,title:'LOCAL TEST: operational workflow',area:'Automated local test only',hazard_assessment:{flood:false,heat:false,road_access:'Local test',ambulance_access:'Local test',assessor_notes:'Synthetic test fixture, not a real camp'}});created.camp=code;
  await action(admin,'camp_status',{id:code,status:'approved'});
  note('camp creation, assessment and explicit approval persist');
  const paged=await admin.get('/api/workspace?table=camps&page=0&query='+encodeURIComponent(code));assert.equal(paged.status(),200);assert.equal((await paged.json()).rows[0].id,code);assert.equal((await donor.get('/api/workspace?table=camp_patients')).status(),403);
  note('server pagination searches authorized records and rejects forbidden table access');

  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const ui=await browser.newContext({storageState:await doctor.storageState(),viewport:{width:1440,height:1100}});const page=await ui.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/dashboard?section=patients',{waitUntil:'networkidle'});
  await page.locator('select[name="camp_id"]').selectOption(code);
  await page.locator('input[name="display_name"]').fill('LOCAL TEST synthetic patient');
  await page.locator('input[name="age_years"]').fill('14');
  await page.locator('input[name="consent_recorded"]').check();
  await page.locator('input[name="is_emergency"]').check();
  const registration=page.waitForResponse(r=>r.url().endsWith('/api/patients')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save record',exact:true}).click();
  const patientResponse=await registration;const registrationValue=await patientResponse.json();assert.equal(patientResponse.status(),201,JSON.stringify(registrationValue));const patient=registrationValue.patient;
  assert.equal(patient.age_band,'child_0_14');assert.match(patient.uid,/^KAWT-/);
  note('desktop UI registers a patient with server UID, separate age/gender and consent');

  const idempotent={camp_id:code,display_name:'LOCAL TEST offline replay',age_years:65,gender:'male',consent_recorded:true,client_request_id:randomUUID()};
  const first=(await call(doctor,'/api/patients',idempotent)).patient;
  const second=await call(doctor,'/api/patients',idempotent,'post',200);assert.equal(first.id,second.patient.id);assert(second.replayed);
  await reject(doctor,'/api/patients',{...idempotent,client_request_id:randomUUID(),camp_id:'FMC-01'},409);
  note('offline retry is idempotent; closed historical camps reject fresh registrations');

  await page.goto(base+'/offline',{waitUntil:'networkidle'});
  await page.getByLabel('Offline passphrase',{exact:true}).fill('Synthetic workflow offline passphrase');
  await page.getByRole('button',{name:'Unlock encrypted queue',exact:true}).click();
  await page.getByRole('heading',{name:'New offline registration',exact:true}).waitFor();
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await ui.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Encrypted offline intake',exact:true}).waitFor();
  await page.getByLabel('Offline passphrase',{exact:true}).fill('Synthetic workflow offline passphrase');
  await page.getByRole('button',{name:'Unlock encrypted queue',exact:true}).click();
  await page.getByRole('heading',{name:'New offline registration',exact:true}).waitFor();
  await page.locator('select[name="camp_id"]').selectOption(code);
  await page.locator('input[name="display_name"]').fill('LOCAL TEST encrypted intake');
  await page.locator('input[name="age_years"]').fill('29');
  await page.locator('select[name="pregnancy_status"]').selectOption('pregnant');
  await page.locator('input[name="bp_systolic"]').fill('118');
  await page.locator('input[name="consent_recorded"]').check();
  await page.getByRole('button',{name:'Save encrypted intake',exact:true}).click();
  await page.getByText('LOCAL TEST encrypted intake',{exact:false}).waitFor();
  const encrypted=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('kawt-offline-v1',1);request.onsuccess=()=>{const db=request.result;const read=db.transaction('drafts','readonly').objectStore('drafts').getAll();read.onsuccess=()=>{resolve(read.result);db.close()};read.onerror=()=>reject(read.error)};request.onerror=()=>reject(request.error)}));
  assert.equal(encrypted.length,1);assert(!JSON.stringify(encrypted).includes('LOCAL TEST encrypted intake'));
  await page.getByRole('button',{name:'Lock queue',exact:true}).click();
  await page.getByLabel('Offline passphrase',{exact:true}).fill('Wrong synthetic passphrase');
  await page.getByRole('button',{name:'Unlock encrypted queue',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'does not unlock'}).waitFor();
  await page.getByLabel('Offline passphrase',{exact:true}).fill('Synthetic workflow offline passphrase');
  await page.getByRole('button',{name:'Unlock encrypted queue',exact:true}).click();
  await page.getByRole('button',{name:'Synchronize 1 drafts',exact:true}).waitFor();
  await ui.setOffline(false);
  await page.getByRole('button',{name:'Synchronize 1 drafts',exact:true}).click();
  await page.getByRole('status').filter({hasText:'1 intake records synchronized'}).waitFor();
  const synced=(await snapshot(doctor)).tables.camp_patients.find(p=>p.display_name==='LOCAL TEST encrypted intake');
  assert(synced);assert.equal(synced.bp_systolic,118);assert.equal(synced.pregnancy_status,'pregnant');
  note('browser captures encrypted offline vitals, rejects a wrong unlock key, then synchronizes and removes only confirmed drafts');


  await call(doctor,'/api/consultations',{patient_id:patient.id,camp_id:code,chief_complaint:'Synthetic workflow check',diagnoses:['GI_ACIDITY']});
  const referral=(await call(doctor,'/api/referrals',{patient_id:patient.id,camp_id:code,service:'LAB'})).referral;
  await call(doctor,'/api/referrals',{id:referral.id,status:'completed'},'patch',200);
  assert.equal((await doctor.get('/referrals/'+referral.referral_code)).status(),200);
  assert.equal((await unauthed.get('/referrals/'+referral.referral_code)).url().includes('/login'),true);
  note('consultation, referral issue/follow-up and protected printable referral work');
  const clinical=await doctor.get('/api/clinical/summary?camp='+code);assert.equal(clinical.status(),200);const profile=await clinical.json();assert.equal(profile.consultedPatients,1);assert.equal(profile.diagnoses.find(r=>r.category==='GI_ACIDITY').patients,1);const history=await doctor.get('/api/workspace?patient_id='+patient.id);assert.equal((await history.json()).tables.camp_consultations.length,1);
  await action(admin,'roster',{camp_id:code,staff_name:'LOCAL TEST doctor',role:'DOCTOR',honorarium_paisa:1000000,rate_paisa:500000,duty_units:2,attendance_confirmed:true,payout_status:'approved'});
  await reject(admin,'/api/workspace',{action:'roster',data:{camp_id:code,staff_name:'LOCAL TEST wrong calculation',role:'DOCTOR',honorarium_paisa:1,rate_paisa:500000,duty_units:2,attendance_confirmed:false,payout_status:'pending'}},400);
  note('clinical prevalence uses patient diagnoses and honoraria enforce duties multiplied by agreed rate');

  const medicine=await action(pharmacist,'medicine',{generic_name:'LOCAL TEST medicine '+code,formulation:'tablet',stock_unit:'tablet'});created.medicines.push(medicine.id);
  const inventory=(await call(pharmacist,'/api/inventory',{camp_id:code,medicine_id:medicine.id,opening_units:100,procured_units:0,wastage_units:0})).inventory;
  await call(pharmacist,'/api/pharmacy/dispense',{inventory_id:inventory.id,patient_id:patient.id,units:10});
  await reject(pharmacist,'/api/pharmacy/dispense',{inventory_id:inventory.id,patient_id:patient.id,units:999},409);
  const adjustment=await action(pharmacist,'adjustment',{inventory_id:inventory.id,procurement_delta:20,wastage_delta:0,reason:'LOCAL TEST controlled procurement'});
  await action(admin,'adjustment_decision',{id:adjustment.id,approve:true});
  const stocks=(await snapshot(pharmacist)).tables.camp_pharmacy_inventory.find(r=>r.id===inventory.id);assert.equal(stocks.closing_units,110);
  note('patient-linked dispensing, oversell prevention and approved inventory correction work');

  const approval=(await call(admin,'/api/eligibility',{camp_patient_id:patient.id,eligible_for_zakat:true,screening_reference:'LOCAL TEST eligibility',subsidy_percent:50})).approval;
  await call(admin,'/api/ledger',{camp_id:code,fund:'ZAKAT',expense:'MEDICINE',amount_paisa:1000,patient_id:patient.id,eligibility_id:approval.id});
  await reject(admin,'/api/ledger',{camp_id:code,fund:'ZAKAT',expense:'TRANSPORT',amount_paisa:1000,patient_id:patient.id,eligibility_id:approval.id},400);
  await reject(doctor,'/api/ledger',{camp_id:code,fund:'GENERAL',expense:'HONORARIUM',amount_paisa:1000},403);
  const general=(await call(admin,'/api/ledger',{camp_id:code,fund:'GENERAL',expense:'HONORARIUM',amount_paisa:5000})).ledger_entry;
  await action(admin,'reversal',{id:general.id,reason:'LOCAL TEST reversing entry'});
  await reject(admin,'/api/workspace',{action:'reversal',data:{id:general.id,reason:'LOCAL TEST duplicate reversal'}},409);
  const summary=await (await admin.get('/api/dashboard')).json();const camp=summary.camps.find(c=>c.id===code);assert.equal(camp.spend,10);assert.equal(camp.emergencies,1);
  note('Zakat eligibility, role separation, immutable reversals and net dashboard totals pass');

  const project=await action(admin,'project',{phase:3,title:'LOCAL TEST neonatal project',start_year:2028,end_year:2029,target_paisa:100000,status:'planned'});created.projects.push(project.id);
  await action(admin,'milestone',{project_id:project.id,title:'LOCAL TEST procurement',budget_paisa:10000,status:'in_progress'});
  const water=await action(admin,'wash_project',{title:'LOCAL TEST water plant',kind:'RO',location:'Synthetic test site'});created.wash.push(water.id);
  await action(admin,'wash_reading',{project_id:water.id,recorded_on:'2026-11-12',source_liters:1000,pure_liters:750,quality_reference:'LOCAL TEST measurement'});
  assert.equal(Number((await snapshot(admin)).tables.wash_projects.find(p=>p.id===water.id).yield_pct),75);
  note('capital milestones and persisted WASH measurements calculate the correct yield');

  const organization=await action(admin,'csr_partner',{organization:'LOCAL TEST corporate partner',sector:'Healthcare',interests:['neonatal'],consent_to_contact:true,status:'partner'});created.partners.push(organization.id);
  await action(admin,'csr_membership',{partner_id:organization.id,user_id:accounts.find(a=>a.role==='csr_partner').user_id});
  await action(admin,'csr_commitment',{partner_id:organization.id,project_id:project.id,pillar:'social',sdg:'SDG3',description:'LOCAL TEST commitment',pledged_paisa:10000,volunteer_hours:4,status:'approved'});
  const corporate=await snapshot(partner);assert.equal(corporate.tables.csr_partners.some(p=>p.id===organization.id),true);assert.equal(corporate.tables.camp_patients,undefined);assert.equal(corporate.tables.donors,undefined);
  await reject(partner,'/api/workspace',{action:'project',data:{phase:1,title:'Not permitted',start_year:2026,end_year:2027,target_paisa:0,status:'planned'}},403);
  note('CSR member access is scoped and cannot read patient or donor records');

  const intent={request_id:randomUUID(),full_name:'LOCAL TEST donor',email:accounts.find(a=>a.role==='donor').email,country:'Pakistan',fund:'GENERAL',currency:'PKR',amount_minor_units:250000,provider:'pledge',tier:'capital_equipment',project_id:project.id,marketing_consent:false,receipt_opt_in:false,privacy_consent:true};
  const gift=await call(donor,'/api/giving',intent);created.donations.push(gift.donation_id);assert.equal(gift.status,'pending');
  const replay=await call(donor,'/api/giving',intent,'post',200);assert.equal(replay.donation_id,gift.donation_id);
  assert.equal((await snapshot(donor)).tables.donations.some(d=>d.id===gift.donation_id),true);
  await reject(donor,'/api/giving',{...intent,request_id:randomUUID(),fund:'ZAKAT'},400);
  note('public sponsorship pledges persist idempotently and appear in the donor portal; Zakat cannot fund capital');
  assert.equal((await donor.get('/api/donations/'+gift.donation_id+'/pdf')).status(),404);
  assert.equal((await partner.get('/api/donations/'+gift.donation_id+'/pdf')).status(),403);
  const bank=await action(admin,'bank_route',{bank_name:'LOCAL TEST example only',fund:'GENERAL',iban:'PK36SCBL0000001123456702',account_title:'LOCAL TEST synthetic bank destination',verification_reference:'LOCAL TEST example; no real transfer',active:true});created.banks.push(bank.id);
  const bankIntent={...intent,request_id:randomUUID(),project_id:undefined,provider:'bank_transfer',tier:'custom',bank_route_id:bank.id};
  const bankGift=await call(donor,'/api/giving',bankIntent);created.donations.push(bankGift.donation_id);
  await action(admin,'donation_confirmation',{id:bankGift.donation_id,proof_reference:'LOCAL TEST simulated bank reconciliation only'});
  const ownedPdf=await donor.get('/api/donations/'+bankGift.donation_id+'/pdf');assert.equal(ownedPdf.status(),200);assert.match(ownedPdf.headers()['content-type'],/application\/pdf/);assert.equal((await ownedPdf.body()).subarray(0,5).toString(),'%PDF-');
  assert.equal((await donor.get('/api/donations/'+bankGift.donation_id+'/pdf?certificate=true')).status(),409);
  note('locally reconciled bank fixtures produce an owned real PDF; unissued tax certificates are unavailable');


  const source=await admin.get('/api/reports/source?camp=FMC-01');assert.equal(source.status(),200);assert.match(source.headers()['content-security-policy'],/script-src 'none'/);assert(!(await source.text()).includes('<script'));
  const insights=await admin.get('/api/insights?target=300');assert.equal(insights.status(),200);assert((await insights.json()).coverage.patients>=3);
  for(const provider of ['database','supabase']){const checked=await call(admin,'/api/integrations/status',{provider},'post',200);assert.equal(checked.verified,true)}
  assert.equal((await donor.post('/api/integrations/status',{data:{provider:'database'}})).status(),403);
  note('protected original report, full-cohort insights and actual local PostgreSQL/Supabase connection checks pass');

  const upload=await call(admin,'/api/files/upload-url',{camp_id:code,filename:'local-test.pdf'},'post',200);created.storage.push(upload.path);
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
  assert(['127.0.0.1','localhost'].includes(new URL(upload.signedUrl).hostname));
  const stored=await admin.put(upload.signedUrl,{data:pdf,headers:{'Content-Type':'application/pdf'}});assert.equal(stored.ok(),true,'Private local receipt upload rejected');
  const evidence=await admin.get('/api/files/download-url?path='+encodeURIComponent(upload.path));assert.equal(evidence.status(),200);
  const downloaded=await admin.get((await evidence.json()).url);assert.equal(downloaded.ok(),true);assert((await downloaded.body()).equals(pdf));
  assert.equal((await doctor.get('/api/files/download-url?path='+encodeURIComponent(upload.path))).status(),403);
  assert.equal((await admin.get('/api/files/download-url?path=../../secret')).status(),400);
  note('actual private Supabase storage uploads/downloads pass, unauthorized roles and path traversal are rejected');

  const rls=new Client({connectionString:process.env.DATABASE_URL});await rls.connect();
  try{
   for(const check of [
    {role:'camp_manager',sql:"insert into public.integration_outbox(kind,dedupe_key) values('retention','forbidden-local-test')"},
    {role:'donor',sql:"update public.donations set status='confirmed' where id='"+gift.donation_id+"'"},
    {role:'pharmacist',sql:"update public.camp_pharmacy_inventory set dispensed_units=0 where id='"+inventory.id+"'"},
   ]){
    await rls.query('BEGIN');await rls.query('SET LOCAL ROLE authenticated');await rls.query("select set_config('request.jwt.claim.sub',$1,true)",[accounts.find(a=>a.role===check.role).user_id]);
    await assert.rejects(()=>rls.query(check.sql),error=>error.code==='42501');await rls.query('ROLLBACK');
   }
  }finally{await rls.end()}
  note('direct database access cannot bypass finance, outbox and stock approval permissions');

  const csrf=await admin.post('/api/workspace',{headers:{Origin:'https://untrusted.invalid'},data:{action:'camp_status',data:{id:code,status:'completed'}}});assert.equal(csrf.status(),403);
  await page.goto(base+'/dashboard?section=clinical',{waitUntil:'networkidle'});assert.equal(await page.getByRole('heading',{name:'Consultations',exact:true}).count(),1);
  assert.deepEqual(errors,[]);note('cross-origin writes are rejected and the authenticated desktop UI has no uncaught browser errors');
  fs.writeFileSync('.local/workflow-results.json',JSON.stringify({passed,completedAt:new Date().toISOString(),externalMessagesSent:0,remoteDatabaseTouched:false},null,2));
  console.log(`${passed} integration checks passed against isolated local Supabase; no external messages or payments sent.`);
 }finally{
  if(browser)await browser.close();
  await Promise.all(contexts.map(c=>c.dispose()));
  await cleanup();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
