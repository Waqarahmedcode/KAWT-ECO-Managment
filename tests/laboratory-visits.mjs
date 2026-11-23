import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'dotenv';
import { Client } from 'pg';
import { chromium, request } from '@playwright/test';
import readXlsx from 'read-excel-file/node';

const bindings = parse(fs.readFileSync('.local/laboratory-test.env')), root = new URL(bindings.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(root.hostname)) throw Error('Isolated local backend required');
const accounts = JSON.parse(fs.readFileSync(process.env.KAWT_LAB_EXISTING_ACCOUNTS));
const owner = accounts.find(a => a.role === 'admin'), operator = accounts.find(a => a.role === 'donor'), viewer = accounts.find(a => a.role === 'csr_partner'), partner = accounts.find(a => a.role === 'pharmacist');
assert(owner && operator && viewer && partner, 'Existing local Auth fixtures required');
const name = 'kawt_init_validation_' + Date.now(), target = new URL(root);target.pathname = '/' + name;
const admin = new Client({ connectionString: root.toString() });await admin.connect();
const base = 'http://127.0.0.1:3018', mainLab = 'Khidmat-e-Alam Diagnostic Centre', otherLab = 'Isolated partner department';
const env = { ...process.env, ...bindings, DATABASE_URL: target.toString(), KAWT_READINESS_DATABASE_URL: target.toString(), KAWT_INITIALIZE_PROJECT_REF: 'local-test', KAWT_FIRST_ADMIN_EMAIL: owner.email, NEXT_PUBLIC_SITE_URL: base, NEXT_TELEMETRY_DISABLED: '1' };
const contexts = [], checks = [], ids = [];
const catalogue = JSON.parse(fs.readFileSync('data/laboratory-catalogue.json')), urine = catalogue.find(row => row.label.toLowerCase().includes('urine')).label;
let db, server, browser;
try {
 await admin.query('create database "' + name + '"');db = new Client({ connectionString: target.toString() });await db.connect();
 await db.query("create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,confirmation_sent_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage,auth to anon,authenticated;grant select,insert,update,delete on storage.objects,storage.buckets to anon,authenticated");
 for (const script of ['scripts/initialize-database.mjs', 'scripts/initialize-laboratory.mjs', 'scripts/initialize-laboratory.mjs']) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script], { env, encoding: 'utf8', timeout: 60000 });assert.equal(result.status, 0, result.stdout + result.stderr);
 }
 for (const account of accounts) {
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [account.user_id, account.email]);
  await db.query('update public.profiles set role=$1 where id=$2', [[viewer.user_id, partner.user_id].includes(account.user_id) ? 'donor' : account.role, account.user_id]);
 }
 const as = async (id, operation) => { await db.query('BEGIN');await db.query('SET LOCAL ROLE authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);try { const result = await operation();await db.query('COMMIT');return result; } catch (error) { await db.query('ROLLBACK');throw error; } };
 await as(owner.user_id, async () => { for (const [account, access, lab] of [[operator, 'operator', mainLab], [viewer, 'viewer', mainLab], [partner, 'operator', otherLab]]) await db.query('insert into public.kawt_lab_access(user_id,access,laboratory_name,granted_by) values($1,$2,$3,$4)', [account.user_id, access, lab, owner.user_id]); });
 server = spawn(process.execPath, ['node_modules/next/dist/bin/next', process.env.KAWT_VISITS_PRODUCTION === '1' ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3018'], { env, stdio: ['ignore', 'ignore', 'ignore'] });
 const anon = await request.newContext({ baseURL: base });contexts.push(anon);
 for (let i = 0; i < 90; i++) { try { if ((await anon.get('/login', { timeout: 2000 })).status() === 200) break; } catch {} if (server.exitCode !== null) throw Error('Local server exited');if (i === 89) throw Error('Local server unavailable');await delay(500); }
 const login = async account => { const api = await request.newContext({ baseURL: base });contexts.push(api);assert.equal((await api.post('/api/auth/session', { data: { action: 'signin', email: account.email, password: account.password } })).status(), 200);return api; };
 const ownerApi = await login(owner), staff = await login(operator), readOnly = await login(viewer), other = await login(partner), unrelated = await login(accounts.find(a => a.role === 'doctor'));
 const range = new URLSearchParams({ start: '2026-02-01', end: '2026-02-01', laboratory_name: mainLab });
 const summaryPath = '/api/lab/visits/summary?' + range;
 const summary = async () => { const response = await staff.get(summaryPath);assert.equal(response.status(), 200);return response.json(); };
 assert.equal((await anon.get('/api/lab/visits?' + range)).status(), 401);assert.equal((await anon.get(summaryPath)).status(), 401);
 assert.equal((await unrelated.get(summaryPath)).status(), 403);
 assert.equal((await staff.get('/api/lab/entry-settings')).status(), 200);assert.equal((await(await staff.get('/api/lab/entry-settings')).json()).settings, null);
 const record = (extra = {}) => ({ id: randomUUID(), laboratory_name: mainLab, patient_name: 'Synthetic confidential person', patient_reference: 'Isolated reference', occurred_at: '2026-01-31T19:01:00.000Z', shift: 'evening', referral_source: 'MOU', referral_name: 'Isolated partner', payment_category: 'panel', panel_name: 'Isolated welfare panel', tests: [{ label: 'CBC', amount_minor: null, quantity: 2 }, { label: urine, amount_minor: 0, quantity: 1 }], notes: 'Isolated local validation only', voided: false, ...extra });
 const save = async (value, expected = 200, api = staff) => { const response = await api.post('/api/lab/visits', { data: value });assert.equal(response.status(), expected, expected === 200 ? await response.text() : 'Unexpected entry status');return response.json(); };
 const first = record();assert.equal((await staff.post('/api/lab/visits',{data:first,headers:{Origin:'https://untrusted.invalid'}})).status(),403);let current = (await save(first)).visit;ids.push(first.id);
 assert.equal(current.service_date, '2026-02-01');assert.equal(current.shift, 'evening');assert.equal(current.automatic_shift, false);assert.equal(current.tests[0].amount_minor, null);
 assert.equal((await save(first)).already_saved, true);assert.equal((await summary()).visits, 1);assert.equal((await summary()).tests_count, 3);
 checks.push('Patient visits counted independently of test quantity; exact Pakistan day, unknown prices and idempotent save preserved');
 const settings = { laboratory_name: mainLab, valid_from: '2026-01-01', shift_starts: { morning: '08:00', evening: '14:00', night: '20:00' }, reference_prices: [{ label: 'CBC', amount_minor: 12345 }] };
 assert.equal((await staff.post('/api/lab/entry-settings', { data: settings })).status(), 403);
 assert.equal((await ownerApi.post('/api/lab/entry-settings', { data: settings })).status(), 200);
 const urgent = record({ referral_source: 'URGENT_CARE', referral_name: '', payment_category: 'free', panel_name: '', occurred_at: '2026-01-31T21:00:00Z', tests: [{ label: 'CBC', amount_minor: 0, quantity: 1 }] });
 const urgentRecord = (await save(urgent)).visit;ids.push(urgent.id);assert.equal(urgentRecord.shift, 'night');assert.equal(urgentRecord.automatic_shift, true);
 const morning = record({ referral_source: 'IN_HOUSE', referral_name: '', payment_category: 'paid', panel_name: '', occurred_at: '2026-02-01T03:00:00Z', shift: 'night', tests: [{ label: 'CBC', amount_minor: 12345, quantity: 1 }] });
 const morningRecord = (await save(morning)).visit;ids.push(morning.id);assert.equal(morningRecord.shift, 'morning');assert.equal(morningRecord.service_date, '2026-02-01');
 let report = await summary();assert.equal(report.visits, 3);assert.equal(report.tests_count, 5);assert.equal(report.referrals.find(r => r.source === 'MOU').tests_count, 3);assert.equal(report.referrals.find(r => r.source === 'URGENT_CARE').tests_count, 1);
 const sourcePayload = { tests: [{ label: 'CBC', morning: 10000, evening: 0, night: 0 }], patients: { morning: 700, evening: 0, night: 0 }, outsource: { patients: 0, tests: 0 }, urgent: { morning: { patients: 0, tests: 0 }, evening: { patients: 0, tests: 0 }, night: { patients: 0, tests: 0 } } };
 assert.equal((await ownerApi.post('/api/lab/reports', { data: { laboratory_name: mainLab, period_kind: 'day', period_start: '2026-02-01', period_end: '2026-02-01', source_label: 'Synthetic aggregate intentionally overlaps entry date', entry_mode: 'manual', payload: sourcePayload } })).status(), 200);
 assert.equal((await summary()).tests_count, 5);
 checks.push('Configured shifts override incorrect input, midnight stays on its true date, referral/panel subsets and overlapping aggregates never inflate entry totals');
 assert.equal((await readOnly.get('/api/lab/visits?' + range)).status(), 403);
 const viewerSummary = await readOnly.get(summaryPath);assert.equal(viewerSummary.status(), 200);assert(!(await viewerSummary.text()).includes('confidential'));
 assert.equal((await other.get('/api/lab/visits?id=' + first.id)).status(), 404);assert.equal((await other.get(summaryPath)).status(), 403);
 assert.equal(await as(viewer.user_id, async () => (await db.query('select id from public.kawt_lab_visits')).rowCount), 0);
 assert.equal(await as(partner.user_id, async () => (await db.query('select id from public.kawt_lab_entry_audit')).rowCount), 0);
 await assert.rejects(as(operator.user_id, () => db.query('delete from public.kawt_lab_visits where id=$1', [first.id])), error => error.code === '42501');
 assert.equal(await as(operator.user_id, async () => (await db.query("update public.kawt_lab_entry_settings set reference_prices='[]'")).rowCount), 0);
 const invalidTests = [{ label: 'CBC', amount_minor: null, quantity: 0 }];
 await assert.rejects(as(operator.user_id, () => db.query('update public.kawt_lab_visits set tests=$1 where id=$2', [JSON.stringify(invalidTests), first.id])), error => error.code === '23514');
 checks.push('Viewer sees aggregates only; unrelated/partner staff cannot access identities or audit; SQL rejects deletion, configuration writes and invalid quantities');
 const correction = { ...first, revision: current.revision, patient_name: 'Synthetic confidential corrected', tests: [{ label: 'CBC', amount_minor: null, quantity: 3 }, { label: urine, amount_minor: 0, quantity: 1 }] };
 current = (await save(correction)).visit;assert.equal(current.revision, 2);assert.equal(current.shift, 'evening');assert.equal(current.automatic_shift, false);assert.equal(current.tests[0].amount_minor, null);
 await save(correction, 409);
 const history = await(await staff.get('/api/lab/visits?id=' + first.id)).json();assert.equal(history.history.length, 2);assert.equal(history.history[0].previous.tests[0].quantity, 2);
 const voidInput = { ...urgent, revision: urgentRecord.revision, shift: urgentRecord.shift, voided: true, notes: 'Cancelled duplicate in isolated test' };
 const cancelled = (await save(voidInput)).visit;report = await summary();assert.equal(report.visits, 2);assert.equal(report.tests_count, 5);
 await save({ ...voidInput, revision: cancelled.revision, voided: false });assert.equal((await summary()).visits, 3);
 const concurrent = record({ referral_source: 'EXTERNAL', referral_name: 'Isolated external referrer', payment_category: 'paid', panel_name: '', tests: [{ label: 'CBC', amount_minor: null, quantity: 1 }] });
 const results = await Promise.all([save(concurrent), save(concurrent)]);ids.push(concurrent.id);assert.equal(results.filter(r => r.already_saved).length, 1);assert.equal((await summary()).visits, 4);assert.equal((await summary()).tests_count, 7);
 await save({ ...record(), patient_name: '', patient_reference: '' }, 400);await save({ ...record(), occurred_at: new Date(Date.now() + 3600000).toISOString() }, 400);
 checks.push('Corrections retain audit/old shift/rate snapshots; stale revisions fail; cancellation is reversible; concurrent retries create one visit');
 const exported = await staff.get(summaryPath + '&format=xlsx');assert.equal(exported.status(), 200);assert.match(exported.headers()['cache-control'], /private.*no-store/);
 const sheets = await readXlsx(await exported.body());assert.equal(sheets.length, 3);assert(!JSON.stringify(sheets).includes('confidential'));assert(sheets.find(s => s.sheet === 'Referrals').data.some(row => row[0] === 'MOU'));
 assert.equal((await staff.get('/api/lab/visits/summary?' + new URLSearchParams({ start: '2026-01-31', end: '2026-01-31' }) + '&format=xlsx')).status(), 404);
 checks.push('Real Excel reopens, includes MOU subsets, excludes patient identities and never invents an empty daily source');
 browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
 const context = await browser.newContext({ storageState: await staff.storageState(), viewport: { width: 1440, height: 1050 } }), page = await context.newPage(), errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(base + '/lab');await page.getByRole('heading', { name: 'Patient aur test entry', exact: true }).waitFor();assert(page.url().endsWith('/lab/visits'));
 assert.equal(await page.getByRole('link', { name: 'Overall dashboard', exact: true }).count(), 0);assert.equal(await page.getByText('Admin: shift hours aur reference prices', { exact: true }).count(), 0);
 await page.getByLabel('Entry time mode').selectOption('historical');await page.getByLabel('Visit date', { exact: true }).fill('2026-02-01');await page.getByLabel('Visit time', { exact: true }).fill('03:30');
 assert.equal(await page.getByLabel('Visit shift', { exact: true }).inputValue(), 'night');assert(await page.getByLabel('Visit shift', { exact: true }).isDisabled());
 await page.getByLabel('Patient name', { exact: true }).fill('Synthetic browser person');await page.getByLabel('Find catalogue test').fill('CBC');await page.getByLabel('Choose test CBC', { exact: true }).check();
 assert.equal(await page.getByLabel('CBC reference price', { exact: true }).inputValue(), '123.45');await page.getByLabel('Visit date', { exact: true }).fill('2025-12-31');assert.equal(await page.getByLabel('CBC reference price', { exact: true }).inputValue(), '');assert(!(await page.getByLabel('Visit shift', { exact: true }).isDisabled()));await page.getByLabel('Visit date', { exact: true }).fill('2026-02-01');assert.equal(await page.getByLabel('CBC reference price', { exact: true }).inputValue(), '123.45');await page.getByLabel('CBC quantity', { exact: true }).fill('2');
 await page.getByLabel('Entry report from').fill('2026-02-01');await page.getByLabel('Entry report to').fill('2026-02-01');
 await page.getByRole('button', { name: 'Patient aur tests save karein', exact: true }).click();await page.getByRole('status').waitFor({timeout:10000});assert.match(await page.getByRole('status').innerText(),/Entry save ho gayi/);
 const savedTable = page.getByRole('table', { name: 'Saved patient entries', exact: true });await savedTable.getByRole('row').filter({ hasText: 'Synthetic browser person' }).waitFor();assert.equal((await summary()).visits, 5);assert.equal((await summary()).tests_count, 9);
 await savedTable.getByRole('row').filter({ hasText: 'Synthetic browser person' }).getByRole('button', { name: 'Edit', exact: true }).click();await page.getByRole('heading', { name: 'Entry durust karein', exact: true }).waitFor();await page.getByLabel('CBC quantity', { exact: true }).fill('3');await page.getByRole('button', { name: 'Correction save karein', exact: true }).click();await page.getByRole('status').filter({ hasText: 'Entry save ho gayi' }).waitFor();assert.equal((await summary()).visits, 5);assert.equal((await summary()).tests_count, 10);
 // The first POST commits, but its response is lost. A retry must use the same
 // entry identity/time and load the saved record instead of duplicating it.
 await page.getByLabel('Patient name', { exact: true }).fill('Synthetic uncertain response');await page.getByLabel('Find catalogue test').fill('CBC');await page.getByLabel('Choose test CBC', { exact: true }).check();
 let intercept = true;await page.route('**/api/lab/visits', async route => { if (intercept && route.request().method() === 'POST') { intercept = false;assert.equal((await route.fetch()).status(), 200);await route.abort('failed'); } else await route.continue(); });
 await page.getByRole('button', { name: 'Patient aur tests save karein', exact: true }).click();await page.getByRole('status').filter({ hasText: /fetch|request|network/i }).waitFor();await delay(1200);
 await page.getByRole('button', { name: 'Patient aur tests save karein', exact: true }).click();await page.getByRole('status').filter({ hasText: 'Entry save ho gayi' }).waitFor();await page.unroute('**/api/lab/visits');
 assert.equal((await db.query("select count(*)::int as n from public.kawt_lab_visits where patient_name='Synthetic uncertain response'")).rows[0].n, 1);
 const download = page.waitForEvent('download');await page.getByRole('button', { name: 'Performance CSV', exact: true }).click();const downloaded = await download;const path = await downloaded.path();assert(!fs.readFileSync(path, 'utf8').includes('confidential'));
 // Capture an unpopulated default screen, not synthetic patients or rates.
 await db.query("delete from public.kawt_lab_entry_audit where entity_kind='visit' and entity_id in(select id from public.kawt_lab_visits where patient_name='Synthetic uncertain response')");
 await db.query("delete from public.kawt_lab_visits where patient_name='Synthetic uncertain response'");
 assert.equal((await ownerApi.post('/api/lab/entry-settings', { data: { ...settings, revision: 1, shift_starts: null, reference_prices: [] } })).status(), 200);
 await page.reload();await page.getByRole('heading', { name: 'Patient aur test entry', exact: true }).waitFor();await page.getByRole('table', { name: 'Patient entry shift performance' }).waitFor();
 fs.mkdirSync('/workspace/KAWT-current-preview', { recursive: true });await page.screenshot({ path: '/workspace/KAWT-current-preview/lab-patient-entry-local.png', fullPage: false });
 await page.setViewportSize({ width: 390, height: 844 });const mobile = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, oversized: [...document.querySelectorAll('main,section,form,fieldset,table,nav')].map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })).filter(item => item.right > window.innerWidth + 1) }));assert(mobile.scroll <= mobile.width + 1, JSON.stringify(mobile));await page.screenshot({ path: '/workspace/KAWT-current-preview/lab-patient-entry-mobile-local.png', fullPage: true });
 const viewerContext = await browser.newContext({ storageState: await readOnly.storageState() }), viewerPage = await viewerContext.newPage();await viewerPage.goto(base + '/lab/visits');await viewerPage.getByRole('table', { name: 'Patient entry shift performance' }).waitFor();assert.equal(await viewerPage.getByLabel('Patient name', { exact: true }).count(), 0);assert.equal(await viewerPage.getByRole('table', { name: 'Saved patient entries', exact: true }).count(), 0);
 assert.deepEqual(errors, []);await viewerContext.close();await context.close();
 checks.push('Department login opens simple entry, catalogue/rate selection and automatic time/shift work; edits and lost-response retry preserve counts; viewer/mobile/CSV checks pass');
 fs.writeFileSync('docs/LAB-PATIENT-ENTRY-VALIDATION-2026-11-23.json', JSON.stringify({ checks, productionRuntime: process.env.KAWT_VISITS_PRODUCTION === '1', livePatientRecordsCreated: 0, authAccountsCreated: 0, fixtureData: 'Synthetic entries in disposable local database only', automaticBilling: false }, null, 2) + '\n');
 checks.forEach(check => console.log('PASS: ' + check));
} finally {
 for (const context of contexts) await context.dispose();await browser?.close();
 if (server && server.exitCode === null) { server.kill('SIGTERM');await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(5000)]); }
 await db?.end().catch(() => {});await admin.query('drop database if exists "' + name + '" with (force)');await admin.end();
}
