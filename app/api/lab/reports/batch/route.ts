import { z } from 'zod';
import { sameOrigin, workspaceError } from '@/lib/actor-db';
import { labReportSchema } from '@/lib/laboratory';
import { labTransaction } from '@/lib/laboratory-server';
const schema=z.array(labReportSchema).min(1).max(24).superRefine((items,ctx)=>{
 const periods=new Set<string>();
 items.forEach((item,i)=>{
  if(item.id||item.revision)ctx.addIssue({code:'custom',path:[i],message:'Batch import sirf naye source periods ke liye hai; existing records latest revision se edit karein'});
  const key=[item.laboratory_name.toLowerCase(),item.period_kind,item.period_start,item.period_end].join('/');
  if(periods.has(key))ctx.addIssue({code:'custom',path:[i],message:'Batch mein wahi period do martaba hai'});periods.add(key);
 });
});
export async function POST(request:Request){
 try{
  sameOrigin(request);const text=await request.text();
  if(text.length>5_000_000)return Response.json({error:'Report batch bohat bara hai'},{status:413});
  let raw:unknown;try{raw=JSON.parse(text);}catch{return Response.json({error:'Valid source reports darkar hain'},{status:400});}
  const items=schema.parse(raw);
  const reports=await labTransaction(true,async(client,actor)=>{
   if(actor.access!=='admin')throw new Error('FORBIDDEN');
   const result=[];
   for(const item of items)result.push((await client.query('insert into public.kawt_lab_reports(laboratory_name,period_kind,period_start,period_end,source_label,entry_mode,payload,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$8) returning id,period_start::text,period_end::text,revision',[item.laboratory_name,item.period_kind,item.period_start,item.period_end,item.source_label,'historical_import',JSON.stringify(item.payload),actor.user.id])).rows[0]);
   return result;
  });
  return Response.json({reports,saved:reports.length},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message??'Source report fields check karein'},{status:400});
  return workspaceError(error);
 }
}
