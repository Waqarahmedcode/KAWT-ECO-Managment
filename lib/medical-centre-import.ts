import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { medicalCentreInput } from './medical-centre';

export const medicalCentreSourceInput = z.object({
 source_label: z.string().trim().min(1).max(500),
 items: z.array(medicalCentreInput).min(1).max(100),
}).strict().superRefine((value, ctx) => {
 const seen = new Set<string>();
 value.items.forEach((item, i) => {
  if (item.action === 'price' || item.id || item.revision || item.status !== 'draft') {
   ctx.addIssue({ code: 'custom', path: ['items', i], message: 'Source import mein sirf naye draft doctors/packages hon; live rates import nahin hotay' });
   return;
  }
  const key = JSON.stringify([item.action, item.name.toLowerCase(), item.action === 'doctor' ? item.service_group : '', item.source_label]);
  if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['items', i], message: 'Source mein aik record do martaba hai' });
  seen.add(key);
 });
});

/** Runs inside the caller's authenticated RLS transaction; never commits or elevates roles. */
export async function importMedicalCentreSource(client: Pick<PoolClient, 'query'>, actorId: string, raw: unknown, allowExistingBatch = false) {
 const input = medicalCentreSourceInput.parse(raw);
 const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
 await client.query("select pg_advisory_xact_lock(hashtext('kawt-medical-source-import'))");
 if (allowExistingBatch && (await client.query('select 1 from public.kawt_mc_import_batches where source_hash=$1', [hash])).rowCount) {
  return { status: 'already_imported' as const, created: 0, liveRatesCreated: 0 };
 }
 await client.query('insert into public.kawt_mc_import_batches(source_hash,source_label,records_created,imported_by) values($1,$2,$3,$4)', [hash, input.source_label, input.items.length, actorId]);
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
  await client.query('insert into public.' + table + '(' + fields.join(',') + ',created_by,updated_by) values(' + fields.map((_, i) => '$' + (i + 1)).join(',') + ',$' + (fields.length + 1) + ',$' + (fields.length + 1) + ')', [...values, actorId]);
 }
 return { status: 'imported' as const, created: input.items.length, liveRatesCreated: 0 };
}
