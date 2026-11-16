import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';
import { sameOrigin,workspaceError } from '@/lib/actor-db';

export async function POST(request:Request){try{
 sameOrigin(request);
 const input=z.object({action:z.enum(['signin','signup','signout']),email:z.string().email().optional(),password:z.string().min(12).max(200).optional(),full_name:z.string().trim().min(2).max(140).optional()}).parse(await request.json());
 const supabase=await getSupabase();
 if(input.action==='signout'){await supabase.auth.signOut();return Response.json({signedOut:true})}
 if(!input.email||!input.password)return Response.json({error:'Email and password are required; passwords must contain at least 12 characters'},{status:400});
 const result=input.action==='signup'?await supabase.auth.signUp({email:input.email,password:input.password,options:{data:{full_name:input.full_name}}}):await supabase.auth.signInWithPassword({email:input.email,password:input.password});
 if(result.error)return Response.json({error:input.action==='signin'?'Unable to sign in. Check your credentials and email confirmation.':result.error.message},{status:400});
 return Response.json({authenticated:Boolean(result.data.session),confirmationRequired:!result.data.session});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:'Check your email and password format'},{status:400});return workspaceError(error)}}
