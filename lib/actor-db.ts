import 'server-only';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import { requireRole, type AppRole } from './auth';

export const allRoles: AppRole[] = ['admin','camp_manager','doctor','pharmacist','donor','csr_partner'];
export type Actor = { id:string; role:AppRole };

/** A server connection deliberately switches to the same RLS role as Supabase. */
export async function actorTransaction<T>(allowed:AppRole[], operation:(db:PoolClient,actor:Actor)=>Promise<T>):Promise<T>{
 const {user,role}=await requireRole(allowed);
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user.id,JSON.stringify({sub:user.id,role:'authenticated'})]);
  const result=await operation(client,{id:user.id,role});
  await client.query('COMMIT');
  return result;
 }catch(error){await client.query('ROLLBACK');throw error}
 finally{client.release()}
}

export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 // Next's proxy can normalize the internal Request URL to localhost. Validate
 // browser writes against the configured public origin, never a forwarded host.
 const expected=new URL(process.env.NEXT_PUBLIC_SITE_URL??request.url).origin;
 if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==expected))throw new Error('FORBIDDEN');
}

export function workspaceError(error:unknown){
 const value=error as {message?:string;code?:string};
 if(value.message==='UNAUTHENTICATED')return Response.json({error:'Sign in required'},{status:401});
 if(value.message==='FORBIDDEN'||value.code==='42501')return Response.json({error:'Your role cannot perform this action'},{status:403});
 if(value.code==='23505')return Response.json({error:'This record already exists; refresh before retrying'},{status:409});
 if(value.code==='23503')return Response.json({error:'A linked record could not be found'},{status:400});
 if(value.code==='23514'||value.code==='P0001')return Response.json({error:value.message??'Database rule rejected this change'},{status:400});
 console.error('Workspace request failed',value.code??'unknown');
 return Response.json({error:'Unable to complete the request'},{status:500});
}
