import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
export async function GET(request:Request){
 try{
  await requireRole(['admin']);
  const path=z.string().regex(/^FMC-\d{2,3}\/[0-9a-f-]{36}\.(pdf|jpe?g|png)$/).parse(new URL(request.url).searchParams.get('path'));
  const supabase=await getSupabase();
  const {data,error}=await supabase.storage.from('private-camp-receipts').createSignedUrl(path,60,{download:true});
  if(error)return Response.json({error:'Receipt evidence was not found'},{status:404});
  return Response.json({url:data.signedUrl,expiresIn:60},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Invalid receipt path'},{status:400});return authError(error)}
}
