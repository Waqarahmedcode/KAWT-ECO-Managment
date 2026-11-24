import { z } from 'zod';
import type { PoolClient } from 'pg';
import { actorTransaction, allRoles, sameOrigin, workspaceError, type Actor } from '@/lib/actor-db';
import { validPakistaniIban } from '@/lib/finance';
import type { AppRole } from '@/lib/auth';

export const dynamic='force-dynamic';
const uuid=z.string().uuid();
const amount=z.coerce.number().int().min(0).max(1_000_000_000_000);
const text=(max=250)=>z.string().trim().min(1).max(max);
const optionalText=(max=1000)=>z.string().trim().max(max).optional().nullable();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id={id:uuid.optional()};
const schemas={
 camp_status:z.object({id:text(12),status:z.enum(['planned','site_review','approved','in_progress','completed','cancelled'])}),
 camp_metadata:z.object({id:text(12),title:text(180),area:text(200),address:optionalText(350),camp_date:date.optional().nullable(),selection_reason:optionalText(2000),target_patients:z.coerce.number().int().positive().optional(),proposed_budget_paisa:amount.optional(),planned_period:optionalText(100)}),
 medicine:z.object({generic_name:text(),formulation:text(100),stock_unit:text(40)}),
 roster:z.object({...id,camp_id:text(12),staff_name:text(140),role:z.enum(['DOCTOR','NURSE','PARAMEDIC','PHARMACIST','LAB_TECH','VOLUNTEER']),honorarium_paisa:amount,duty_units:z.coerce.number().int().min(1).max(366).default(1),rate_paisa:amount.optional(),attendance_confirmed:z.boolean(),payout_status:z.enum(['pending','approved','paid']),notes:optionalText()}),
 adjustment:z.object({inventory_id:uuid,procurement_delta:z.coerce.number().int(),wastage_delta:z.coerce.number().int(),reason:text(1000).min(8)}).refine(v=>v.procurement_delta!==0||v.wastage_delta!==0),
 adjustment_decision:z.object({id:uuid,approve:z.boolean()}),
 reversal:z.object({id:uuid,reason:text(1000).min(8)}),
 project:z.object({...id,phase:z.coerce.number().int().min(1).max(4),title:text(),start_year:z.coerce.number().int().min(2026).max(2100),end_year:z.coerce.number().int().min(2026).max(2100),target_paisa:amount,status:z.enum(['planned','in_progress','completed','blocked']),description:optionalText(4000)}).refine(v=>v.end_year>=v.start_year),
 milestone:z.object({...id,project_id:uuid,title:text(),due_date:date.optional().nullable(),budget_paisa:amount,status:z.enum(['planned','in_progress','completed','blocked']),notes:optionalText()}),
 wash_project:z.object({...id,title:text(),kind:z.enum(['RO','SABEEL','BORE_WELL']),location:text()}),
 wash_reading:z.object({project_id:uuid,recorded_on:date,source_liters:z.coerce.number().positive().max(1e10),pure_liters:z.coerce.number().min(0).max(1e10),quality_reference:optionalText(),}).refine(v=>v.pure_liters<=v.source_liters),
 community_activity:z.object({title:text(),kind:z.enum(['HEAT_PREVENTION','DISASTER_RESPONSE','WATER_DISTRIBUTION','HEALTH_SCREENING','FOOD_SUPPORT','YOUTH_VOLUNTEERING']),held_on:date,location:text(),beneficiaries:z.coerce.number().int().min(0),water_liters:z.coerce.number().min(0),ors_units:z.coerce.number().int().min(0),volunteer_hours:z.coerce.number().min(0),evidence_reference:text(1000)}),
 csr_partner:z.object({...id,organization:text(),sector:text(),contact_name:optionalText(),contact_email:z.string().email().optional().nullable(),interests:z.array(text(80)).max(20),consent_to_contact:z.boolean(),status:z.enum(['prospect','contacted','partner','inactive'])}),
 csr_commitment:z.object({...id,partner_id:uuid,project_id:uuid.optional().nullable(),camp_id:text(12).optional().nullable(),pillar:z.enum(['social','environment','governance','engagement']),sdg:z.enum(['SDG3','SDG6','SDG8','SDG13','SDG17']),description:text(4000),pledged_paisa:amount,volunteer_hours:z.coerce.number().min(0).max(100000),status:z.enum(['proposed','approved','active','completed'])}),
 csr_membership:z.object({user_id:uuid,partner_id:uuid}),
 campaign:z.object({...id,title:text(),season:text(80),channel:z.enum(['meta','tiktok','direct','email','whatsapp','event']),country:optionalText(100),start_date:date,end_date:date,budget_paisa:amount,spend_paisa:amount,status:z.enum(['planned','active','completed','paused']),source_reference:optionalText()}).refine(v=>v.end_date>=v.start_date),
 benchmark:z.object({...id,organization:text(),metric:text(),value:z.coerce.number().finite().min(0),unit:text(80),period_start:date,period_end:date,source_url:z.string().url().startsWith('https://'),methodology:text(2000)}).refine(v=>v.period_end>=v.period_start),
 bank_route:z.object({...id,bank_name:text(),fund:z.enum(['ZAKAT','GENERAL']),iban:text(40).refine(validPakistaniIban,'Enter a valid Pakistani IBAN with its checksum'),account_title:text(),verification_reference:text(1000).min(4),active:z.boolean()}),
 donation_confirmation:z.object({id:uuid,proof_reference:text(1000).min(4)}),
 tax_certificate:z.object({donation_id:uuid,authorized_name:text(140),authorized_title:text(140),statement:text(240).min(12)}),
 lead:z.object({...id,full_name:text(140),email:z.string().email().optional().nullable(),phone:optionalText(40),marketing_consent:z.boolean(),consent_basis:text(1000),contact_status:z.enum(['new','contacted','qualified','converted','do_not_contact']),assigned_to:uuid.optional().nullable()}),
 staff_role:z.object({user_id:uuid,role:z.enum(['admin','camp_manager','doctor','pharmacist','donor','csr_partner'])}),
 published_report:z.object({title:text(),camp_id:text(12).optional().nullable(),public_url:z.string().url().startsWith('https://')}),
 document:z.object({...id,title:text(),kind:text(80),source_reference:text(1000),valid_until:date.optional().nullable(),status:z.enum(['pending_review','verified','expired'])}),
 enqueue:z.object({kind:z.enum(['receipt','retention','impact_report']),donation_id:uuid.optional(),donor_id:uuid.optional(),report_id:uuid.optional()}),
} as const;
type Action=keyof typeof schemas;

const management:AppRole[]=['admin','camp_manager'];
const tableDefinitions:{name:string;roles:AppRole[];columns?:string;order?:string}[]=[
 {name:'camps',roles:['admin','camp_manager','doctor','pharmacist'],order:'id'},
 {name:'camp_patients',roles:['admin','camp_manager','doctor','pharmacist'],columns:'id,uid,camp_id,display_name,age_years,age_band,gender,pregnancy_status,bp_systolic,bp_diastolic,blood_glucose_mg_dl,bmi,consent_recorded,is_emergency,registration_time',order:'registration_time desc'},
 {name:'patient_eligibility',roles:['admin','camp_manager','doctor']},
 {name:'camp_consultations',roles:['admin','camp_manager','doctor']},
 {name:'camp_consultation_diagnoses',roles:['admin','camp_manager','doctor']},
 {name:'centre_referrals',roles:['admin','camp_manager','doctor']},
 {name:'medicine_catalog',roles:['admin','camp_manager','doctor','pharmacist']},
 {name:'camp_pharmacy_inventory',roles:['admin','camp_manager','pharmacist']},
 {name:'camp_pharmacy_dispensations',roles:['admin','camp_manager','pharmacist']},
 {name:'inventory_adjustments',roles:['admin','camp_manager','pharmacist']},
 {name:'camp_staff_roster',roles:management},
 {name:'camp_financial_ledgers',roles:management},
 {name:'capital_projects',roles:allRoles},
 {name:'project_milestones',roles:management},
 {name:'wash_projects',roles:['admin','camp_manager','doctor','pharmacist']},
 {name:'wash_readings',roles:management},
 {name:'community_activities',roles:management},
 {name:'csr_partners',roles:['admin','camp_manager','csr_partner']},
 {name:'csr_commitments',roles:['admin','camp_manager','csr_partner']},
 {name:'csr_memberships',roles:['admin','camp_manager','csr_partner'],order:'user_id,partner_id'},
 {name:'fundraising_campaigns',roles:management},
 {name:'peer_benchmarks',roles:management},
 {name:'bank_routes',roles:['admin']},
 {name:'donors',roles:['admin','donor']},
 {name:'donations',roles:['admin','donor']},
 {name:'donation_certificates',roles:['admin','donor']},
 {name:'sponsorships',roles:['admin','camp_manager','donor']},
 {name:'donor_leads',roles:['admin']},
 {name:'integration_outbox',roles:['admin']},
 {name:'published_reports',roles:['admin','camp_manager','csr_partner','donor']},
 {name:'institutional_documents',roles:['admin','camp_manager','csr_partner','donor']},
 {name:'profiles',roles:['admin'],columns:'id,display_name,role,email'},
 {name:'audit_log',roles:['admin'],order:'created_at desc'},
];

export async function GET(request:Request){try{
 const url=new URL(request.url),patientSearch=url.searchParams.get('patientSearch');
 const data=await actorTransaction(allRoles,async(db,actor)=>{
  const requestedTable=url.searchParams.get('table');
  if(requestedTable){
   const definition=tableDefinitions.find(t=>t.name===requestedTable&&t.roles.includes(actor.role));
   if(!definition)throw new Error('FORBIDDEN');
   const page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page')??0)||0)),query='%'+(url.searchParams.get('query')??'').slice(0,100)+'%';
   const result=await db.query(`select ${definition.columns??'*'},count(*) over()::int as result_count from public.${definition.name} where to_jsonb(${definition.name})::text ilike $1 order by ${definition.order??'id'} limit 20 offset $2`,[query,page*20]);
   return {rows:result.rows,total:Number(result.rows[0]?.result_count??0),page,pageSize:20};
  }
  const selectedPatient=url.searchParams.get('patient_id');
  if(selectedPatient){
   if(!['admin','camp_manager','doctor'].includes(actor.role)||!uuid.safeParse(selectedPatient).success)throw new Error('FORBIDDEN');
   const tables:Record<string,unknown[]>={};
   tables.camp_patients=(await db.query('select * from public.camp_patients where id=$1',[selectedPatient])).rows;
   if(!tables.camp_patients.length)throw new Error('FORBIDDEN');
   for(const name of ['camp_consultations','centre_referrals'])tables[name]=(await db.query(`select * from public.${name} where patient_id=$1 order by id`,[selectedPatient])).rows;
   tables.patient_eligibility=(await db.query('select * from public.patient_eligibility where camp_patient_id=$1',[selectedPatient])).rows;
   return {tables};
  }
  if(patientSearch!==null){
   if(!['admin','camp_manager','doctor','pharmacist'].includes(actor.role))throw new Error('FORBIDDEN');
   const page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page')??0)||0));
   const term='%'+patientSearch.slice(0,100)+'%';
   const {rows}=await db.query('select id,uid,camp_id,display_name,age_years,gender,is_emergency,registration_time,count(*) over() as result_count from public.camp_patients where uid ilike $1 or display_name ilike $1 order by registration_time desc limit 50 offset $2',[term,page*50]);
   return {patients:rows,page};
  }
  const tables:Record<string,unknown[]>={};
  for(const definition of tableDefinitions.filter(t=>t.roles.includes(actor.role))){
   tables[definition.name]=(await db.query(`select ${definition.columns??'*'} from public.${definition.name} order by ${definition.order??'id'} limit 1000`)).rows;
  }
  return {actor,tables,limits:{rowsPerTable:1000}};
 });
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}catch(error){return workspaceError(error)}}

async function save(db:PoolClient,table:string,values:Record<string,unknown>){
 const {id:rowId,...data}=values;
 const keys=Object.keys(data),params=keys.map(k=>data[k]);
 if(!keys.length)throw new Error('No fields to save');
 if(rowId){
  const result=await db.query(`update public.${table} set ${keys.map((k,i)=>`"${k}"=$${i+1}`).join(',')} where id=$${keys.length+1} returning *`,[...params,rowId]);
  if(!result.rows.length)throw new Error('FORBIDDEN');
  return result.rows[0];
 }
 const result=await db.query(`insert into public.${table} (${keys.map(k=>`"${k}"`).join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,params);
 return result.rows[0];
}

export async function POST(request:Request){try{
 sameOrigin(request);
 const body=z.object({action:z.enum(Object.keys(schemas) as [Action,...Action[]]),data:z.unknown()}).parse(await request.json());
 const input=schemas[body.action].parse(body.data) as Record<string,unknown>;
 const administrator:Action[]=['reversal','bank_route','donation_confirmation','tax_certificate','staff_role','published_report','document','enqueue','lead'];
 const allowed:AppRole[]=body.action==='medicine'?['admin','pharmacist']:body.action==='adjustment'?['admin','camp_manager','pharmacist']:administrator.includes(body.action)?['admin']:management;
 const result=await actorTransaction(allowed,async(db,actor)=>execute(db,actor,body.action,input));
 return Response.json({record:result},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:error.flatten()},{status:400});return workspaceError(error)}}

async function execute(db:PoolClient,actor:Actor,action:Action,data:Record<string,unknown>){
 switch(action){
  case 'camp_status':{
   const r=await db.query("update public.camps set status=$1::text::public.camp_status,source_type='operational',approved_by=case when $1::text='approved' then $2::uuid else approved_by end where id=$3 and not exists(select 1 from public.historical_camp_statistics h where h.camp_id=camps.id) returning *",[data.status,actor.id,data.id]);
   if(!r.rows.length)throw new Error('FORBIDDEN');return r.rows[0];
  }
  case 'medicine':return save(db,'medicine_catalog',data);
  case 'camp_metadata':{
   if((await db.query('select 1 from public.historical_camp_statistics where camp_id=$1',[data.id])).rowCount)throw new Error('FORBIDDEN');
   return save(db,'camps',data);
  }
  case 'roster':if(data.payout_status==='paid'&&actor.role!=='admin')throw new Error('FORBIDDEN');return save(db,'camp_staff_roster',data);
  case 'adjustment':return save(db,'inventory_adjustments',{...data,requested_by:actor.id});
  case 'adjustment_decision':await db.query('select public.approve_inventory_adjustment($1,$2)',[data.id,data.approve]);return {id:data.id};
  case 'reversal':{
   const original=(await db.query('select * from public.camp_financial_ledgers where id=$1 and direction=1',[data.id])).rows[0];
   if(!original)throw new Error('FORBIDDEN');
   return save(db,'camp_financial_ledgers',{camp_id:original.camp_id,fund:original.fund,expense:original.expense,amount_paisa:original.amount_paisa,patient_id:original.patient_id,eligibility_id:original.eligibility_id,reversal_of:original.id,direction:-1,posted_by:actor.id,memo:data.reason});
  }
  case 'project':return save(db,'capital_projects',data);
  case 'milestone':return save(db,'project_milestones',data);
  case 'wash_project':return save(db,'wash_projects',data);
  case 'wash_reading':return save(db,'wash_readings',{...data,recorded_by:actor.id});
  case 'community_activity':return save(db,'community_activities',{...data,recorded_by:actor.id});
  case 'csr_partner':return save(db,'csr_partners',data);
  case 'csr_commitment':return save(db,'csr_commitments',data);
  case 'csr_membership':await db.query('insert into public.csr_memberships(user_id,partner_id) values($1,$2) on conflict do nothing',[data.user_id,data.partner_id]);return data;
  case 'campaign':return save(db,'fundraising_campaigns',data);
  case 'benchmark':return save(db,'peer_benchmarks',{...data,verified_by:actor.id});
  case 'bank_route':return save(db,'bank_routes',{...data,iban:String(data.iban).replace(/\s/g,'').toUpperCase(),verified_by:actor.id,verified_at:new Date().toISOString()});
  case 'donation_confirmation':{
   const result=await db.query('select public.confirm_bank_donation($1,$2) as id',[data.id,data.proof_reference]);return result.rows[0];
  }
  case 'tax_certificate':return (await db.query('select public.issue_donation_certificate($1,$2,$3,$4) as id',[data.donation_id,data.authorized_name,data.authorized_title,data.statement])).rows[0];
  case 'lead':throw Object.assign(new Error('Use Lead Management to preserve consent, revisions and conversion evidence'),{code:'P0001'});
  case 'staff_role':await db.query('select public.set_staff_role($1,$2)',[data.user_id,data.role]);return {id:data.user_id,role:data.role};
  case 'published_report':return save(db,'published_reports',{...data,approved_by:actor.id});
  case 'document':return save(db,'institutional_documents',{...data,...(data.status==='verified'?{verified_by:actor.id,verified_at:new Date().toISOString()}:{verified_by:null,verified_at:null})});
  case 'enqueue':{
   let donorId=data.donor_id;
   if(data.kind==='receipt'){
    const donation=(await db.query("select donor_id from public.donations where id=$1 and status='confirmed'",[data.donation_id])).rows[0];
    if(!donation)throw new Error('FORBIDDEN');donorId=donation.donor_id;
   }
   const donor=(await db.query('select * from public.donors where id=$1',[donorId])).rows[0];
   if(!donor||!donor.phone||(data.kind==='receipt'?!donor.receipt_opt_in:!donor.marketing_consent))throw new Error('FORBIDDEN');
   if(data.kind==='impact_report'&&!(await db.query('select 1 from public.published_reports where id=$1',[data.report_id])).rowCount)throw new Error('FORBIDDEN');
   const key=data.kind==='receipt'?`receipt:${data.donation_id}`:`${data.kind}:${donorId}:${data.report_id??new Date().toISOString().slice(0,7)}`;
   return save(db,'integration_outbox',{kind:data.kind,donor_id:donorId,donation_id:data.donation_id??null,report_id:data.report_id??null,dedupe_key:key});
  }
 }
}
