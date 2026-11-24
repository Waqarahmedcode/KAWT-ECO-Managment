import 'server-only';
import type { PoolClient } from 'pg';
import { actorTransaction, allRoles, type Actor } from './actor-db';
import type { Department } from './departments';
export async function departmentTransaction<T>(department: Department, write: boolean, action: (db: PoolClient, actor: Actor, operator: boolean) => Promise<T>) {
 return actorTransaction(allRoles, async (db, actor) => {
  const rights = (await db.query('select public.kawt_department_allowed($1,false) as allowed,public.kawt_department_allowed($1,true) as operator', [department])).rows[0];
  if (!rights.allowed || (write && !rights.operator)) throw new Error('FORBIDDEN');
  return action(db, actor, rights.operator);
 });
}
