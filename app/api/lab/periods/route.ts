import { labTransaction } from '@/lib/laboratory-server';
import { workspaceError } from '@/lib/actor-db';
export async function GET() {
 try {
  const result = await labTransaction(false, async client => ({
   periods: (await client.query("select distinct laboratory_name,period_kind,period_start::text,period_end::text from public.kawt_lab_reports order by period_end desc,period_start desc")).rows,
  }));
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) { return workspaceError(error); }
}
