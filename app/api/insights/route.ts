import { actorTransaction,workspaceError } from '@/lib/actor-db';
import { medicineForecast,donorRetention,campaignPerformance,sponsorMatches } from '@/lib/insights';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const target=Number(new URL(request.url).searchParams.get('target')??300);
  if(!Number.isInteger(target)||target<1||target>100000)return Response.json({error:'Target must be an integer between 1 and 100,000'},{status:400});
  const data=await actorTransaction(['admin','camp_manager'],async db=>{
   // Full authorized cohorts: workspace table pagination never changes estimates.
   const load=async(table:string,columns:string)=>(await db.query(`select ${columns} from public.${table}`)).rows;
   const patients=await load('camp_patients','id');
   const dispensations=await load('camp_pharmacy_dispensations','patient_id,inventory_id,units');
   const inventory=await load('camp_pharmacy_inventory','id,medicine_id');
   const medicines=await load('medicine_catalog','id,generic_name,stock_unit');
   const donors=await load('donors','id,full_name,marketing_consent');
   const donations=await load('donations','donor_id,campaign_id,status,created_at,currency,amount_minor_units');
   const campaigns=await load('fundraising_campaigns','id,title,spend_paisa');
   const partners=await load('csr_partners','organization,interests,consent_to_contact');
   const projects=await load('capital_projects','title,description');
   return {forecast:medicineForecast({patients,dispensations,inventory,medicines,targetPatients:target}),retention:donorRetention(donors,donations),campaigns:campaignPerformance(campaigns,donations),matches:sponsorMatches(partners,projects),coverage:{patients:patients.length,dispensations:dispensations.length,donations:donations.length},computedAt:new Date().toISOString()};
  });
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return workspaceError(error)}
}
