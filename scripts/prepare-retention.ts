import { Client } from 'pg';
async function main(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
 const queue=process.argv.includes('--queue'),db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
 try{
  const candidates=await db.query("select d.id from public.donors d join public.donations n on n.donor_id=d.id and n.status='confirmed' where d.marketing_consent and d.phone is not null group by d.id having max(n.confirmed_at)<now()-interval '90 days'");
  let created=0;
  if(queue)for(const row of candidates.rows){const result=await db.query("insert into public.integration_outbox(kind,donor_id,dedupe_key) values('retention',$1,$2) on conflict(dedupe_key) do nothing",[row.id,`retention:${row.id}:${new Date().toISOString().slice(0,7)}`]);created+=result.rowCount??0}
  console.log(`${candidates.rowCount} consented retention candidates; ${created} jobs queued. No external messages sent. ${queue?'Explicit --queue applied.':'Dry run.'}`);
 }finally{await db.end()}
}
main().catch(()=>{console.error('Retention preparation failed. Check secure runtime settings.');process.exitCode=1});
