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
 if (versions.every(v=>history.includes(v))) {
  await client.query('ROLLBACK');emit({status:'already_initialized',databaseChanged:false});process.exitCode=0;
 } else {
  // Preserve unrelated project objects. Refuse every KAWT namespace collision.
  const sqlFiles=files.map(file=>readFileSync(new URL(file,dir),'utf8'));
  const requiredTables=[...new Set(sqlFiles.flatMap(sql=>[...sql.matchAll(/create\s+table\s+public\.(\w+)/gi)].map(m=>m[1])))];
  const requiredFunctions=[...new Set(sqlFiles.flatMap(sql=>[...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi)].map(m=>m[1])))];
  const requiredTypes=[...new Set(sqlFiles.flatMap(sql=>[...sql.matchAll(/create\s+type\s+public\.(\w+)/gi)].map(m=>m[1])))];
  const tableCollisions=(await client.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[])",[requiredTables])).rows.map(x=>x.relname);
  const functionCollisions=(await client.query("select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[])",[requiredFunctions])).rows.map(x=>x.proname);
  const typeCollisions=(await client.query("select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname=any($1::text[])",[requiredTypes])).rows.map(x=>x.typname);
  const triggerCollision=(await client.query("select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='kawt_on_auth_user_created'")).rowCount;
  const storagePolicies=[...new Set(sqlFiles.flatMap(sql=>[...sql.matchAll(/create\s+policy\s+(\w+)\s+on\s+storage\./gi)].map(m=>m[1])))];
  const policyCollision=(await client.query("select 1 from pg_policies where schemaname='storage' and policyname=any($1::text[])",[storagePolicies])).rowCount;
  const bucketCollision=(await client.query("select 1 from storage.buckets where id='private-camp-receipts'")).rowCount;
  const migrationCollisions=history.filter(version=>versions.includes(version));
  if(tableCollisions.length||functionCollisions.length||typeCollisions.length||triggerCollision||policyCollision||bucketCollision||migrationCollisions.length){
   emit({status:'conflicts',tables:tableCollisions,functions:functionCollisions,types:typeCollisions,authTrigger:Boolean(triggerCollision),storagePolicies:Boolean(policyCollision),receiptBucket:Boolean(bucketCollision),migrationVersions:migrationCollisions,databaseChanged:false});
   throw Object.assign(new Error(),{code:'KAWT_OBJECT_COLLISION_REQUIRES_REVIEW'});
  }
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
