import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { supabasePublicKey } from './supabase-config';
export async function getSupabase(){
 const cookieStore=await cookies();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=supabasePublicKey();
 if(!url || !key)throw new Error('Missing Supabase configuration');
 return createServerClient(url,key,{cookies:{
  getAll(){return cookieStore.getAll()},
  setAll(toSet:{name:string;value:string;options:CookieOptions}[]){try{toSet.forEach(({name,value,options})=>cookieStore.set(name,value,options))}catch{/* server component: middleware/callback updates cookies */}}
 }});
}
