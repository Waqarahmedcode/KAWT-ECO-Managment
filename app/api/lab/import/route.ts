import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { sameOrigin, workspaceError } from '@/lib/actor-db';
import { importLabFile } from '@/lib/laboratory-file-import';
import { mainLaboratoryName } from '@/lib/laboratory';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 try{
  sameOrigin(request);await requireRole(['admin']);
  const length=Number(request.headers.get('content-length')||0);
  if(length>9*1024*1024)return Response.json({error:'Source file bohat bari hai'},{status:413});
  const form=await request.formData(),file=form.get('file');
  if(!(file instanceof File)||file.size>8*1024*1024)return Response.json({error:'8 MB tak ki source file darkar hai'},{status:400});
  const context=z.object({laboratory_name:z.string().trim().min(1).max(180),kind:z.string().max(20),start:z.string().max(10),end:z.string().max(10),approvedTemplate:z.boolean()}).parse({laboratory_name:form.get('laboratory_name')||mainLaboratoryName,kind:form.get('kind')||'',start:form.get('start')||'',end:form.get('end')||'',approvedTemplate:form.get('approvedTemplate')==='true'});
  const result=await importLabFile(Buffer.from(await file.arrayBuffer()),file.name,context);
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  if(error instanceof Error&&!['UNAUTHENTICATED','FORBIDDEN'].includes(error.message))return Response.json({error:error.message.slice(0,600)},{status:400});
  return workspaceError(error);
 }
}
