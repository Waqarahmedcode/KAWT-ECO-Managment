import { bootstrapFirstAdministrator } from '../lib/first-administrator.ts';
import { getPool } from '../lib/db.ts';
if(!process.env.KAWT_FIRST_ADMIN_EMAIL){console.log('KAWT_FIRST_ADMIN '+JSON.stringify({status:'not_requested',accountsCreated:0}));process.exit(0)}
try{console.log('KAWT_FIRST_ADMIN '+JSON.stringify(await bootstrapFirstAdministrator()))}
catch(error){const raw=String(error?.code||'SETUP_FAILED');console.log('KAWT_FIRST_ADMIN '+JSON.stringify({status:'failed',code:/^[A-Z0-9_]{1,60}$/.test(raw)?raw:'SETUP_FAILED'}));process.exitCode=1}
finally{if(process.env.DATABASE_URL)await getPool().end()}
