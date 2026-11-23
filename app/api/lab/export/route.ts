import { z } from 'zod';
import { workspaceError } from '@/lib/actor-db';
import { labTransaction } from '@/lib/laboratory-server';
import { laboratoryXlsx } from '@/lib/report-xlsx';
import type { LabReport } from '@/lib/laboratory';
export async function GET(request: Request) {
 try {
  const id = new URL(request.url).searchParams.get('id');
  if (!z.uuid().safeParse(id).success) return Response.json({ error: 'Valid saved report reference darkar hai' }, { status: 400 });
  const report = await labTransaction(false, async client => (await client.query('select id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,entry_mode,payload,revision,updated_at from public.kawt_lab_reports where id=$1', [id])).rows[0] as LabReport | undefined);
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
  return new Response(new Uint8Array(laboratoryXlsx(report)), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="KAWT-lab-' + report.period_start + '-v' + report.revision + '.xlsx"', 'Cache-Control': 'private, no-store' } });
 } catch (error) { return workspaceError(error); }
}
