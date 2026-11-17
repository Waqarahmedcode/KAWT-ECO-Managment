import { Client } from 'pg';
import { parse } from 'dotenv';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const envPath=process.env.KAWT_INITIALIZATION_LOCAL_ENV;
if(!envPath)throw new Error('Set KAWT_INITIALIZATION_LOCAL_ENV to an existing isolated local database configuration');
const bindings=parse(fs.readFileSync(envPath));
const root=new URL(bindings.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(root.hostname))throw new Error('Initialization validation refuses remote databases');
const admin=new Client({connectionString:root.toString()});await admin.connect();
const name='kawt_init_validation_'+Date.now();const target=new URL(root);target.pathname='/'+name;
let client,created=false;
try{
 await admin.query('create database "'+name+'"');created=true;
 client=new Client({connectionString:target.toString()});await client.connect();
 await client.query("create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,confirmation_sent_at timestamptz);create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;");
 await client.query("create table public.unrelated_existing_content(id integer primary key,value text);insert into public.unrelated_existing_content values(1,'preserve-this-existing-row')");
 await client.query("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);insert into supabase_migrations.schema_migrations values('199901010001',array['select 1'],'existing migration');create function public.create_user_profile() returns trigger language plpgsql as $$begin return new;end;$$;create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_user_profile()");
 await client.query("alter table storage.buckets enable row level security;grant usage on schema storage,auth to anon,authenticated;grant select,insert,update,delete on storage.objects,storage.buckets to anon,authenticated;create policy existing_broad_objects on storage.objects for all to anon,authenticated using(true) with check(true);create policy existing_broad_buckets on storage.buckets for all to anon,authenticated using(true) with check(true);insert into storage.buckets(id,name,public) values('existing-files','existing-files',false);insert into storage.objects(id,bucket_id) values('00000000-0000-4000-8000-000000000010','existing-files')");
 await client.end();client=undefined;
 const env={...process.env,KAWT_READINESS_DATABASE_URL:target.toString(),KAWT_INITIALIZE_PROJECT_REF:'local-test'};
 for(const expected of ['initialized','already_initialized']){
  const r=spawnSync('node',['--import','tsx','scripts/initialize-database.mjs'],{env,encoding:'utf8',timeout:60000});
  process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
  assert.equal(r.status,0,'Initializer process failed');
  const line=r.stdout.split('\n').find(x=>x.startsWith('KAWT_DATABASE_INITIALIZATION '));assert(line);
  assert.equal(JSON.parse(line.slice('KAWT_DATABASE_INITIALIZATION '.length)).status,expected);
 }
 client=new Client({connectionString:target.toString()});await client.connect();assert.equal((await client.query('select value from public.unrelated_existing_content where id=1')).rows[0].value,'preserve-this-existing-row');assert.equal((await client.query("select count(*)::int as n from supabase_migrations.schema_migrations where version='199901010001'")).rows[0].n,1);assert.equal((await client.query("select count(*)::int as n from pg_trigger where tgrelid='auth.users'::regclass and tgname in ('on_auth_user_created','kawt_on_auth_user_created')")).rows[0].n,2);await client.end();client=undefined;
 client=new Client({connectionString:target.toString()});await client.connect();
 await client.query("insert into storage.objects(id,bucket_id) values('00000000-0000-4000-8000-000000000020','private-camp-receipts')");
 const bootstrapEmail='owner@isolated.invalid',bootstrapId='00000000-0000-4000-8000-000000000040';
 const bootstrapEnv={...process.env,DATABASE_URL:target.toString(),KAWT_FIRST_ADMIN_EMAIL:bootstrapEmail};
 const bootstrap=(expected)=>{const r=spawnSync('node',['--conditions=react-server','--import','tsx','scripts/bootstrap-first-admin.mjs'],{env:bootstrapEnv,encoding:'utf8',timeout:30000});process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);assert.equal(r.status,0);assert(r.stdout.includes('"status":"'+expected+'"'));};
 bootstrap('account_required');
 await client.query('insert into auth.users(id,email) values($1,$2)',[bootstrapId,bootstrapEmail]);bootstrap('verification_required');
 await client.query('update auth.users set email_confirmed_at=now() where id=$1',[bootstrapId]);await client.query("insert into auth.identities(user_id,provider,identity_data) values($1,'google',$2::jsonb)",[bootstrapId,JSON.stringify({email_verified:true,email:'another@isolated.invalid'})]);bootstrap('verification_required');
 await client.query("update auth.users set confirmation_sent_at=now()-interval '1 minute',email_confirmed_at=now() where id=$1",[bootstrapId]);bootstrap('administrator_ready');bootstrap('already_bootstrapped');
 assert.equal((await client.query('select role from public.profiles where id=$1',[bootstrapId])).rows[0].role,'admin');
 assert.equal((await client.query("select count(*)::int as n from public.audit_log where event_name='INITIAL_ADMIN_BOOTSTRAPPED'")).rows[0].n,1);
 await client.query("update public.profiles set role='donor' where id=$1",[bootstrapId]);bootstrap('already_bootstrapped');
 assert.equal((await client.query('select role from public.profiles where id=$1',[bootstrapId])).rows[0].role,'donor');
 console.log('PASS: first administrator requires a real verified identity, grants once, and cannot re-elevate a revoked administrator.');
 const actors=[{role:'anon',id:null,read:false},{role:'donor',id:'00000000-0000-4000-8000-000000000031',read:false},{role:'camp_manager',id:'00000000-0000-4000-8000-000000000032',read:true},{role:'admin',id:'00000000-0000-4000-8000-000000000033',read:true}];
 for(const actor of actors){
  if(actor.id){await client.query('insert into auth.users(id,email) values($1,$2)',[actor.id,actor.role+'@isolated.invalid']);await client.query('update public.profiles set role=$1 where id=$2',[actor.role,actor.id]);}
  const begin=async()=>{await client.query('BEGIN');await client.query("select set_config('request.jwt.claim.sub',$1,true)",[actor.id||'']);await client.query('SET LOCAL ROLE '+(actor.role==='anon'?'anon':'authenticated'));};
  await begin();
  assert.equal((await client.query("select 1 from storage.objects where bucket_id='private-camp-receipts'")).rowCount,actor.read?1:0);
  assert.equal((await client.query("select 1 from storage.objects where bucket_id='existing-files'")).rowCount,1);
  assert.equal((await client.query("select 1 from storage.buckets where id='private-camp-receipts'")).rowCount,actor.read?1:0);
  assert.equal((await client.query("select 1 from storage.buckets where id='existing-files'")).rowCount,1);
  await client.query('ROLLBACK');
  await begin();let denied=false;
  try{await client.query("insert into storage.objects(id,bucket_id) values('00000000-0000-4000-8000-000000000099','private-camp-receipts')")}catch(error){assert.equal(error.code,'42501');denied=true}
  assert.equal(denied,actor.role!=='admin');await client.query('ROLLBACK');
  await begin();const removed=await client.query("delete from storage.objects where bucket_id='private-camp-receipts'");assert.equal(removed.rowCount,actor.role==='admin'?1:0);await client.query('ROLLBACK');
  await begin();denied=false;
  try{const changed=await client.query("update storage.buckets set public=true where id='private-camp-receipts'");assert.equal(changed.rowCount,0)}catch(error){assert.equal(error.code,'42501');denied=true}
  if(actor.role==='admin')assert(denied,'Private receipt bucket must not become public');await client.query('ROLLBACK');
 }
 await client.end();client=undefined;
 console.log('PASS: existing broad storage policies cannot expose private KAWT receipts; other bucket access is preserved.');
 const result=spawnSync('node',['--import','tsx','scripts/backend-readiness.mjs'],{env:{...env,KAWT_READINESS_STRICT:'1'},encoding:'utf8',timeout:30000});
 process.stdout.write(result.stdout);assert.equal(result.status,0);assert(result.stdout.includes('"schema_ready"'));
 const refused=spawnSync('node',['--import','tsx','scripts/initialize-database.mjs'],{env:{...env,KAWT_READINESS_DATABASE_URL:root.toString()},encoding:'utf8',timeout:30000});
 assert.equal(refused.status,1);assert(refused.stdout.includes('TARGET_NOT_APPROVED'));
 console.log('PASS: atomic source-only initialization, existing unrelated row/migration/authentication hook preserved, safe repeat, schema/RLS/private bucket readiness and refusal of existing local product database.');
}finally{
 await client?.end().catch(()=>{});
 if(created)await admin.query('drop database if exists "'+name+'" with (force)');
 await admin.end();
}
