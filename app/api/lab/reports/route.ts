import { z } from 'zod';
import { sameOrigin, workspaceError } from '@/lib/actor-db';
import { labReportSchema } from '@/lib/laboratory';
import { labTransaction } from '@/lib/laboratory-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 try {
  const id = new URL(request.url).searchParams.get('id');
  if (id && !z.uuid().safeParse(id).success) return Response.json({ error: 'Invalid report reference' }, { status: 400 });
  const result = await labTransaction(false, async client => {
   if (id) {
    const report = (await client.query('select id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,entry_mode,payload,revision,updated_at from public.kawt_lab_reports where id=$1', [id])).rows[0];
    const history = (await client.query("select action,changed_at,current_value->>'revision' as revision from public.kawt_lab_audit where report_id=$1 order by changed_at desc,id desc limit 30", [id])).rows;
    return { report, history };
   }
   return { reports: (await client.query('select id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,revision,updated_at from public.kawt_lab_reports order by period_start desc,updated_at desc limit 200')).rows };
  });
  if (id && !('report' in result && result.report)) return Response.json({ error: 'Report not found' }, { status: 404 });
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) { return workspaceError(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);
  const text = await request.text();
  if (text.length > 1_000_000) return Response.json({ error: 'Report file is too large' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'Valid JSON report is required' }, { status: 400 }); }
  const input = labReportSchema.parse(body);
  const report = await labTransaction(true, async (client, actor) => {
   if (!input.id && input.entry_mode === 'historical_import' && actor.access !== 'admin') throw new Error('FORBIDDEN');
   if (input.id) {
    const result = await client.query('update public.kawt_lab_reports set period_kind=$1,period_start=$2,period_end=$3,source_label=$4,entry_mode=$5,payload=$6,laboratory_name=$9 where id=$7 and revision=$8 returning id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,entry_mode,payload,revision,updated_at', [input.period_kind, input.period_start, input.period_end, input.source_label, input.entry_mode, JSON.stringify(input.payload), input.id, input.revision, input.laboratory_name]);
    if (!result.rowCount) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
    return result.rows[0];
   }
   return (await client.query('insert into public.kawt_lab_reports(period_kind,period_start,period_end,source_label,entry_mode,payload,created_by,updated_by,laboratory_name) values($1,$2,$3,$4,$5,$6,$7,$7,$8) returning id,laboratory_name,period_kind,period_start::text,period_end::text,source_label,entry_mode,payload,revision,updated_at', [input.period_kind, input.period_start, input.period_end, input.source_label, input.entry_mode, JSON.stringify(input.payload), actor.user.id, input.laboratory_name])).rows[0];
  });
  return Response.json({ report }, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Check the report fields' }, { status: 400 });
  return workspaceError(error);
 }
}
