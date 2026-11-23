import { labTransaction } from '@/lib/laboratory-server';
import { visitRange, visitSummaryPayload, type VisitSummary } from '@/lib/laboratory-visits';
import { privateHeaders, scopedVisitLaboratory, visitError } from '@/lib/laboratory-visits-server';
import { laboratoryXlsx } from '@/lib/report-xlsx';
export async function GET(request: Request) {
 try {
  const url = new URL(request.url), input = visitRange.parse({ start: url.searchParams.get('start'), end: url.searchParams.get('end'), laboratory_name: url.searchParams.get('laboratory_name') ?? undefined });
  const result = await labTransaction(false, async (client, actor) => {
   const name = scopedVisitLaboratory(actor, input.laboratory_name);
   const summary = (await client.query('select public.kawt_lab_visit_summary($1,$2::date,$3::date) as summary', [name, input.start, input.end])).rows[0].summary as VisitSummary;
   return { ...summary, laboratory_name: name, start: input.start, end: input.end };
  });
  if (url.searchParams.get('format') === 'xlsx') {
   if (!result.tests.length) return Response.json({ error: 'Is period mein saved patient/test entries nahin hain' }, { status: 404, headers: privateHeaders });
   const book = laboratoryXlsx({ laboratory_name: result.laboratory_name, period_kind: 'custom', period_start: input.start, period_end: input.end, source_label: 'Saved patient/test entries only; not merged with imported aggregate reports', payload: visitSummaryPayload(result), revision: 'Operational entry view' }, undefined, result.referrals.filter(row => ['MOU', 'IN_HOUSE'].includes(row.source)).map(row => ({ label: row.source, patients: row.visits, tests: row.tests_count })));
   return new Response(new Uint8Array(book), { headers: { ...privateHeaders, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="KAWT-lab-entries-' + input.start + '-to-' + input.end + '.xlsx"' } });
  }
  return Response.json(result, { headers: privateHeaders });
 } catch (error) { return visitError(error); }
}
