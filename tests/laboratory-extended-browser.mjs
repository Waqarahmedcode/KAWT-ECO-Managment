import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Client } from 'pg';
import { parse } from 'dotenv';
import { chromium, request } from '@playwright/test';
const base='http://127.0.0.1:3012';
const bindings=parse(fs.readFileSync('.local/laboratory-test.env'));
const url=new URL(bindings.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/kawt_init_validation_\d+$/.test(url.pathname))throw Error('Disposable database required');
const source=JSON.parse(fs.readFileSync('.local/laboratory-july-source.json'));source.laboratory_name??='Khidmat-e-Alam Diagnostic Centre';
const sourceDrafts=JSON.parse(fs.readFileSync('.local/medical-centre-source-drafts.json'));
const accounts=JSON.parse(fs.readFileSync(process.env.KAWT_LAB_EXISTING_ACCOUNTS));
const pdf=process.env.KAWT_LAB_PDF_SAMPLE,xlsx=process.env.KAWT_LAB_XLSX_SAMPLE;
if(!pdf||!xlsx)throw Error('Private source sample paths required');
const db=new Client({connectionString:url.toString()});await db.connect();
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const out='.local/laboratory-browser';fs.mkdirSync(out,{recursive:true,mode:0o700});
const createdReports=[],createdPrices=[],passed=[];
let admin,operator;
const sum=p=>p.tests.reduce((n,t)=>n+(t.morning??0)+(t.evening??0)+(t.night??0),0);
const summaryPath=(kind,start,end)=>'/api/lab/summary?'+new URLSearchParams({kind,start,end,laboratory_name:source.laboratory_name});
const query=(kind,start,end)=>admin.get(summaryPath(kind,start,end)).then(r=>r.json());
const clean=async()=>{
 if(createdReports.length){await db.query('delete from public.kawt_lab_audit where report_id=any($1::uuid[])',[createdReports]);await db.query('delete from public.kawt_lab_reports where id=any($1::uuid[])',[createdReports]);createdReports.length=0;}
 if(createdPrices.length){await db.query('delete from public.kawt_mc_audit where entity_id=any($1::uuid[])',[createdPrices]);await db.query('delete from public.kawt_mc_prices where id=any($1::uuid[])',[createdPrices]);createdPrices.length=0;}
};
try{
 const login=async role=>{const a=accounts.find(x=>x.role===role),api=await request.newContext({baseURL:base});const response=await api.post('/api/auth/session',{data:{action:'signin',email:a.email,password:a.password}});assert.equal(response.status(),200,'Local fixture sign-in');return api;};
 admin=await login('admin');operator=await login('donor');
 for(const path of[pdf,xlsx]){
  const response=await admin.post('/api/lab/import',{multipart:{file:{name:path.split('/').pop(),mimeType:path.endsWith('.pdf')?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fs.readFileSync(path)},laboratory_name:source.laboratory_name,approvedTemplate:'true'}});
  assert.equal(response.status(),200,'Native source import');const body=await response.json();assert.equal(body.saved,false);assert.equal(body.drafts.length,1);const draft=body.drafts[0];assert.equal(draft.period_kind,source.period_kind);assert.equal(draft.period_start,source.period_start);assert.equal(draft.period_end,source.period_end);assert.equal(sum(draft.payload),sum(source.payload));assert.deepEqual(draft.payload.patients,source.payload.patients);assert.deepEqual(draft.payload.outsource,source.payload.outsource);assert.deepEqual(draft.payload.urgent,source.payload.urgent);assert.deepEqual(draft.payload.tests,source.payload.tests);
 }
 passed.push('Native PDF and Excel import match every private source count and month; no automatic database save');
 if(process.env.KAWT_LAB_SCAN_SAMPLE){
  const response=await admin.post('/api/lab/import',{multipart:{file:{name:'source-scan.png',mimeType:'image/png',buffer:fs.readFileSync(process.env.KAWT_LAB_SCAN_SAMPLE)},laboratory_name:source.laboratory_name,approvedTemplate:'true'},timeout:60000});
  assert.equal(response.status(),200,'Production OCR import: '+(response.ok()?'OK':await response.text()));
  const body=await response.json(),draft=body.drafts[0];assert.equal(body.saved,false);assert.equal(draft.period_start,source.period_start);assert.equal(draft.period_end,source.period_end);
  let unreadable=0;for(const row of draft.payload.tests){const expected=source.payload.tests.find(t=>t.label===row.label);assert(expected);for(const shift of ['morning','evening','night'])if(row[shift]===null)unreadable++;else assert.equal(row[shift],expected[shift],row.label+' '+shift);}
  assert.equal(sum(draft.payload),sum(source.payload));assert(draft.warnings.length>0);
  fs.writeFileSync(out+'/ocr-api-results.json',JSON.stringify({productionRuntime:true,saved:false,nonNullCountsMatchSource:true,unreadableCountCells:unreadable,reviewRequired:true,workerAndModelAvailable:true},null,2),{mode:0o600});
  passed.push('Built-server image OCR loads its local worker/model; readable counts match source and uncertain cells remain reviewable nulls');
 }

 assert.equal((await operator.post('/api/lab/import',{multipart:{file:{name:'source.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(pdf)}}})).status(),403);
 assert.equal((await operator.post('/api/lab/reports/batch',{data:[source]})).status(),403);
 const month=await query('month',source.period_start,source.period_end);assert.equal(month.found,true);assert.equal(month.stats.testTotal,sum(source.payload));assert.equal(month.complete_source_coverage,true);
 const dayStart=source.period_start.slice(0,8)+'03';
 assert.equal((await db.query('select id from public.kawt_lab_reports where period_kind=$1 and period_start=$2',['day',dayStart])).rowCount,0,'Clean disposable daily fixture');
 const missing=await query('day',dayStart,dayStart);assert.equal(missing.found,false);assert.equal(missing.related_aggregate.period_kind,'month');
 const annual=await query('year',source.period_start.slice(0,4)+'-01-01',source.period_start.slice(0,4)+'-12-31');assert.equal(annual.found,true);assert.equal(annual.complete_source_coverage,false);assert.equal(annual.stats.testTotal,sum(source.payload));
 assert.equal((await admin.get(summaryPath('day','2026-02-29','2026-02-29'))).status(),400);
 const payload={tests:[{label:'Isolated test',morning:2,evening:0,night:0}],patients:{morning:1,evening:0,night:0},outsource:{patients:0,tests:0},urgent:{morning:{patients:0,tests:0},evening:{patients:0,tests:0},night:{patients:0,tests:0}}};
 const day={laboratory_name:source.laboratory_name,period_kind:'day',period_start:dayStart,period_end:dayStart,source_label:'Isolated date-selector check',entry_mode:'manual',payload};
 const saved=await operator.post('/api/lab/reports',{data:day});assert.equal(saved.status(),200);createdReports.push((await saved.json()).report.id);
 assert.equal((await query('day',dayStart,dayStart)).stats.testTotal,2);
 assert.equal((await query('month',source.period_start,source.period_end)).stats.testTotal,sum(source.payload));
 passed.push('Actual daily entry is selectable; absent days stay unavailable; monthly and daily sources never double-count; annual coverage stays partial');
 const nextDate=source.period_start.slice(0,8)+'04',fresh={...day,period_start:nextDate,period_end:nextDate};
 assert.equal((await admin.post('/api/lab/reports/batch',{data:[fresh,source]})).status(),409);
 assert.equal((await query('day',nextDate,nextDate)).found,false,'Failed batch rolls back earlier items');
 const batch=await admin.post('/api/lab/reports/batch',{data:[fresh,{...fresh,period_start:source.period_start.slice(0,8)+'05',period_end:source.period_start.slice(0,8)+'05'}]});assert.equal(batch.status(),200);const result=await batch.json();assert.equal(result.saved,2);createdReports.push(...result.reports.map(r=>r.id));
 passed.push('Historical batch import is admin-only, rejects duplicates and saves all-or-nothing');
 let centreResponse=await admin.get('/api/medical-centre');assert.equal(centreResponse.status(),200);let centre=await centreResponse.json();
 if(!centre.doctors.length){const imported=await admin.post('/api/medical-centre/import',{data:sourceDrafts});assert.equal(imported.status(),200);centre=await(await admin.get('/api/medical-centre')).json();}
 assert.equal(centre.doctors.length,sourceDrafts.items.filter(r=>r.action==='doctor').length);assert.equal(centre.packages.length,sourceDrafts.items.filter(r=>r.action==='package').length);
 assert.equal((await admin.post('/api/medical-centre/import',{data:sourceDrafts})).status(),409);
 assert.equal((await operator.get('/api/medical-centre')).status(),403);
 const pkg=centre.packages[0];
 for(const[date,amount]of[['2026-06-01',10000],['2026-08-01',12000]]){const res=await admin.post('/api/medical-centre',{data:{action:'price',entity:'package',entity_id:pkg.id,valid_from:date,amount_minor:amount,currency:'PKR',source_label:'Isolated append-only price check'}});assert.equal(res.status(),200);createdPrices.push((await res.json()).record.id);}
 centre=await(await admin.get('/api/medical-centre')).json();const versions=centre.prices.filter(p=>createdPrices.includes(p.id));assert.equal(versions.length,2);assert.equal(versions.find(p=>p.valid_from<='2026-07-31').amount_minor,'10000');assert.equal(versions[0].amount_minor,'12000');
 await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[accounts.find(a=>a.role==='admin').user_id]);await assert.rejects(db.query('update public.kawt_mc_prices set amount_minor=1 where id=$1',[createdPrices[0]]),e=>e.code==='42501');await db.query('rollback');
 passed.push('Poster doctors and packages import once; rates append with exact dates and earlier prices cannot be overwritten');
 const context=await browser.newContext({storageState:await admin.storageState(),viewport:{width:1440,height:1100}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/lab/reports');await page.getByRole('heading',{name:'Lab performance reports'}).waitFor();await page.getByRole('heading',{name:'Shift-wise performance'}).waitFor();assert.equal(await page.getByLabel('Report month').inputValue(),source.period_start.slice(5,7));
 await page.getByLabel('Saved daily dates').selectOption(dayStart);await page.getByRole('heading',{name:'Shift-wise performance'}).waitFor();assert.equal(await page.getByLabel('Report view').inputValue(),'day');
 await page.getByLabel('Report from date').fill(nextDate.slice(0,8)+'09');await page.getByRole('heading',{name:'Is tareekh ya period ka data available nahin'}).waitFor();
 await page.getByRole('link',{name:source.period_start+' — '+source.period_end+' kholein'}).click();await page.getByRole('heading',{name:'Shift-wise performance'}).waitFor();assert.equal(await page.getByLabel('Report view').inputValue(),'month');
 await page.getByLabel('Report year').selectOption('2025');await page.getByRole('heading',{name:'Is tareekh ya period ka data available nahin'}).waitFor();
 await page.getByLabel('Report year').selectOption(source.period_start.slice(0,4));await page.getByRole('heading',{name:'Shift-wise performance'}).waitFor();
 await page.getByLabel('Report view').selectOption('year');await page.getByText('Partial report:',{exact:false}).waitFor();
 await page.getByLabel('Report view').selectOption('custom');await page.getByLabel('Report from date').fill(source.period_start);await page.getByLabel('Report to date').fill(source.period_end);await page.getByRole('heading',{name:'Shift-wise performance'}).waitFor();
 passed.push('Browser year/month/daily/manual range selectors, no-data state and partial annual warning work');
 await clean();
 await page.goto(base+'/lab/reports');await page.getByRole('heading',{name:'Shift-wise performance'}).waitFor();assert(await page.locator('table').count()>=5);await page.screenshot({path:out+'/lab-reports-desktop.png',fullPage:true});await page.setViewportSize({width:1440,height:1500});await page.screenshot({path:out+'/lab-reports-overview.png'});await page.setViewportSize({width:1440,height:1100});await page.pdf({path:out+'/KAWT-lab-July-2026-current.pdf',format:'A4',landscape:true,printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'10mm',right:'10mm'}});
 const exported=await admin.get(summaryPath('month',source.period_start,source.period_end)+'&format=xlsx');assert.equal(exported.status(),200);fs.writeFileSync(out+'/KAWT-lab-July-2026-current.xlsx',await exported.body(),{mode:0o600});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:out+'/lab-reports-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1100});await page.goto(base+'/medical-centre');await page.getByRole('heading',{name:'Medical Centre',exact:true}).waitFor();await page.getByRole('heading',{name:centre.doctors.find(d=>d.service_group==='OPD').name,exact:true}).waitFor();await page.screenshot({path:out+'/medical-centre-doctors.png',fullPage:true});
 await page.getByRole('button',{name:'24/7 Emergency doctors'}).click();assert.equal(await page.locator('article').count(),centre.doctors.filter(d=>d.service_group==='URGENT_CARE').length);
 await page.getByRole('button',{name:'Lab packages',exact:true}).click();assert.equal(await page.locator('article').count(),centre.packages.length);await page.screenshot({path:out+'/medical-centre-packages.png',fullPage:true});
 assert.deepEqual(errors,[]);await context.close();passed.push('Source-only screenshots, formatted PDF and actual XLSX export captured; mobile fits screen; OPD/Urgent/package tabs render without browser errors');
 fs.writeFileSync(out+'/extended-results.json',JSON.stringify({checks:passed,productDatabaseChanged:false,accountsCreated:0},null,2),{mode:0o600});passed.forEach(s=>console.log('PASS:',s));
}finally{await clean();await admin?.dispose();await operator?.dispose();await browser.close();await db.end();}
