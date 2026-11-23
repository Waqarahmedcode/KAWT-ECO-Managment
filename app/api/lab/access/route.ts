import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { sameOrigin, workspaceError } from '@/lib/actor-db';
import { mainLaboratoryName } from '@/lib/laboratory';
import { getPool } from '@/lib/db';

export async function POST(request: Request) {
 try {
  sameOrigin(request);
  const actor = await requireRole(['admin']);
  const input = z.object({ email: z.string().email().max(254), access: z.enum(['operator', 'viewer']), active: z.boolean(), laboratory_name: z.string().trim().min(1).max(180).default(mainLaboratoryName) }).strict().parse(await request.json());
  const client = await getPool().connect();
  try {
   await client.query('BEGIN');
   const target = (await client.query("select u.id,u.email_confirmed_at,p.role from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower($1)", [input.email])).rows[0];
   if (!target || (input.active && !target.email_confirmed_at)) { await client.query('ROLLBACK');return Response.json({ error: 'Existing verified account darkar hai. Account ya email is action se create nahin hota.' }, { status: 400 }); }
   if (target.role !== 'donor') { await client.query('ROLLBACK');return Response.json({ error: 'Dedicated lab account ka koi doosra staff role nahin hona chahiye. Existing roles ko downgrade nahin kiya gaya.' }, { status: 409 }); }
   await client.query('SET LOCAL ROLE authenticated');
   await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [actor.user.id, JSON.stringify({ sub: actor.user.id, role: 'authenticated' })]);
   await client.query('insert into public.kawt_lab_access(user_id,access,active,granted_by,laboratory_name) values($1,$2,$3,$4,$5) on conflict(user_id) do update set access=excluded.access,active=excluded.active,granted_by=excluded.granted_by,laboratory_name=excluded.laboratory_name,changed_at=now()', [target.id, input.access, input.active, actor.user.id, input.laboratory_name]);
   await client.query('COMMIT');
   return Response.json({ assigned: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { await client.query('ROLLBACK');throw error; }
  finally { client.release(); }
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: 'Valid work email aur access level darj karein' }, { status: 400 });
  return workspaceError(error);
 }
}
