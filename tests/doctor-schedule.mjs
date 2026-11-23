import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'dotenv';
import { Client } from 'pg';
import { chromium, request } from '@playwright/test';

const bindings = parse(fs.readFileSync(process.env.KAWT_INITIALIZATION_LOCAL_ENV || '.local/laboratory-test.env'));
const root = new URL(bindings.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(root.hostname)) throw Error('Local validation backend required');
const accounts = JSON.parse(fs.readFileSync(process.env.KAWT_LAB_EXISTING_ACCOUNTS));
const owner = accounts.find(a => a.role === 'admin');
assert(owner?.user_id && owner.email, 'Existing isolated Auth fixture required');
const name = 'kawt_init_validation_' + Date.now(), target = new URL(root);
target.pathname = '/' + name;
const admin = new Client({ connectionString: root.toString() });
await admin.connect();
let db, server, browser;
const contexts = [], checks = [];
const base = 'http://127.0.0.1:3017';
const env = { ...process.env, ...bindings, DATABASE_URL: target.toString(), KAWT_READINESS_DATABASE_URL: target.toString(), KAWT_INITIALIZE_PROJECT_REF: 'local-test', KAWT_FIRST_ADMIN_EMAIL: owner.email, KAWT_IMPORT_DOCTOR_SCHEDULE: '1', NEXT_PUBLIC_SITE_URL: base, NEXT_TELEMETRY_DISABLED: '1' };
const run = (script, extra = {}) => spawnSync(process.execPath, ['--import', 'tsx', script], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 60000 });
try {
 await admin.query('create database "' + name + '"');
 db = new Client({ connectionString: target.toString() });await db.connect();
 await db.query("create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,confirmation_sent_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage,auth to anon,authenticated;grant select,insert,update,delete on storage.objects,storage.buckets to anon,authenticated");
 for (const script of ['scripts/initialize-database.mjs', 'scripts/initialize-laboratory.mjs']) {
  const result = run(script);assert.equal(result.status, 0, result.stdout + result.stderr);
 }
 for (const account of accounts) {
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [account.user_id, account.email]);
  await db.query('update public.profiles set role=$1 where id=$2', [account.role, account.user_id]);
 }
 const noOwner = run('scripts/import-doctor-schedule.mjs', { KAWT_FIRST_ADMIN_EMAIL: 'unconfigured@isolated.invalid' });
 assert.equal(noOwner.status, 1);assert.match(noOwner.stdout, /VERIFIED_OWNER_ADMIN_REQUIRED/);
 assert.equal((await db.query('select count(*)::int as n from public.kawt_mc_doctors')).rows[0].n, 0);
 const wrongTarget = run('scripts/import-doctor-schedule.mjs', { KAWT_INITIALIZE_PROJECT_REF: 'other-project' });
 assert.equal(wrongTarget.status, 1);assert.match(wrongTarget.stdout, /TARGET_NOT_APPROVED/);
 checks.push('Unverified/missing owner and other project fail without importing records');
 const imported = run('scripts/import-doctor-schedule.mjs');assert.equal(imported.status, 0, imported.stdout + imported.stderr);
 assert.match(imported.stdout, /"created":15/);
 const source = (await db.query('select * from public.kawt_mc_doctors order by service_group,name')).rows;
 assert.equal(source.length, 15);assert.equal(source.filter(d => d.service_group === 'OPD').length, 11);assert.equal(source.filter(d => d.service_group === 'URGENT_CARE').length, 4);
 assert(source.every(d => d.status === 'draft' && d.effective_date === null));
 assert.equal((await db.query('select count(*)::int as n from public.kawt_mc_prices')).rows[0].n, 0);
 assert.equal((await db.query('select count(*)::int as n from public.kawt_mc_audit')).rows[0].n, 15);
 checks.push('Exactly 11 OPD and 4 Urgent Care source drafts imported with audit; no prices, billing or guessed dates');
 await db.query('BEGIN');await db.query('SET LOCAL ROLE authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner.user_id]);
 await db.query("update public.kawt_mc_doctors set notes=notes||' Local correction preserved.' where id=$1", [source[0].id]);await db.query('COMMIT');
 const repeated = run('scripts/import-doctor-schedule.mjs');assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);assert.match(repeated.stdout, /already_imported/);
 assert.equal((await db.query('select count(*)::int as n from public.kawt_mc_doctors')).rows[0].n, 15);
 assert.match((await db.query('select notes from public.kawt_mc_doctors where id=$1', [source[0].id])).rows[0].notes, /Local correction preserved/);
 checks.push('Repeat import does not duplicate doctors or overwrite audited staff corrections');
 server = spawn(process.execPath, ['node_modules/next/dist/bin/next', process.env.KAWT_SCHEDULE_PRODUCTION === '1' ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3017'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
 let serverError = '';server.stderr.on('data', data => { serverError = (serverError + data).slice(-3000); });
 const anon = await request.newContext({ baseURL: base });contexts.push(anon);
 for (let i = 0; i < 90; i++) { try { if ((await anon.get('/login', { timeout: 2000 })).status() === 200) break; } catch {} if (server.exitCode !== null) throw Error('Local server exited');if (i === 89) throw Error('Local server unavailable');await delay(500); }
 assert.equal((await anon.get('/api/medical-centre')).status(), 401);
 const login = async role => { const account = accounts.find(a => a.role === role), api = await request.newContext({ baseURL: base });contexts.push(api);assert.equal((await api.post('/api/auth/session', { data: { action: 'signin', email: account.email, password: account.password } })).status(), 200);return api; };
 const ownerApi = await login('admin'), operatorApi = await login('donor');
 const payload = JSON.parse(fs.readFileSync('data/doctor-schedule-source.json'));
 assert.equal((await operatorApi.post('/api/medical-centre/import', { data: payload })).status(), 403);
 assert.equal((await ownerApi.post('/api/medical-centre/import', { data: payload })).status(), 409);
 const invalid = structuredClone(payload);invalid.items[0].status = 'active';
 assert.equal((await ownerApi.post('/api/medical-centre/import', { data: invalid })).status(), 400);
 const duplicate = structuredClone(payload);duplicate.items.push(duplicate.items[0]);
 assert.equal((await ownerApi.post('/api/medical-centre/import', { data: duplicate })).status(), 400);
 checks.push('Live route authentication, role limits, duplicate-source conflict and source validation pass locally');
 browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
 const context = await browser.newContext({ storageState: await ownerApi.storageState(), viewport: { width: 1440, height: 1050 } }), page = await context.newPage(), errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(base + '/medical-centre');const table = page.getByRole('table', { name: 'Doctor source schedule' });await table.waitFor();
 await page.getByRole('heading', { name: 'Dr. Ishwar Lohana', exact: true }).waitFor();
 assert.equal(await table.locator('tbody tr').count(), 11);
 assert((await table.innerText()).includes('Rs. 1,000'));
 assert(await page.getByRole('button', { name: 'Source schedule import ho chuka' }).isDisabled());
 await page.getByRole('button', { name: '24/7 Emergency doctors' }).click();assert.equal(await table.locator('tbody tr').count(), 4);assert((await table.innerText()).includes('Alternate Nights'));
 await page.getByRole('button', { name: 'OPD doctors', exact: true }).click();
 fs.mkdirSync('/workspace/KAWT-current-preview', { recursive: true });
 await page.screenshot({ path: '/workspace/KAWT-current-preview/doctor-schedule-import-local.png', fullPage: true });
 await page.setViewportSize({ width: 390, height: 844 });assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
 assert.deepEqual(errors, []);await context.close();
 checks.push('Browser OPD/Urgent tables, reference fees, repeat-import state and mobile layout pass');
 fs.writeFileSync('docs/DOCTOR-SCHEDULE-VALIDATION-2026-11-23.json', JSON.stringify({ checks, productionRuntime: process.env.KAWT_SCHEDULE_PRODUCTION === '1', source: 'Owner-provided public professional schedule, tested in a disposable local database', liveDatabaseChanged: false, authAccountsCreated: 0, sourceDoctors: 15, automaticBilling: false }, null, 2) + '\n');
 checks.forEach(check => console.log('PASS: ' + check));
} finally {
 for (const context of contexts) await context.dispose();await browser?.close();
 if (server && server.exitCode === null) { server.kill('SIGTERM');await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(5000)]); }
 await db?.end().catch(() => {});
 await admin.query('drop database if exists "' + name + '" with (force)');await admin.end();
}
