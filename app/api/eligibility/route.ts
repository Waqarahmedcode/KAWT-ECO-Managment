import { sameOrigin } from '@/lib/actor-db';
import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
const schema=z.object({camp_patient_id:z.string().uuid(),eligible_for_zakat:z.boolean(),screening_reference:z.string().min(4).max(255)});
export async function POST(request:Request){try{sameOrigin(request);const {user}=await requireRole(['admin','camp_manager']);const input=schema.extend({subsidy_percent:z.union([z.literal(25),z.literal(50),z.literal(100)]).default(100)}).parse(await request.json());const supabase=await getSupabase();const {data,error}=await supabase.from('patient_eligibility').insert({...input,approved_by:user.id}).select('id,eligible_for_zakat,approved_at').single();if(error)return Response.json({error:error.message},{status:409});return Response.json({approval:data},{status:201})}catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
