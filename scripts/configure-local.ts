import { readFileSync,writeFileSync,existsSync,chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
const status=JSON.parse(readFileSync('.local/supabase-status.json','utf8')) as Record<string,string>;
const file='.env.local';
const original=existsSync(file)?readFileSync(file,'utf8'):'';
const existing=parse(original);
for(const value of [process.env.DATABASE_URL,existing.DATABASE_URL,existing.NEXT_PUBLIC_SUPABASE_URL]){
 if(value&&!['127.0.0.1','localhost'].includes(new URL(value).hostname))throw new Error('Refusing to overwrite or use remote runtime settings during local setup');
}
for(const name of ['DB_URL','API_URL','ANON_KEY','SERVICE_ROLE_KEY'])if(!status[name])throw new Error('Local Supabase status is missing '+name);
for(const name of ['DB_URL','API_URL'])if(!['127.0.0.1','localhost'].includes(new URL(status[name]).hostname))throw new Error('Supabase status is not local');
const values:Record<string,string>={DATABASE_URL:status.DB_URL,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3001',APP_RATE_LIMIT_SALT:existing.APP_RATE_LIMIT_SALT??randomBytes(32).toString('hex')};
const lines=original.split('\n').filter(line=>!Object.keys(values).some(name=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line)));
writeFileSync(file,lines.join('\n').trimEnd()+'\n'+Object.entries(values).map(([name,value])=>`${name}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600});chmodSync(file,0o600);
console.log('Local runtime bindings written securely. No credential values were printed.');
