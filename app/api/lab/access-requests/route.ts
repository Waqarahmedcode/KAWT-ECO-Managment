import { actorTransaction, allRoles, sameOrigin } from '@/lib/actor-db';
import { staffRequestInput } from '@/lib/laboratory-onboarding';
import { onboardingBody, onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
export async function GET() {
 try {
  const result = await actorTransaction(allRoles, async (client, actor) => {
   const profile = (await client.query('select role from public.profiles where id=$1', [actor.id])).rows[0];
   return {
    requests: (await client.query('select * from public.kawt_lab_access_requests where user_id=$1 order by created_at desc,id desc limit 20', [actor.id])).rows,
    grant: (await client.query('select access,active,laboratory_name,revision from public.kawt_lab_access where user_id=$1', [actor.id])).rows[0] ?? null,
    canRequest: profile?.role === 'donor',
   };
  });
  return Response.json(result, { headers: onboardingHeaders });
 } catch (error) { return onboardingError(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const input = staffRequestInput.parse(await onboardingBody(request));
  const result = await actorTransaction(allRoles, async (client, actor) => {
   await client.query("select pg_advisory_xact_lock(hashtext('kawt-lab-request:'||$1))", [actor.id]);
   if (input.action === 'withdraw') {
    const changed = (await client.query("update public.kawt_lab_access_requests set status='withdrawn' where id=$1 and user_id=$2 and revision=$3 and status='pending' returning *", [input.id, actor.id, input.revision])).rows[0];
    if (!changed) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
    return { request: changed, alreadyPending: false };
   }
   const profile = (await client.query('select role from public.profiles where id=$1', [actor.id])).rows[0];
   if (profile?.role !== 'donor') throw new Error('FORBIDDEN');
   const pending = (await client.query("select * from public.kawt_lab_access_requests where user_id=$1 and status='pending'", [actor.id])).rows[0];
   if (pending) return { request: pending, alreadyPending: true };
   const grant = (await client.query('select access,active,laboratory_name from public.kawt_lab_access where user_id=$1', [actor.id])).rows[0];
   if (grant?.active && grant.access === input.requested_access && grant.laboratory_name.trim().toLowerCase() === input.laboratory_name.toLowerCase()) return { alreadyGranted: true };
   const created = (await client.query('insert into public.kawt_lab_access_requests(user_id,laboratory_name,requested_access,message) values($1,$2,$3,$4) returning *', [actor.id, input.laboratory_name, input.requested_access, input.message])).rows[0];
   return { request: created, alreadyPending: false };
  });
  return Response.json(result, { headers: onboardingHeaders });
 } catch (error) { return onboardingError(error); }
}
