import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { databaseConnectionOptions } from '../lib/postgres-connection.ts';

const project = process.env.KAWT_INITIALIZE_PROJECT_REF;
const emit = value => console.log('KAWT_LAB_INITIALIZATION ' + JSON.stringify(value));
if (!project) { emit({ status: 'not_requested', databaseChanged: false });process.exit(0); }
let client;
try {
 const url = new URL(process.env.KAWT_READINESS_DATABASE_URL || '');
 const local = ['localhost', '127.0.0.1'].includes(url.hostname) && project === 'local-test' && /^\/kawt_init_validation_\d+$/.test(url.pathname);
 const remote = project === 'ftuyaeljayonfaxolwqi' && url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === 'postgres.' + project;
 if (!local && !remote) throw Object.assign(new Error(), { code: 'TARGET_NOT_APPROVED' });
 client = new Client(databaseConnectionOptions(url.toString()));await client.connect();
 await client.query('BEGIN');
 await client.query("SET LOCAL statement_timeout='30s'");
 await client.query("select pg_advisory_xact_lock(hashtext('kawt-laboratory-schema-upgrade'))");
 const directory = new URL('../supabase/lab-migrations/', import.meta.url);
 const files = readdirSync(directory).filter(n => /^\d+_.+\.sql$/.test(n)).sort();
 const versions = files.map(n => n.split('_')[0]);
 const history = (await client.query('select version from supabase_migrations.schema_migrations where version=any($1::text[])', [versions])).rows.map(r => r.version);
 const pending = files.filter(n => !history.includes(n.split('_')[0]));
 if (!pending.length) { await client.query('ROLLBACK');emit({ status: 'already_initialized', databaseChanged: false }); }
 else {
  if (!(await client.query("select to_regclass('public.profiles') as value")).rows[0].value) throw Object.assign(new Error(), { code: 'CORE_SCHEMA_REQUIRED' });
  let tableCount = 0;
  for (const file of pending) {
   const sql = readFileSync(new URL(file, directory), 'utf8');
   const tables = [...sql.matchAll(/create\s+table\s+public\.(\w+)/gi)].map(m => m[1]);
   const functions = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi)].map(m => m[1]);
   const collision = (await client.query("select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[]) union all select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($2::text[])", [tables, functions])).rowCount;
   if (collision) throw Object.assign(new Error(), { code: 'LAB_OBJECT_COLLISION_REQUIRES_REVIEW' });
   await client.query(sql);
   await client.query('insert into supabase_migrations.schema_migrations(version,statements) values($1,$2)', [file.split('_')[0], [sql]]);
   tableCount += tables.length;
  }
  await client.query('COMMIT');emit({ status: 'initialized', migrations: pending.length, tables: tableCount, accountsCreated: 0, businessRecordsCreated: 0, databaseChanged: true });
 }
} catch (error) {
 await client?.query('ROLLBACK').catch(() => {});
 const raw = String(error?.code || 'LAB_INITIALIZATION_FAILED');
 emit({ status: 'failed', code: /^[A-Z0-9_]{1,80}$/.test(raw) ? raw : 'LAB_INITIALIZATION_FAILED', databaseChanged: false });process.exitCode = 1;
} finally { await client?.end().catch(() => {}); }
