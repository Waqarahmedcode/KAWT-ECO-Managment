import { sameOrigin } from '@/lib/actor-db';
import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { randomUUID } from 'node:crypto';
const schema=z.object({camp_id:z.string().regex(/^FMC-\d{2,3}$/),filename:z.string().max(120).regex(/^[a-zA-Z0-9_.-]+$/)});
export async function POST(request:Request){try{sameOrigin(request);await requireRole(['admin']);const input=schema.parse(await request.json());const ext=input.filename.split('.').at(-1)?.toLowerCase();if(!['pdf','jpg','jpeg','png'].includes(ext??''))return Response.json({error:'Allowed: PDF/JPG/PNG'},{status:400});const path=`${input.camp_id}/${randomUUID()}.${ext}`;const supabase=await getSupabase();const {data,error}=await supabase.storage.from('private-camp-receipts').createSignedUploadUrl(path);if(error)return Response.json({error:error.message},{status:400});return Response.json({...data,path,storage_bucket:'private-camp-receipts'})}catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
