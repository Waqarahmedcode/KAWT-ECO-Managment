import { z } from 'zod';
import { workspaceError } from '@/lib/actor-db';
import { labTransaction } from '@/lib/laboratory-server';
import { labSummaryQuery, summarizeLabReports } from '@/lib/laboratory-reporting';
import type { LabReport } from '@/lib/laboratory';
import { laboratoryXlsx } from '@/lib/report-xlsx';
export async function GET(request: Request) {
 try {
  const url = new URL(request.url), format = url.searchParams.get('format');
  const parsed = labSummaryQuery.parse({ kind: url.searchParams.get('kind'), start: url.searchParams.get('start'), end: url.searchParams.get('end'), ...(url.searchParams.has('laboratory_name') ? { laboratory_name: url.searchParams.get('laboratory_name') } : {}) });
  const summary = await labTransaction(false, async client => {
   const rows = (await client.query('select id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,entry_mode,payload,revision,updated_at from public.kawt_lab_reports where laboratory_key=lower(btrim($1)) and period_start>=$2 and period_end<=$3 order by period_start,period_end', [parsed.laboratory_name, parsed.start, parsed.end])).rows as LabReport[];
   if (rows.reduce((n, r) => n + r.payload.tests.length, 0) > 200_000) throw new Error('REPORT_RANGE_TOO_LARGE');
   const value = summarizeLabReports(rows, parsed);
   if (!value.found) {
    const related = (await client.query('select period_kind,period_start::text,period_end::text from public.kawt_lab_reports where laboratory_key=lower(btrim($1)) and period_start<=$2 and period_end>=$3 and period_kind<>$4 order by period_end-period_start limit 1', [parsed.laboratory_name, parsed.start, parsed.end, parsed.kind])).rows[0];
    return { ...value, related_aggregate: related };
   }
   return value;
  });
  if (format === 'xlsx') {
   if (!summary.found) return Response.json({ error: summary.message }, { status: 404 });
   const book = laboratoryXlsx({ laboratory_name: parsed.laboratory_name, period_kind: parsed.kind, period_start: parsed.start, period_end: parsed.end, source_label: 'Calculated from ' + summary.sources.length + ' source reports; ' + (summary.complete_source_coverage ? 'source coverage complete' : 'PARTIAL source coverage; missing dates retained'), payload: summary.payload, revision: 'Calculated source view' });
   return new Response(new Uint8Array(book), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="KAWT-lab-' + parsed.start + '-to-' + parsed.end + '.xlsx"', 'Cache-Control': 'private, no-store' } });
  }
  return Response.json(summary, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Report dates check karein' }, { status: 400 });
  if (error instanceof Error && error.message === 'REPORT_RANGE_TOO_LARGE') return Response.json({ error: 'Is range ka data bohat bara hai; chhota period chunein' }, { status: 413 });
  return workspaceError(error);
 }
}
