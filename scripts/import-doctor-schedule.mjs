import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { databaseConnectionOptions } from '../lib/postgres-connection.ts';
import { importMedicalCentreSource, medicalCentreSourceInput } from '../lib/medical-centre-import.ts';

const emit = value => console.log('KAWT_DOCTOR_SCHEDULE ' + JSON.stringify(value));
if (process.env.KAWT_IMPORT_DOCTOR_SCHEDULE !== '1') {
 emit({ status: 'not_requested', databaseChanged: false });
 process.exit(0);
}
let client;
try {
 const project = process.env.KAWT_INITIALIZE_PROJECT_REF;
 const url = new URL(process.env.KAWT_READINESS_DATABASE_URL || '');
 const local = ['localhost', '127.0.0.1'].includes(url.hostname) && project === 'local-test' && /^\/kawt_init_validation_\d+$/.test(url.pathname);
 const remote = project === 'ftuyaeljayonfaxolwqi' && url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === 'postgres.' + project && url.pathname === '/postgres';
 if (!local && !remote) throw Object.assign(new Error(), { code: 'TARGET_NOT_APPROVED' });
 const email = process.env.KAWT_FIRST_ADMIN_EMAIL?.trim().toLowerCase();
 if (!email) throw Object.assign(new Error(), { code: 'CONFIGURED_OWNER_REQUIRED' });
 const source = medicalCentreSourceInput.parse(JSON.parse(readFileSync(new URL('../data/doctor-schedule-source.json', import.meta.url), 'utf8')));
 if (source.items.length !== 15 || source.items.some(item => item.action !== 'doctor')) throw Object.assign(new Error(), { code: 'SCHEDULE_SOURCE_MISMATCH' });
 client = new Client(databaseConnectionOptions(url.toString()));
 await client.connect();
 await client.query('BEGIN');
 await client.query("SET LOCAL statement_timeout='30s'");
 await client.query("select pg_advisory_xact_lock(hashtext('kawt-owner-doctor-schedule-import'))");
 const owners = (await client.query("select u.id from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=$1 and u.email_confirmed_at is not null and p.role='admin'", [email])).rows;
 if (owners.length !== 1) throw Object.assign(new Error(), { code: 'VERIFIED_OWNER_ADMIN_REQUIRED' });
 const actorId = owners[0].id;
 await client.query('SET LOCAL ROLE authenticated');
 await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [actorId, JSON.stringify({ sub: actorId, role: 'authenticated' })]);
 const result = await importMedicalCentreSource(client, actorId, source, true);
 const counts = (await client.query('select service_group,count(*)::int as count from public.kawt_mc_doctors where source_label=$1 group by service_group', [source.items[0].source_label])).rows;
 await client.query('COMMIT');
 emit({ ...result, sourceGroups: counts, verifiedOwner: true, databaseChanged: result.created > 0, ratesApplied: false, billingEnabled: false });
} catch (error) {
 await client?.query('ROLLBACK').catch(() => {});
 const code = String(error?.code || 'SCHEDULE_IMPORT_FAILED');
 emit({ status: 'failed', code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : 'SCHEDULE_IMPORT_FAILED', databaseChanged: false });
 process.exitCode = 1;
} finally { await client?.end().catch(() => {}); }
