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
 await client.query("create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;");
 await client.end();client=undefined;
 const env={...process.env,KAWT_READINESS_DATABASE_URL:target.toString(),KAWT_INITIALIZE_PROJECT_REF:'local-test'};
 for(const expected of ['initialized','already_initialized']){
  const r=spawnSync('node',['--import','tsx','scripts/initialize-database.mjs'],{env,encoding:'utf8',timeout:60000});
  process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
  assert.equal(r.status,0,'Initializer process failed');
  const line=r.stdout.split('\n').find(x=>x.startsWith('KAWT_DATABASE_INITIALIZATION '));assert(line);
  assert.equal(JSON.parse(line.slice('KAWT_DATABASE_INITIALIZATION '.length)).status,expected);
 }
 const result=spawnSync('node',['--import','tsx','scripts/backend-readiness.mjs'],{env:{...env,KAWT_READINESS_STRICT:'1'},encoding:'utf8',timeout:30000});
 process.stdout.write(result.stdout);assert.equal(result.status,0);assert(result.stdout.includes('"schema_ready"'));
 const refused=spawnSync('node',['--import','tsx','scripts/initialize-database.mjs'],{env:{...env,KAWT_READINESS_DATABASE_URL:root.toString()},encoding:'utf8',timeout:30000});
 assert.equal(refused.status,1);assert(refused.stdout.includes('TARGET_NOT_APPROVED'));
 console.log('PASS: atomic source-only initialization, safe repeat, schema/RLS/private bucket readiness and refusal of existing local product database.');
}finally{
 await client?.end().catch(()=>{});
 if(created)await admin.query('drop database if exists "'+name+'" with (force)');
 await admin.end();
}
