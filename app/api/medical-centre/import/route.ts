import { createHash } from 'node:crypto';
import { z } from 'zod';
import { actorTransaction, sameOrigin, workspaceError } from '@/lib/actor-db';
import { medicalCentreInput } from '@/lib/medical-centre';
const schema = z.object({ source_label: z.string().trim().min(1).max(500), items: z.array(medicalCentreInput).min(1).max(100) }).strict().superRefine((value, ctx) => {
 value.items.forEach((item, i) => {
  if (item.action === 'price' || item.id || item.revision || item.status !== 'draft') ctx.addIssue({ code: 'custom', path: ['items', i], message: 'Source import mein sirf naye draft doctors/packages hon; live rates import nahin hotay' });
 });
});
export async function POST(request: Request) {
 try {
  sameOrigin(request);const raw = await request.text();
  if (raw.length > 500_000) return Response.json({ error: 'Source file is too large' }, { status: 413 });
  let parsed: unknown;try { parsed = JSON.parse(raw); } catch { return Response.json({ error: 'Valid source JSON darkar hai' }, { status: 400 }); }
  const input = schema.parse(parsed), hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const result = await actorTransaction(['admin', 'camp_manager'], async (client, actor) => {
   await client.query('insert into public.kawt_mc_import_batches(source_hash,source_label,records_created,imported_by) values($1,$2,$3,$4)', [hash, input.source_label, input.items.length, actor.id]);
   for (const item of input.items) {
    if (item.action === 'price') throw new Error('FORBIDDEN');
    const { action, id: ignoredId, revision: ignoredRevision, ...data } = item;
    void ignoredId;void ignoredRevision;
    const table = action === 'doctor' ? 'kawt_mc_doctors' : 'kawt_mc_packages';
    const duplicate = action === 'doctor'
     ? await client.query('select id from public.kawt_mc_doctors where lower(name)=lower($1) and service_group=$2 and source_label=$3', [data.name, item.action === 'doctor' ? item.service_group : '', data.source_label])
     : await client.query('select id from public.kawt_mc_packages where lower(name)=lower($1) and source_label=$2', [data.name, data.source_label]);
    if (duplicate.rowCount) throw Object.assign(new Error('SOURCE_RECORD_ALREADY_EXISTS'), { code: '23505' });
    const fields = Object.keys(data), values = Object.values(data);
    await client.query('insert into public.' + table + '(' + fields.join(',') + ',created_by,updated_by) values(' + fields.map((_, i) => '$' + (i + 1)).join(',') + ',$' + (fields.length + 1) + ',$' + (fields.length + 1) + ')', [...values, actor.id]);
   }
   return { created: input.items.length, liveRatesCreated: 0 };
  });
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Source fields check karein' }, { status: 400 });
  return workspaceError(error);
 }
}
