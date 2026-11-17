import { Client } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { databaseConnectionOptions } from '../lib/postgres-connection.ts';
import { seedSource } from '../db/source-seed.ts';

const project = process.env.KAWT_INITIALIZE_PROJECT_REF;
const emit = value => console.log('KAWT_DATABASE_INITIALIZATION '+JSON.stringify(value));
if (!project) { emit({status:'not_requested',databaseChanged:false}); process.exit(0); }
let client;
try {
 const target = new URL(process.env.KAWT_READINESS_DATABASE_URL || '');
 const local = ['localhost','127.0.0.1'].includes(target.hostname);
 const localTest = local && project==='local-test' && /^\/kawt_init_validation_\d+$/.test(target.pathname);
 const remote = !local && project==='ftuyaeljayonfaxolwqi' && target.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(target.username)==='postgres.'+project;
 if (!localTest && !remote) throw Object.assign(new Error(),{code:'TARGET_NOT_APPROVED'});
 client = new Client(databaseConnectionOptions(target.toString())); await client.connect();
 await client.query('BEGIN'); await client.query("SET LOCAL statement_timeout='30s'");
 await client.query("select pg_advisory_xact_lock(hashtext('kawt-empty-project-initialization'))");
 const dir = new URL('../supabase/migrations/',import.meta.url);
 const files = readdirSync(dir).filter(name=>/^\d+_.+\.sql$/.test(name)).sort();
 const versions = files.map(name=>name.split('_')[0]);
 const hasHistory = Boolean((await client.query("select to_regclass('supabase_migrations.schema_migrations') as value")).rows[0].value);
 const history = hasHistory ? (await client.query('select version from supabase_migrations.schema_migrations')).rows.map(x=>x.version) : [];
 if (history.length===versions.length && versions.every(v=>history.includes(v))) {
  await client.query('ROLLBACK');emit({status:'already_initialized',databaseChanged:false});process.exitCode=0;
 } else {
  // Refuse partially migrated or unrelated application databases. Never reset/overwrite.
  const relations=(await client.query("select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')")).rows[0].count;
  const functions=(await client.query("select count(*)::int as count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')")).rows[0].count;
  const types=(await client.query("select count(*)::int as count from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in ('e','d') and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')")).rows[0].count;
  const buckets=(await client.query('select count(*)::int as count from storage.buckets')).rows[0].count;
  if (relations || functions || types || history.length || buckets) throw Object.assign(new Error(),{code:'NONEMPTY_PROJECT_REQUIRES_REVIEW'});
  await client.query('create schema if not exists supabase_migrations');
  await client.query('create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text)');
  for (const file of files) {
   const sql=readFileSync(new URL(file,dir),'utf8');await client.query(sql);
   await client.query('insert into supabase_migrations.schema_migrations(version,statements) values($1,$2)',[file.split('_')[0],[sql]]);
  }
  const source=await seedSource(client);
  const totals=(await client.query('select count(*)::int as historical,coalesce(sum(total_patients),0)::int as patients,coalesce(sum(total_spend_paisa),0)::text as spend from public.historical_camp_statistics')).rows[0];
  const counts=(await client.query('select (select count(*)::int from public.camps) as camps,(select count(*)::int from public.camp_patients) as patients,(select count(*)::int from public.donations) as donations,(select count(*)::int from public.capital_projects) as projects,(select count(*)::int from public.wash_projects) as wash')).rows[0];
  if (source.historicalCamps!==6 || source.plannedCamps!==6 || totals.historical!==6 || totals.patients!==2912 || totals.spend!=='241657100' || counts.camps!==12 || counts.patients || counts.donations || counts.projects || counts.wash) throw Object.assign(new Error(),{code:'SOURCE_IMPORT_VALIDATION_FAILED'});
  await client.query('COMMIT');
  emit({status:'initialized',migrations:files.length,...source,historicalPatients:totals.patients,expenditurePaisa:totals.spend,livePatientRecords:counts.patients,donations:counts.donations,accountsCreated:0,databaseChanged:true});
 }
} catch (error) {
 await client?.query('ROLLBACK').catch(()=>{});
 const raw=String(error?.code||'INITIALIZATION_FAILED');const code=/^[A-Z0-9_]{1,80}$/.test(raw)?raw:'INITIALIZATION_FAILED';
 emit({status:'failed',code,databaseChanged:false});process.exitCode=1;
} finally { await client?.end().catch(()=>{}); }
