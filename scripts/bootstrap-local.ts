import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync,existsSync,chmodSync } from 'node:fs';

async function main(){
const database=process.env.DATABASE_URL,endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!database||!endpoint||!key)throw new Error('Load the isolated local .env.local before bootstrapping');
for(const target of [database,endpoint])if(!['127.0.0.1','localhost'].includes(new URL(target).hostname))throw new Error('Local bootstrap refuses all remote databases and APIs');
const client=new Client({connectionString:database});await client.connect();
const admin=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}});
const health=await fetch(endpoint+'/auth/v1/health',{headers:{apikey:key},signal:AbortSignal.timeout(15000)});
if(!health.ok)throw new Error('Local authentication health check failed: '+health.status);
const storage=await fetch(endpoint+'/storage/v1/bucket',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
if(!storage.ok)throw new Error('Local private storage check failed: '+storage.status);
const buckets=await storage.json() as {id:string}[];
if(!buckets.some(bucket=>bucket.id==='private-camp-receipts'))throw new Error('Local receipt bucket migration is missing');
await client.query('select 1');
const existing=await admin.auth.admin.listUsers({page:1,perPage:1000});if(existing.error)throw existing.error;
type Account={email:string;password:string;user_id:string;role:string};
mkdirSync('.local',{recursive:true});chmodSync('.local',0o700);
const accounts:Account[]=existsSync('.local/accounts.json')?JSON.parse(readFileSync('.local/accounts.json','utf8')):[];
for(const role of ['admin','camp_manager','doctor','pharmacist','donor','csr_partner']){
 const email=`${role}@kawt.local.test`;
 let user=existing.data.users.find(user=>user.email===email);
 if(!user){
  const password=randomBytes(24).toString('base64url');
  const result=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Local development: '+role}});
  if(result.error)throw result.error;user=result.data.user;
  accounts.push({email,password,user_id:user.id,role});
  writeFileSync('.local/accounts.json',JSON.stringify(accounts,null,2),{mode:0o600});
 }
 await client.query('update public.profiles set role=$1,email=$2 where id=$3',[role,email,user.id]);
}
await client.end();
console.log('PASS: local PostgreSQL query, Supabase authentication and private receipt storage checks');
console.log('Prepared six isolated development roles. Credentials are stored only in .local/accounts.json (mode 600).');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local bootstrap failed');process.exit(1)});
