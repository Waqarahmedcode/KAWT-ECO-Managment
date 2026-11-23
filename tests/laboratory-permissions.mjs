import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { parse } from 'dotenv';

const envPath = process.env.KAWT_INITIALIZATION_LOCAL_ENV;
if (!envPath) throw new Error('Existing isolated local configuration required');
const bindings = parse(fs.readFileSync(envPath));
const root = new URL(bindings.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(root.hostname)) throw new Error('Lab validation refuses remote targets');
const admin = new Client({ connectionString: root.toString() });await admin.connect();
const name = 'kawt_init_validation_' + Date.now(), target = new URL(root);target.pathname = '/' + name;
let client, keep = false;
const actor = { admin: randomUUID(), operator: randomUUID(), viewer: randomUUID(), outsider: randomUUID(), doctor: randomUUID(), partner: randomUUID() };
const accountFile = process.env.KAWT_LAB_EXISTING_ACCOUNTS;
if (accountFile) {
 const existing = JSON.parse(fs.readFileSync(accountFile));
 actor.admin = existing.find(a => a.role === 'admin').user_id;
 actor.operator = existing.find(a => a.role === 'donor').user_id;
}
try {
 await admin.query('create database "' + name + '"');
 client = new Client({ connectionString: target.toString() });await client.connect();
 await client.query("create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,confirmation_sent_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage,auth to anon,authenticated;grant select,insert,update,delete on storage.objects,storage.buckets to anon,authenticated");
 await client.end();client = undefined;
 const env = { ...process.env, KAWT_READINESS_DATABASE_URL: target.toString(), KAWT_INITIALIZE_PROJECT_REF: 'local-test' };
 for (const script of ['scripts/initialize-database.mjs', 'scripts/initialize-laboratory.mjs', 'scripts/initialize-laboratory.mjs']) {
  const result = spawnSync('node', ['--import', 'tsx', script], { env, encoding: 'utf8', timeout: 60000 });
  process.stdout.write(result.stdout);assert.equal(result.status, 0, result.stderr);
 }
 client = new Client({ connectionString: target.toString() });await client.connect();
 for (const [role, id] of Object.entries(actor)) {
  await client.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, role + '@isolated.invalid']);
  await client.query('update public.profiles set role=$1 where id=$2', [role === 'admin' ? 'admin' : role === 'doctor' ? 'doctor' : 'donor', id]);
 }
 const as = async (id, operation, dbRole = 'authenticated') => {
  await client.query('BEGIN');await client.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);await client.query('SET LOCAL ROLE ' + dbRole);
  try { const result = await operation();await client.query('COMMIT');return result; }
  catch (error) { await client.query('ROLLBACK');throw error; }
 };
 await as(actor.admin, async () => {
  for (const [role, access] of [['operator', 'operator'], ['viewer', 'viewer']]) await client.query('insert into public.kawt_lab_access(user_id,access,granted_by) values($1,$2,$3)', [actor[role], access, actor.admin]);
 });
 const payload = {
  tests: [{ label: 'CBC', morning: 5, evening: 3, night: 1 }],
  patients: { morning: 2, evening: 1, night: 1 },
  outsource: { patients: 1, tests: 2 },
  urgent: { morning: { patients: 1, tests: 1 }, evening: { patients: 0, tests: 0 }, night: { patients: 0, tests: 0 } },
 };
 const report = await as(actor.admin, async () => (await client.query("insert into public.kawt_lab_reports(period_kind,period_start,period_end,source_label,entry_mode,payload,created_by,updated_by) values('month','2026-07-01','2026-07-31','Isolated permission test','historical_import',$1,$2,$2) returning *", [JSON.stringify(payload), actor.admin])).rows[0]);
 assert.equal(report.revision, 1);
 for (const role of ['operator', 'viewer', 'outsider', 'doctor']) {
  const result = await as(actor[role], async () => (await client.query('select id from public.kawt_lab_reports')).rowCount);
  assert.equal(result, ['operator', 'viewer'].includes(role) ? 1 : 0, role);
 }
 await assert.rejects(as(null, () => client.query('select * from public.kawt_lab_reports'), 'anon'), e => e.code === '42501');
 assert.equal(await as(actor.viewer, async () => (await client.query("update public.kawt_lab_reports set source_label='forbidden' where id=$1", [report.id])).rowCount), 0);
 assert.equal(await as(actor.operator, async () => (await client.query("update public.kawt_lab_access set access='operator',active=true where user_id=$1", [actor.operator])).rowCount), 0);
 await assert.rejects(as(actor.operator, () => client.query('delete from public.kawt_lab_reports where id=$1', [report.id])), e => e.code === '42501');
 await assert.rejects(as(actor.operator, () => client.query("insert into public.kawt_lab_audit(actor_id,action,current_value) values($1,'fake','{}')", [actor.operator])), e => e.code === '42501');
 console.log('PASS: anonymous/nonmember/unrelated staff denied; operator and viewer read; viewer writes, operator self-grant, record deletion and forged audit denied.');
 const changed = structuredClone(payload);changed.tests[0].morning = 6;changed.tests[0].evening = null;
 const updated = await as(actor.operator, async () => (await client.query('update public.kawt_lab_reports set payload=$1 where id=$2 and revision=1 returning revision,updated_by,payload', [JSON.stringify(changed), report.id])).rows[0]);
 assert.equal(updated.revision, 2);assert.equal(updated.updated_by, actor.operator);assert.equal(updated.payload.tests[0].evening, null);
 assert.equal(await as(actor.operator, async () => (await client.query('update public.kawt_lab_reports set payload=$1 where id=$2 and revision=1', [JSON.stringify(payload), report.id])).rowCount), 0);
 const audit = await as(actor.operator, async () => (await client.query('select previous,current_value from public.kawt_lab_audit where report_id=$1 order by id', [report.id])).rows);
 assert.equal(audit.length, 2);assert.equal(audit[1].previous.payload.tests[0].morning, 5);assert.equal(audit[1].current_value.payload.tests[0].morning, 6);
 await assert.rejects(as(actor.operator, () => client.query("update public.kawt_lab_reports set period_start='2026-07-02' where id=$1", [report.id])), e => e.code === '23514');
 const invalid = structuredClone(payload);invalid.tests[0].night = -1;
 await assert.rejects(as(actor.operator, () => client.query('update public.kawt_lab_reports set payload=$1 where id=$2', [JSON.stringify(invalid), report.id])), e => e.code === 'P0001');
 await as(actor.admin, () => client.query('update public.kawt_lab_access set active=false where user_id=$1', [actor.operator]));
 assert.equal(await as(actor.operator, async () => (await client.query('select id from public.kawt_lab_reports')).rowCount), 0);
 await as(actor.admin, () => client.query('update public.kawt_lab_access set active=true where user_id=$1', [actor.operator]));
 console.log('PASS: corrected records preserve original audit; stale revision cannot overwrite; invalid dates/counts rejected; missing counts stay null; revoked lab access stops reads.');
 const blank = { tests:[{label:'CBC',morning:null,evening:null,night:null}],patients:{morning:null,evening:null,night:null},outsource:{patients:null,tests:null},urgent:{morning:{patients:null,tests:null},evening:{patients:null,tests:null},night:{patients:null,tests:null}} };
 await assert.rejects(as(actor.operator, () => client.query('update public.kawt_lab_reports set payload=$1 where id=$2',[JSON.stringify(blank),report.id])), e=>e.code==='23514');
 blank.tests[0].morning=0;
 await as(actor.operator, () => client.query('update public.kawt_lab_reports set payload=$1 where id=$2',[JSON.stringify(blank),report.id]));
 await as(actor.admin, () => client.query('insert into public.kawt_lab_access(user_id,access,granted_by,laboratory_name) values($1,$2,$3,$4)',[actor.partner,'operator',actor.admin,'Isolated partner lab']));
 const partnerReport = await as(actor.partner, async () => (await client.query("insert into public.kawt_lab_reports(laboratory_name,period_kind,period_start,period_end,source_label,entry_mode,payload,created_by,updated_by) values('Isolated partner lab','day','2026-07-01','2026-07-01','Isolated scope test','manual',$1,$2,$2) returning id",[JSON.stringify(payload),actor.partner])).rows[0]);
 assert.equal(await as(actor.operator,async()=>(await client.query('select id from public.kawt_lab_reports where id=$1',[partnerReport.id])).rowCount),0);
 assert.equal(await as(actor.partner,async()=>(await client.query('select id from public.kawt_lab_reports where id=$1',[report.id])).rowCount),0);
 assert.equal(await as(actor.partner,async()=>(await client.query('select id from public.kawt_lab_audit where report_id=$1',[report.id])).rowCount),0);
 await assert.rejects(as(actor.partner,()=>client.query('update public.kawt_lab_reports set laboratory_name=$1 where id=$2',['Khidmat-e-Alam Diagnostic Centre',partnerReport.id])),e=>e.code==='42501');
 const pkg = await as(actor.admin,async()=>(await client.query("insert into public.kawt_mc_packages(name,components,source_label,created_by,updated_by) values('Isolated package',array['CBC'],'Isolated permissions fixture',$1,$1) returning id",[actor.admin])).rows[0]);
 await as(actor.admin,()=>client.query("insert into public.kawt_mc_prices(package_id,valid_from,amount_minor,currency,source_label,created_by) values($1,'2026-07-01',12345,'PKR','Isolated permissions fixture',$2)",[pkg.id,actor.admin]));
 assert.equal(await as(actor.operator,async()=>(await client.query('select id from public.kawt_mc_packages')).rowCount),1);
 assert.equal(await as(actor.partner,async()=>(await client.query('select id from public.kawt_mc_packages')).rowCount),0);
 assert.equal(await as(actor.partner,async()=>(await client.query('select id from public.kawt_mc_prices')).rowCount),0);
 console.log('PASS: blank reports rejected, explicit zero accepted; partner lab records, correction history and main-centre package rates remain scoped.');
 // A disposable test database may be retained briefly for authenticated local
 // browser checks against already-existing local Auth fixtures. No new Auth
 // service users or product-database business records are created.
 if (process.env.KAWT_LAB_KEEP_TEST_DB === '1') {
  fs.mkdirSync('.local', { recursive: true, mode: 0o700 });
  fs.writeFileSync('.local/laboratory-test.env', Object.entries({ ...bindings, DATABASE_URL: target.toString(), NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3012' }).map(([k, v]) => k + '=' + JSON.stringify(v)).join('\n'), { mode: 0o600 });
  fs.writeFileSync('.local/laboratory-test-database.json', JSON.stringify({ database: name, actors: actor, reportId: report.id }), { mode: 0o600 });
  keep = true;
 }
} finally {
 await client?.end().catch(() => {});
 if (!keep) await admin.query('drop database if exists "' + name + '" with (force)');
 await admin.end();
}
