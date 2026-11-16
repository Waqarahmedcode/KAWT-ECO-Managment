import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// IMPORT PRINCIPLE: preserve reported totals and provenance; NEVER seed aggregate attendees as identifiable patient records.
type SourceCamp={id:string;name:string;date:string;timeWindow:string;area:string;address:string;partner:string;organizer:string;selectionReason:string;patients:Record<string,number>;team:Record<string,unknown>;vitals:Record<string,string>;financials:Record<string,number>;notes:string;dataNote?:string;expenses:{item:string;amount:number;source:string}[];medicinesList:{name:string;category:string;units:number;cost:number;formulation?:string}[];diseases:{condition:string;cases:number;share:number}[]};
const readJSON=<T,>(file:string):T=>JSON.parse(readFileSync(resolve(process.cwd(),'data',file),'utf8')) as T;
const camps=readJSON<SourceCamp[]>('historical-camps.json');
const planned=readJSON<{code:string;area:string;hazard:string;targetDate:string;targetPatients:number;estBudget:number}[]>('planned-camps.json');
const p=(amount:number)=>Math.round(amount*100);
async function main(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
 if(!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)&&process.env.KAWT_ALLOW_REMOTE_SEED!=='approved-development-target')throw new Error('Remote seed requires explicit approval of the intended development target');
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{await client.query('BEGIN');
 for(const c of camps){
  await client.query(`insert into public.camps(id,title,camp_date,time_window,area,address,partner,organizer,selection_reason,status,source_type)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed','legacy_source') on conflict(id) do nothing`,
   [c.id,c.name,c.date,c.timeWindow,c.area,c.address,c.partner,c.organizer,c.selectionReason]);
  await client.query(`insert into public.historical_camp_statistics(camp_id,total_patients,male_recorded,female_recorded,children_recorded,adults_recorded,elderly_recorded,
   emergencies_recorded,referrals_recorded,pregnant_recorded,team_counts,historical_vitals,total_spend_paisa,zakat_spend_paisa,general_spend_paisa,medicine_units_reported,notes,data_note,source_name,source_snapshot,verification_status)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,'pending_source_verification') on conflict(camp_id) do nothing`,[
    c.id,c.patients.total,c.patients.male,c.patients.female,c.patients.children,c.patients.adults,c.patients.elderly,
    c.patients.emergency,c.patients.referrals,c.patients.pregnant,JSON.stringify(c.team),JSON.stringify(c.vitals),
    p(c.financials.totalBudget),p(c.financials.zakatAmount),p(c.financials.nonZakatAmount),['FMC-04','FMC-05'].includes(c.id)?null:c.financials.medicineUnits,c.notes,c.dataNote??null,'kawt_growth_camp_operations_ecosystem.md',JSON.stringify(c)
  ]);
  const existing=await client.query('select 1 from public.historical_expense_lines where camp_id=$1 limit 1',[c.id]);
  if(existing.rowCount===0){
   for(const e of c.expenses)await client.query('insert into public.historical_expense_lines(camp_id,item,amount_paisa,source_label) values($1,$2,$3,$4)',[c.id,e.item,p(e.amount),e.source]);
   for(const m of c.medicinesList)await client.query('insert into public.historical_medicine_lines(camp_id,medicine,category,units_reported,cost_paisa,formulation) values($1,$2,$3,$4,$5,$6)',[c.id,m.name,m.category,m.units,p(m.cost),m.formulation??null]);
   for(const d of c.diseases)await client.query('insert into public.historical_disease_summaries(camp_id,condition,cases_reported,pct_reported,provenance) values($1,$2,$3,$4,$5)',[
    c.id,d.condition,d.cases,d.share, (['FMC-04','FMC-06'].includes(c.id)||d.condition.includes('Dispensed Share'))?'pharmacy_proxy_not_clinical_diagnosis':'legacy_summary_not_uid_linked'
   ]);
  }
 }
 for(const c of planned){
  await client.query(`insert into public.camps(id,title,area,selection_reason,status,source_type,target_patients,proposed_budget_paisa,planned_period)
  values($1,$2,$3,$4,'planned','legacy_source',$5,$6,$7) on conflict(id) do nothing`,[c.code,c.area,c.area,'Roadmap hazard flag: '+c.hazard,c.targetPatients,p(c.estBudget),c.targetDate]);
  await client.query("update public.camps set target_patients=coalesce(target_patients,$2),proposed_budget_paisa=coalesce(proposed_budget_paisa,$3),planned_period=coalesce(planned_period,$4) where id=$1 and status='planned' and source_type='legacy_source'",[c.code,c.targetPatients,p(c.estBudget),c.targetDate]);
 }
 // Programme capacity and product requirements are not operational records.
 // Import only entries present in the supplied source JSON. WASH/capital
 // projects must be entered from supporting source evidence by an operator.
 await client.query('COMMIT'); console.log('Seeded',camps.length,'historical camps and',planned.length,'planned roadmap entries. Existing records preserved.');
 }catch(e){await client.query('ROLLBACK');throw e}finally{await client.end()}
}
main().catch(e=>{console.error(e);process.exit(1)});
