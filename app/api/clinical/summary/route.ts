import { actorTransaction,workspaceError } from '@/lib/actor-db';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const camp=new URL(request.url).searchParams.get('camp')??'ALL';
  if(camp!=='ALL'&&!/^FMC-\d{2,3}$/.test(camp))return Response.json({error:'Invalid camp'},{status:400});
  const data=await actorTransaction(['admin','camp_manager','doctor'],async db=>{
   const filter=camp==='ALL'?null:camp;
   const population=(await db.query('select count(*)::int as registered,count(*) filter(where gender=\'female\')::int as female,count(*) filter(where gender=\'male\')::int as male,count(*) filter(where gender=\'undisclosed\')::int as undisclosed,count(*) filter(where age_years<=14)::int as children,count(*) filter(where age_years between 15 and 59)::int as adults,count(*) filter(where age_years>=60)::int as elderly from public.camp_patients where ($1::text is null or camp_id=$1)',[filter])).rows[0];
   const denominator=Number((await db.query('select count(distinct patient_id)::int as total from public.camp_consultations where ($1::text is null or camp_id=$1)',[filter])).rows[0].total);
   const diagnoses=(await db.query('select d.category,count(distinct c.patient_id)::int as patients from public.camp_consultation_diagnoses d join public.camp_consultations c on c.id=d.consultation_id where ($1::text is null or c.camp_id=$1) group by d.category order by patients desc',[filter])).rows;
   return {population,consultedPatients:denominator,diagnoses:diagnoses.map(d=>({...d,percentage:denominator?Math.round(Number(d.patients)*1000/denominator)/10:0}))};
  });
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return workspaceError(error)}
}
