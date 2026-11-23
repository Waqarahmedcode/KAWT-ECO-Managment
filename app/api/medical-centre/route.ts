import { z } from 'zod';
import { actorTransaction, sameOrigin, workspaceError } from '@/lib/actor-db';
import { medicalCentreInput } from '@/lib/medical-centre';
export async function GET() {
 try {
  const result = await actorTransaction(['admin', 'camp_manager', 'doctor'], async client => ({
   doctors: (await client.query('select *,effective_date::text as effective_date from public.kawt_mc_doctors order by service_group,name')).rows,
   packages: (await client.query('select * from public.kawt_mc_packages order by name')).rows,
   prices: (await client.query('select *,valid_from::text as valid_from from public.kawt_mc_prices order by public.kawt_mc_prices.valid_from desc,created_at desc,id desc')).rows,
  }));
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) { return workspaceError(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const raw = await request.text();
  if (raw.length > 100_000) return Response.json({ error: 'Record is too large' }, { status: 413 });
  let parsed: unknown;try { parsed = JSON.parse(raw); } catch { return Response.json({ error: 'Valid record darkar hai' }, { status: 400 }); }
  const input = medicalCentreInput.parse(parsed);
  const record = await actorTransaction(['admin', 'camp_manager'], async (client, actor) => {
   if (input.action === 'price') return (await client.query('insert into public.kawt_mc_prices(doctor_id,package_id,valid_from,amount_minor,currency,source_label,created_by) values($1,$2,$3,$4,$5,$6,$7) returning *,valid_from::text as valid_from', [input.entity === 'doctor' ? input.entity_id : null, input.entity === 'package' ? input.entity_id : null, input.valid_from, input.amount_minor, input.currency, input.source_label, actor.id])).rows[0];
   const { action, id, revision, ...data } = input;
   const table = action === 'doctor' ? 'kawt_mc_doctors' : 'kawt_mc_packages';
   const fields = Object.keys(data), values = Object.values(data);
   const returning = action === 'doctor' ? '*,effective_date::text as effective_date' : '*';
   if (id) {
    const result = await client.query('update public.' + table + ' set ' + fields.map((field, i) => field + '=$' + (i + 1)).join(',') + ' where id=$' + (fields.length + 1) + ' and revision=$' + (fields.length + 2) + ' returning ' + returning, [...values, id, revision]);
    if (!result.rowCount) throw Object.assign(new Error('CONFLICT'), { code: '23505' });return result.rows[0];
   }
   return (await client.query('insert into public.' + table + '(' + fields.join(',') + ',created_by,updated_by) values(' + fields.map((_, i) => '$' + (i + 1)).join(',') + ',$' + (fields.length + 1) + ',$' + (fields.length + 1) + ') returning ' + returning, [...values, actor.id])).rows[0];
  });
  return Response.json({ record }, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Record fields check karein' }, { status: 400 });
  return workspaceError(error);
 }
}
