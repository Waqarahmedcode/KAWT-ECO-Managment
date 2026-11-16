import 'server-only';
import { getSupabase } from './supabase';
export type AppRole='admin'|'camp_manager'|'doctor'|'pharmacist'|'donor'|'csr_partner';
export async function requireRole(allowed:AppRole[]){
 const supabase=await getSupabase();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)throw new Error('UNAUTHENTICATED');
 const {data,error:roleError}=await supabase.from('profiles').select('role').eq('id',user.id).single();
 if(roleError||!data||!allowed.includes(data.role as AppRole))throw new Error('FORBIDDEN');
 return {user,role:data.role as AppRole};
}
export function authError(err:unknown){
 const message=err instanceof Error?err.message:'INTERNAL_ERROR';
 return Response.json({error:message==='UNAUTHENTICATED'?'Sign in required':message==='FORBIDDEN'?'Insufficient permissions':'Request failed'}, {status:message==='UNAUTHENTICATED'?401:message==='FORBIDDEN'?403:500});
}
