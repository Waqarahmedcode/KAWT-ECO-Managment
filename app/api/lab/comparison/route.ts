import { z } from 'zod';
import { labTransaction } from '@/lib/laboratory-server';
import { workspaceError } from '@/lib/actor-db';
import { labSummaryQuery, summarizeLabReports } from '@/lib/laboratory-reporting';
import { compareLabPeriods, comparisonQuery } from '@/lib/laboratory-comparison';
import { laboratoryXlsx } from '@/lib/report-xlsx';
import type { LabReport } from '@/lib/laboratory';

export async function GET(request: Request) {
 try {
  const url = new URL(request.url), q = url.searchParams;
  const current = labSummaryQuery.parse({ kind: q.get('kind'), start: q.get('start'), end: q.get('end'), ...(q.has('laboratory_name') ? { laboratory_name: q.get('laboratory_name') } : {}) });
  const mode = z.enum(['previous_period', 'previous_year', 'custom']).parse(q.get('mode') ?? 'previous_period');
  const previous = comparisonQuery(current, mode, { start: q.get('previous_start') ?? '', end: q.get('previous_end') ?? '' });
  if (!previous.query) return Response.json({ error: previous.reason }, { status: 400 });
  const baseline = previous.query;
  const result = await labTransaction(false, async client => {
   // One SQL snapshot covers both periods under the same laboratory RLS scope.
   const rows = (await client.query('select id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,entry_mode,payload,revision,updated_at from public.kawt_lab_reports where laboratory_key=lower(btrim($1)) and ((period_start>=$2 and period_end<=$3) or (period_start>=$4 and period_end<=$5)) order by period_start,period_end', [current.laboratory_name, current.start, current.end, baseline.start, baseline.end])).rows as LabReport[];
   if (rows.reduce((n, r) => n + r.payload.tests.length, 0) > 200_000) throw new Error('REPORT_RANGE_TOO_LARGE');
   const now = summarizeLabReports(rows, current), before = summarizeLabReports(rows, baseline);
   return { now, comparison: compareLabPeriods(now, before) };
  });
  if (q.get('format') === 'xlsx') {
   if (!result.now.found) return Response.json({ error: result.now.message }, { status: 404 });
   const book = laboratoryXlsx({ laboratory_name: current.laboratory_name, period_kind: current.kind, period_start: current.start, period_end: current.end, source_label: 'Current-period source view with separately calculated period comparison', payload: result.now.payload, revision: 'Calculated source view' }, result.comparison);
   return new Response(new Uint8Array(book), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="KAWT-comparison-' + current.start + '.xlsx"', 'Cache-Control': 'private, no-store' } });
  }
  return Response.json(result.comparison, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Comparison ki dates check karein' }, { status: 400 });
  if (error instanceof Error && error.message === 'REPORT_RANGE_TOO_LARGE') return Response.json({ error: 'Is comparison ka data bohat bara hai; chhota period chunein' }, { status: 413 });
  return workspaceError(error);
 }
}
