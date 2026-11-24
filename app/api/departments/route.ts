import { actorTransaction, allRoles } from '@/lib/actor-db';
import { onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
export async function GET() {
 try {
  const result = await actorTransaction(allRoles, async (db, actor) => ({ actor, grants: (await db.query('select department,access,active,revision from public.kawt_department_access where user_id=$1', [actor.id])).rows, lab: (await db.query('select active,access from public.kawt_lab_access where user_id=$1', [actor.id])).rows[0] ?? null }));
  return Response.json(result, { headers: onboardingHeaders });
 } catch (e) { return onboardingError(e); }
}
