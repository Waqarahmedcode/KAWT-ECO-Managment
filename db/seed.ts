import 'dotenv/config';
import { Client } from 'pg';
import { seedSource } from './source-seed';
import { databaseConnectionOptions } from '../lib/postgres-connection';

async function main(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
 if(!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)&&process.env.KAWT_ALLOW_REMOTE_SEED!=='approved-development-target')throw new Error('Remote seed requires explicit approval of the intended development target');
 const client=new Client(databaseConnectionOptions(process.env.DATABASE_URL));await client.connect();
 try{
  await client.query('BEGIN');const source=await seedSource(client);await client.query('COMMIT');
  console.log('Seeded',source.historicalCamps,'historical camps and',source.plannedCamps,'planned roadmap entries. Existing records preserved.');
 }catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}
}
main().catch(error=>{console.error(error);process.exit(1)});
