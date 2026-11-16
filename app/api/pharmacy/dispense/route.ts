import { sameOrigin } from '@/lib/actor-db';
import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
const schema=z.object({inventory_id:z.string().uuid(),patient_id:z.string().uuid(),units:z.coerce.number().int().positive().max(10000)});
export async function POST(request:Request){try{sameOrigin(request);const {user}=await requireRole(['admin','pharmacist']);const v=schema.parse(await request.json());const supabase=await getSupabase();const {data,error}=await supabase.from('camp_pharmacy_dispensations').insert({...v,dispensed_by:user.id}).select('id,units,dispensed_at').single();if(error)return Response.json({error:error.message},{status:409});return Response.json({dispensation:data},{status:201});}catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
