import { prepareLocalMigrations } from './prepare-local-migrations.mjs';
import { spawnSync } from 'node:child_process';
import { mkdirSync,writeFileSync,chmodSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node >=22 is required');
if(process.env.DATABASE_URL&&!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error('Local setup refuses an injected remote database target');
mkdirSync('.local',{recursive:true,mode:0o700});chmodSync('.local',0o700);
const windows=process.platform==='win32';
const cli=(args)=>spawnSync(windows?'npx.cmd':'npx',['--no-install','supabase',...args],{encoding:'utf8',shell:windows,env:process.env,maxBuffer:16*1024*1024});
const save=(name,result)=>{writeFileSync('.local/'+name,(result.stdout??'')+(result.stderr??''),{mode:0o600});chmodSync('.local/'+name,0o600)};
const dockerEnv={...process.env};for(const name of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[name];
const docker=spawnSync('docker',['--host='+(windows?'npipe:////./pipe/docker_engine':'unix:///var/run/docker.sock'),'info','--format','{{.ServerVersion}}'],{encoding:'utf8',env:dockerEnv});
if(docker.status!==0)throw new Error('Start the existing local Docker engine (Docker Desktop with Linux containers on Windows), then retry. No daemon was started or reconfigured.');
console.log('Local Docker engine responds.');
let status=cli(['status','-o','json']);
if(status.status!==0){const started=cli(['start','--exclude','studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor','--ignore-health-check']);save('supabase-start.log',started);if(started.status!==0)throw new Error('Local Supabase startup failed; private diagnostics are in .local/supabase-start.log');status=cli(['status','-o','json'])}
if(status.status!==0){save('supabase-status.log',status);throw new Error('Local Supabase status failed; inspect private .local diagnostics')}
JSON.parse(status.stdout);writeFileSync('.local/supabase-status.json',status.stdout,{mode:0o600});chmodSync('.local/supabase-status.json',0o600);
function node(args){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)}
node(['--import','tsx','scripts/configure-local.ts']);
prepareLocalMigrations();
const migration=cli(['db','push','--local','--yes','--workdir','.local/migration-workdir']);save('migration.log',migration);if(migration.status!==0)throw new Error('Local migration failed; inspect .local/migration.log');
node(['--env-file=.env.local','--import','tsx','scripts/bootstrap-local.ts']);
node(['--env-file=.env.local','--import','tsx','db/seed.ts']);
console.log('Local SQL, authentication and private storage verified. Next: npm run dev -- --hostname 127.0.0.1 --port 3001');
