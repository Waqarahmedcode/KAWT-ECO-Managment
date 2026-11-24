import { actorTransaction } from '@/lib/actor-db';
import { periodInput } from '@/lib/departments';
import { onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
export async function GET(request: Request) {
 try {
  const q=new URL(request.url).searchParams, range=periodInput.parse({start:q.get('start'),end:q.get('end')});
  const result=await actorTransaction(['admin'],async db=>{
   const visits=(await db.query("select department,count(*)::int visits,count(*) filter(where payment_category='free')::int free,count(*) filter(where payment_category='subsidized')::int subsidized,count(*) filter(where payment_category='panel')::int panel from public.kawt_department_visits where not voided and service_date between $1 and $2 group by department",[range.start,range.end])).rows;
   const lab=(await db.query("select count(*)::int visits,coalesce(sum((select sum((t->>'quantity')::int) from jsonb_array_elements(v.tests) t)),0)::int tests from public.kawt_lab_visits v where not voided and service_date between $1 and $2",[range.start,range.end])).rows[0];
   const camps=(await db.query('select count(*)::int visits from public.camp_patients where (registration_time at time zone \'Asia/Karachi\')::date between $1 and $2',[range.start,range.end])).rows[0];
   const leads=(await db.query("select count(*)::int received,count(*) filter(where contact_status='converted' and exists(select 1 from public.donations d where d.donor_id=donor_leads.linked_donor_id and d.status='confirmed'))::int verified_converted from public.donor_leads where (submitted_at at time zone 'Asia/Karachi')::date between $1 and $2",[range.start,range.end])).rows[0];
   const overdue=(await db.query("select count(*)::int count from public.donor_leads where next_follow_up<(now() at time zone 'Asia/Karachi')::date and marketing_consent and contact_status not in ('converted','do_not_contact')")).rows[0].count;
   return {range,visits,lab,camps,leads,overdue};
  });return Response.json(result,{headers:onboardingHeaders});
 }catch(e){return onboardingError(e);}
}
