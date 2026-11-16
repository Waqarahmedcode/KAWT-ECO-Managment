import { actorTransaction,workspaceError } from '@/lib/actor-db';
import { getPool } from '@/lib/db';
import { receiptPdf } from '@/server/receipt-pdf';
import { verifyDocumentToken } from '@/server/document-access';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
  const url=new URL(request.url),token=url.searchParams.get('token'),secret=process.env.APP_RECEIPT_SECRET;
  const signed=Boolean(token&&secret&&verifyDocumentToken(token,id,secret));
  const query='select n.id,n.fund,n.currency,n.amount_minor_units,n.refunded_minor_units,n.confirmed_at,n.status,n.provider,d.full_name from public.donations n join public.donors d on d.id=n.donor_id where n.id=$1 and n.status in (\'confirmed\',\'refunded\')';
  const record=signed?(await getPool().query(query,[id])).rows[0]:await actorTransaction(['admin','donor'],async db=>(await db.query(query,[id])).rows[0]);
  if(!record)return new Response('Not found',{status:404});
  const certificate=url.searchParams.get('certificate')==='true'?(await getPool().query('select * from public.donation_certificates where donation_id=$1',[id])).rows[0]:undefined;
  if(url.searchParams.get('certificate')==='true'&&(!certificate||record.status!=='confirmed'||Number(record.refunded_minor_units)!==0))return Response.json({error:'A valid authorized certificate is not available'},{status:409});
  const pdf=await receiptPdf(record,certificate);
  return new Response(Buffer.from(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="KAWT-${certificate?'certificate':'receipt'}-${id}.pdf"`,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 }catch(error){return workspaceError(error)}
}
