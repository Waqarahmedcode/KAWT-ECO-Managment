import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { sourcePreviewRows } from './source-preview';
export type CampView={id:string;name:string;date:string|null;area:string;status:'completed'|'planned'|'approved'|'site_review'|'in_progress'|'cancelled';patients:number;zakat:number;general:number;spend:number;medicineUnits:number;emergencies:number;referrals:number;dataNote:string|null;source:'legacy_source'|'operational';maleRecorded:number|null;femaleRecorded:number|null;childrenRecorded:number|null;adultsRecorded:number|null;elderlyRecorded:number|null;livePatients:number};
export async function dashboardRows(live:boolean):Promise<CampView[]>{
 if(!live)return sourcePreviewRows();
 const db=getDb();
 const result=await db.execute(sql`select c.id,c.title as name,c.camp_date::text as date,c.area,c.status::text as status,c.source_type as source,
 case when h.camp_id is not null then h.total_patients else coalesce((select count(*) from public.camp_patients p where p.camp_id=c.id),0)::int end as patients,
 case when h.camp_id is not null then h.zakat_spend_paisa else coalesce((select sum(amount_paisa*direction) from public.camp_financial_ledgers f where f.camp_id=c.id and f.fund='ZAKAT'),0)::bigint end as zakat_paisa,
 case when h.camp_id is not null then h.general_spend_paisa else coalesce((select sum(amount_paisa*direction) from public.camp_financial_ledgers f where f.camp_id=c.id and f.fund='GENERAL'),0)::bigint end as general_paisa,
 case when h.camp_id is not null then h.total_spend_paisa else coalesce((select sum(amount_paisa*direction) from public.camp_financial_ledgers f where f.camp_id=c.id),0)::bigint end as spend_paisa,
 case when h.camp_id is not null then coalesce(h.medicine_units_reported,0)::int else coalesce((select sum(i.dispensed_units) from public.camp_pharmacy_inventory i where i.camp_id=c.id),0)::int end as medicine_units,
 case when h.camp_id is not null then coalesce(h.emergencies_recorded,0)::int else (select count(*)::int from public.camp_patients p where p.camp_id=c.id and p.is_emergency) end as emergencies,
 case when h.camp_id is not null then coalesce(h.referrals_recorded,0)::int else coalesce((select count(*) from public.centre_referrals r where r.camp_id=c.id),0)::int end as referrals,
 h.data_note,h.male_recorded,h.female_recorded,h.children_recorded,h.adults_recorded,h.elderly_recorded,
 (select count(*)::int from public.camp_patients p where p.camp_id=c.id) as live_patients
 from public.camps c left join public.historical_camp_statistics h on h.camp_id=c.id order by c.id`);
 const nullableNumber=(value:unknown)=>value==null?null:Number(value);
 return result.rows.map((r)=>({id:String(r.id),name:String(r.name),date:r.date==null?null:String(r.date),area:String(r.area),status:String(r.status) as CampView['status'],source:String(r.source) as CampView['source'],
 patients:Number(r.patients),zakat:Number(r.zakat_paisa)/100,general:Number(r.general_paisa)/100,spend:Number(r.spend_paisa)/100,medicineUnits:Number(r.medicine_units),emergencies:Number(r.emergencies),referrals:Number(r.referrals),dataNote:r.data_note==null?null:String(r.data_note),maleRecorded:nullableNumber(r.male_recorded),femaleRecorded:nullableNumber(r.female_recorded),childrenRecorded:nullableNumber(r.children_recorded),adultsRecorded:nullableNumber(r.adults_recorded),elderlyRecorded:nullableNumber(r.elderly_recorded),livePatients:Number(r.live_patients)}));
}
