import { sameOrigin } from '@/lib/actor-db';
import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
const schema=z.object({camp_id:z.string().regex(/^FMC-\d{2,3}$/),medicine_id:z.string().uuid(),batch_no:z.string().max(100).default('UNSPECIFIED'),opening_units:z.coerce.number().int().min(0),procured_units:z.coerce.number().int().min(0),wastage_units:z.coerce.number().int().min(0).default(0)});
export async function POST(request:Request){try{sameOrigin(request);const {user}=await requireRole(['admin','camp_manager','pharmacist']);const input=schema.parse(await request.json());if(input.wastage_units>input.opening_units+input.procured_units)return Response.json({error:'Wastage exceeds available units'},{status:400});const supabase=await getSupabase();const {data,error}=await supabase.from('camp_pharmacy_inventory').insert({...input,confirmed_by:user.id}).select('id,closing_units').single();if(error)return Response.json({error:error.message},{status:409});return Response.json({inventory:data},{status:201})}catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
