import { departmentGrantInput } from '@/lib/departments';
import { actorTransaction, sameOrigin } from '@/lib/actor-db';
import { requireRole } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { onboardingBody, onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
export async function GET() {
 try {
  const grants = await actorTransaction(['admin'], async db => (await db.query('select * from public.kawt_department_directory()')).rows);
  return Response.json({ grants: grants.slice(0, 500), truncated: grants.length > 500 }, { headers: onboardingHeaders });
 } catch (e) { return onboardingError(e); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const actor = await requireRole(['admin']), input = departmentGrantInput.parse(await onboardingBody(request));
  const db = await getPool().connect();
  try {
   await db.query('BEGIN');
   const targets = (await db.query('select u.id from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower($1)', [input.email])).rows;
   if (targets.length !== 1) throw Object.assign(new Error('An existing verified staff account is required'), { code: 'P0001' });
   const id = targets[0].id;
   await db.query('SET LOCAL ROLE authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor.user.id]);
   await db.query("select pg_advisory_xact_lock(hashtext('kawt-department-grant:'||$1||':'||$2))", [id, input.department]);
   const current = (await db.query('select revision from public.kawt_department_access where user_id=$1 and department=$2 for update', [id, input.department])).rows[0];
   if ((current?.revision ?? null) !== input.revision) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   if (!input.active && !current) throw Object.assign(new Error('No assignment to disable'), { code: 'P0001' });
   await db.query('insert into public.kawt_department_access(user_id,department,access,active) values($1,$2,$3,$4) on conflict(user_id,department) do update set access=excluded.access,active=excluded.active', [id, input.department, input.access, input.active]);
   await db.query('COMMIT');return Response.json({ saved: true }, { headers: onboardingHeaders });
  } catch (e) { await db.query('ROLLBACK');throw e; } finally { db.release(); }
 } catch (e) { return onboardingError(e); }
}
