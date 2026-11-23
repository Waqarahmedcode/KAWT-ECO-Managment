import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Client } from 'pg';
import { parse } from 'dotenv';
import { chromium, request } from '@playwright/test';
import readXlsx from 'read-excel-file/node';

const base=process.env.KAWT_COMPARISON_TEST_ORIGIN??'http://127.0.0.1:3015';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local test origin required');
const bindings=parse(fs.readFileSync('.local/laboratory-test.env')),url=new URL(bindings.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/kawt_init_validation_\d+$/.test(url.pathname))throw Error('Disposable database required');
const accounts=JSON.parse(fs.readFileSync(process.env.KAWT_LAB_EXISTING_ACCOUNTS));
const db=new Client({connectionString:url.toString()});await db.connect();
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const lab='Isolated comparison checks',ids=[],contexts=[],out='.local/laboratory-comparison';fs.mkdirSync(out,{recursive:true,mode:0o700});
const path='/api/lab/comparison?'+new URLSearchParams({kind:'month',start:'2025-06-01',end:'2025-06-30',laboratory_name:lab});
const checks=[];
try{
 const login=async role=>{const a=accounts.find(a=>a.role===role),api=await request.newContext({baseURL:base});contexts.push(api);assert.equal((await api.post('/api/auth/session',{data:{action:'signin',email:a.email,password:a.password}})).status(),200);return api;};
 const anon=await request.newContext({baseURL:base});contexts.push(anon);assert.equal((await anon.get(path)).status(),401);
 const admin=await login('admin'),operator=await login('donor'),doctor=await login('doctor');
 assert.equal((await doctor.get(path)).status(),403);
 assert.equal((await admin.post('/api/lab/comparison',{data:{}})).status(),405);
 const payload=(newer)=>({tests:[{label:'Test A',morning:newer?20:10,evening:newer?10:5,night:newer?5:0},{label:'Test B',morning:0,evening:0,night:0},{label:'Test C',morning:newer?2:5,evening:0,night:0}],patients:{morning:newer?4:2,evening:newer?3:2,night:1},outsource:{patients:0,tests:0},urgent:{morning:{patients:0,tests:0},evening:{patients:0,tests:0},night:{patients:0,tests:0}}});
 for(const [start,end,newer]of[['2025-05-01','2025-05-31',false],['2025-06-01','2025-06-30',true]]){
  const response=await admin.post('/api/lab/reports',{data:{laboratory_name:lab,period_kind:'month',period_start:start,period_end:end,source_label:'Synthetic browser comparison fixture',entry_mode:'historical_import',payload:payload(newer)}});assert.equal(response.status(),200);ids.push((await response.json()).report.id);
 }
 const response=await admin.get(path);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);const data=await response.json();
 assert.equal(data.totals[0].current,37);assert.equal(data.totals[0].previous,20);assert.equal(data.totals[0].change,17);assert.equal(data.totals[0].percent,85);
 assert.equal(data.tests.find(r=>r.label==='Test C').percent,-60);assert.equal(data.shifts.find(r=>r.shift==='night').tests.status,'new_activity');assert.equal(data.shifts.find(r=>r.shift==='night').tests.percent,null);
 const limited=await(await operator.get(path)).json();assert.equal(limited.current.found,false);assert.equal(limited.previous.found,false);assert.equal(limited.totals[0].current,null);
 checks.push('Anonymous/unrelated roles denied, assigned lab scope preserved, API is read-only and private/no-store');
 const absent=await(await admin.get(path+'&mode=previous_year')).json();assert.equal(absent.previous.found,false);assert.equal(absent.totals[0].percent,null);
 const overlap=await admin.get(path+'&mode=custom&previous_start=2025-06-01&previous_end=2025-06-30');assert.equal(overlap.status(),400);
 checks.push('Actual SQL sources reconcile increases/decreases/zero baseline; absent and overlapping periods never fabricate growth');
 for(const [endpoint,file]of[[path+'&format=xlsx','comparison.xlsx'],['/api/lab/summary?'+new URLSearchParams({kind:'month',start:'2025-06-01',end:'2025-06-30',laboratory_name:lab,format:'xlsx'}),'default.xlsx']]){
  const result=await admin.get(endpoint);assert.equal(result.status(),200);const buffer=await result.body();fs.writeFileSync(out+'/'+file,buffer,{mode:0o600});
  const sheets=await readXlsx(buffer);assert.equal(sheets.length,file==='comparison.xlsx'?4:3);
  if(file==='comparison.xlsx'){const sheet=sheets.find(s=>s.sheet==='Period comparison');assert(sheet);const decreased=sheet.data.find(r=>r[0]==='Test C');assert(decreased);assert.equal(decreased[3],-3);assert.equal(decreased[4],-60);}
 }
 const context=await browser.newContext({storageState:await admin.storageState(),viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/lab/reports?'+new URLSearchParams({kind:'month',start:'2025-06-01',end:'2025-06-30',laboratory_name:lab}));
 const total=page.getByRole('table',{name:'Overall volume comparison'}).getByRole('row').filter({hasText:'Reported tests'});await total.waitFor();assert.match(await total.innerText(),/\+85\.00%/);
 await page.getByLabel('Comparison test search').fill('Test C');const decrease=page.getByRole('table',{name:'Test volume comparison'}).getByRole('row').filter({hasText:'Test C'});assert.match(await decrease.innerText(),/-60\.00%/);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Comparison CSV',exact:true}).click();await(await download).saveAs(out+'/comparison.csv');const csv=fs.readFileSync(out+'/comparison.csv','utf8');assert(csv.includes('"-3","-60"'));assert(!csv.includes('"\'-3"'));
 await page.getByLabel('Comparison test search').fill('');await page.getByLabel('Comparison mode').selectOption('previous_year');await page.getByText('Comparison ke liye dono periods ka source data chahiye.',{exact:false}).waitFor();assert.equal(await page.getByRole('table',{name:'Test volume comparison'}).count(),0);
 await page.getByLabel('Comparison mode').selectOption('custom');await page.getByLabel('Comparison from date').fill('2025-06-01');await page.getByLabel('Comparison to date').fill('2025-06-30');await page.getByText('Comparison ke liye alag, non-overlapping period chunein.').waitFor();
 await page.getByLabel('Comparison mode').selectOption('previous_period');await total.waitFor();assert.match(await total.innerText(),/\+85\.00%/);
 await page.screenshot({path:out+'/comparison-synthetic-desktop.png',fullPage:true});await page.pdf({path:out+'/comparison-synthetic.pdf',format:'A4',landscape:true,printBackground:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:out+'/comparison-synthetic-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await context.close();checks.push('Browser comparison modes, exact ranges, table search, negative CSV, print/PDF and responsive layout pass without browser errors');
 fs.writeFileSync(out+'/results.json',JSON.stringify({checks,source:'Synthetic fixtures in disposable local database only',liveDatabaseChanged:false,accountsCreated:0},null,2),{mode:0o600});checks.forEach(check=>console.log('PASS:',check));
}finally{
 if(ids.length){await db.query('delete from public.kawt_lab_audit where report_id=any($1::uuid[])',[ids]);await db.query('delete from public.kawt_lab_reports where id=any($1::uuid[])',[ids]);}
 for(const context of contexts)await context.dispose();await browser.close();await db.end();
}
