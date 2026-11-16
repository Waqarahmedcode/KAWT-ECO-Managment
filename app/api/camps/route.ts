import { sameOrigin } from '@/lib/actor-db';
import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
const schema=z.object({id:z.string().regex(/^FMC-[0-9]{2,3}$/),title:z.string().min(4).max(180),area:z.string().min(3).max(200),camp_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),address:z.string().max(350).optional(),hazard_assessment:z.object({flood:z.boolean(),heat:z.boolean(),road_access:z.string().max(300),ambulance_access:z.string().max(300),assessor_notes:z.string().max(1000)}).optional()});
export async function POST(request:Request){try{sameOrigin(request);await requireRole(['admin','camp_manager']);const payload=schema.parse(await request.json());const supabase=await getSupabase();const {data,error}=await supabase.from('camps').insert({...payload,status:'site_review'}).select('id,status').single();if(error)throw error;return Response.json(data,{status:201})}catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
