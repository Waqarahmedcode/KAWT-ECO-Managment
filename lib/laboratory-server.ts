import 'server-only';
import type { PoolClient } from 'pg';
import { getSupabase } from './supabase';
import { getPool } from './db';
import { mainLaboratoryName } from './laboratory';

export async function requireLabAccess(write = false) {
 const supabase = await getSupabase();
 const { data: { user }, error } = await supabase.auth.getUser();
 if (error || !user) throw new Error('UNAUTHENTICATED');
 const client = await getPool().connect();
 let profile: { role: string; access?: string; active?: boolean; laboratory_name?: string } | undefined;
 try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [user.id, JSON.stringify({ sub: user.id, role: 'authenticated' })]);
  profile = (await client.query('select p.role,a.access,a.active,a.laboratory_name from public.profiles p left join public.kawt_lab_access a on a.user_id=p.id where p.id=$1', [user.id])).rows[0];
  await client.query('COMMIT');
 } catch (error) { await client.query('ROLLBACK');throw error; }
 finally { client.release(); }
 if (profile?.role === 'admin') return { user, access: 'admin' as const, laboratory_name: mainLaboratoryName };
 // Dedicated lab accounts retain the unprivileged base profile. A lab grant
 // never adds clinical, finance or general staff rights.
 if (profile?.role !== 'donor' || !profile.active || !['operator', 'viewer'].includes(profile.access ?? '') || (write && profile.access !== 'operator')) throw new Error('FORBIDDEN');
 return { user, access: profile.access as 'operator' | 'viewer', laboratory_name: profile.laboratory_name ?? mainLaboratoryName };
}
export async function labTransaction<T>(write: boolean, operation: (client: PoolClient, actor: Awaited<ReturnType<typeof requireLabAccess>>) => Promise<T>) {
 const actor = await requireLabAccess(write);
 const client = await getPool().connect();
 try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [actor.user.id, JSON.stringify({ sub: actor.user.id, role: 'authenticated' })]);
  const result = await operation(client, actor);
  await client.query('COMMIT');
  return result;
 } catch (error) { await client.query('ROLLBACK'); throw error; }
 finally { client.release(); }
}
