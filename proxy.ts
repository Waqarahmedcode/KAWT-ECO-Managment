import { createServerClient,type CookieOptions } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
import { supabasePublicKey } from '@/lib/supabase-config';

/** Refresh session cookies before server components consume them. Authorization
 * remains in each handler and PostgreSQL RLS, never in this routing hook. */
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=supabasePublicKey();
 if(!url||!key)return response;
 const supabase=createServerClient(url,key,{cookies:{
  getAll:()=>request.cookies.getAll(),
  setAll(values:{name:string;value:string;options:CookieOptions}[]){
   values.forEach(({name,value})=>request.cookies.set(name,value));
   response=NextResponse.next({request});
   values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
  },
 }});
 await supabase.auth.getUser();
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/dashboard/:path*','/referrals/:path*','/donations/:path*','/login','/lab/:path*','/api/lab/:path*','/medical-centre/:path*','/api/medical-centre/:path*','/api/workspace','/api/insights','/api/offline/context']};
