import { sameOrigin } from '@/lib/actor-db';
import { z } from 'zod';
import { requireRole,authError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
const category=z.enum(['GI_ACIDITY','MUSCULOSKELETAL','RESPIRATORY_ALLERGY','DERMATOLOGY','INFECTIONS','NEUROLOGICAL','NUTRITION_ANEMIA','OTHER']);
const schema=z.object({camp_id:z.string().regex(/^FMC-\d{2,3}$/),patient_id:z.string().uuid(),chief_complaint:z.string().max(500).optional(),clinical_note:z.string().max(4000).optional(),diagnoses:z.array(category).min(1).max(8)});
export async function POST(request:Request){try{sameOrigin(request);const {user}=await requireRole(['admin','doctor']);const input=schema.parse(await request.json());const supabase=await getSupabase();const {data:patient}=await supabase.from('camp_patients').select('id').eq('id',input.patient_id).eq('camp_id',input.camp_id).single();if(!patient)return Response.json({error:'Patient/camp mismatch'},{status:400});
 const {data:consult,error}=await supabase.from('camp_consultations').insert({patient_id:input.patient_id,camp_id:input.camp_id,clinician_id:user.id,chief_complaint:input.chief_complaint,clinical_note:input.clinical_note}).select('id').single();if(error||!consult)return Response.json({error:error?.message??'Cannot create consultation'},{status:400});
 const {error:dxErr}=await supabase.from('camp_consultation_diagnoses').insert(input.diagnoses.map((d,i)=>({consultation_id:consult.id,category:d,primary_diagnosis:i===0})));
 if(dxErr)return Response.json({consultation_id:consult.id,error:'Consultation saved but diagnosis tagging failed. Reconcile before reporting.'},{status:207});return Response.json({consultation_id:consult.id},{status:201});
 }catch(e){if(e instanceof z.ZodError)return Response.json({error:e.flatten()},{status:400});return authError(e)}}
