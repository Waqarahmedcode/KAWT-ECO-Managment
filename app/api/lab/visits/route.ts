import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sameOrigin } from '@/lib/actor-db';
import { labTransaction } from '@/lib/laboratory-server';
import { visitInput, visitRange, shiftAt, applicableEntrySettings } from '@/lib/laboratory-visits';
import { scopedVisitLaboratory, privateHeaders, visitError } from '@/lib/laboratory-visits-server';
const fields = 'id,laboratory_name,patient_name,patient_reference,occurred_at,service_date::text as service_date,shift,automatic_shift,referral_source,referral_name,payment_category,panel_name,tests,notes,voided,revision,updated_at';
export async function GET(request: Request) {
 try {
  const url = new URL(request.url), id = url.searchParams.get('id');
  const input = id ? { id: z.uuid().parse(id) } : visitRange.parse({ start: url.searchParams.get('start'), end: url.searchParams.get('end'), laboratory_name: url.searchParams.get('laboratory_name') ?? undefined });
  const result = await labTransaction(true, async (client, actor) => {
   if ('id' in input) {
    const visit = (await client.query('select ' + fields + ' from public.kawt_lab_visits where id=$1', [input.id])).rows[0];
    if (!visit) return null;
    const history = (await client.query('select action,previous,current_value,changed_at from public.kawt_lab_entry_audit where entity_kind=\'visit\' and entity_id=$1 order by id desc limit 100', [input.id])).rows;
    return { visit, history };
   }
   const name = scopedVisitLaboratory(actor, input.laboratory_name);
   return { visits: (await client.query('select ' + fields + ' from public.kawt_lab_visits where laboratory_key=lower(btrim($1)) and service_date between $2 and $3 order by occurred_at desc,id limit 201', [name, input.start, input.end])).rows };
  });
  if (!result) return Response.json({ error: 'Entry nahin mili' }, { status: 404, headers: privateHeaders });
  if ('visits' in result && result.visits) return Response.json({ visits: result.visits.slice(0, 200), truncated: result.visits.length > 200 }, { headers: privateHeaders });
  return Response.json(result, { headers: privateHeaders });
 } catch (error) { return visitError(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const raw = await request.text();
  if (raw.length > 100_000) return Response.json({ error: 'Entry bohat bari hai' }, { status: 413, headers: privateHeaders });
  let value;try { value = JSON.parse(raw); } catch { return Response.json({ error: 'Valid entry darkar hai' }, { status: 400, headers: privateHeaders }); }
  const input = visitInput.parse(value);
  if (Date.parse(input.occurred_at) > Date.now() + 300_000) throw new Error('FUTURE_ENTRY');
  const result = await labTransaction(true, async (client, actor) => {
   const name = scopedVisitLaboratory(actor, input.laboratory_name);
   const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, laboratory_name: name })).digest('hex');
   const current = (await client.query('select *,occurred_at::text as occurred_text from public.kawt_lab_visits where id=$1 for update', [input.id])).rows[0];
   const publicRecord = async () => (await client.query('select ' + fields + ' from public.kawt_lab_visits where id=$1', [input.id])).rows[0];
   if (!input.revision && current) {
    if (current.creation_hash !== fingerprint || current.created_by !== actor.user.id) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
    return { visit: await publicRecord(), already_saved: true };
   }
   if (input.revision && (!current || current.revision !== input.revision)) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   if (current && current.laboratory_key !== name.trim().toLowerCase()) throw new Error('FORBIDDEN');
   const storedSettings = (await client.query('select shift_starts,reference_prices,revision,valid_from::text from public.kawt_lab_entry_settings where laboratory_key=lower(btrim($1))', [name])).rows[0] ?? null;
   const settings = applicableEntrySettings(input.occurred_at, storedSettings);
   const sameTime = current && new Date(current.occurred_at).toISOString() === new Date(input.occurred_at).toISOString();
   const shift = sameTime && input.shift === current.shift ? current.shift : shiftAt(input.occurred_at, settings?.shift_starts ?? null) ?? input.shift;
   if (!shift) throw new Error('SHIFT_REQUIRED');
   const data = [input.patient_name, input.patient_reference, input.occurred_at, shift, input.referral_source, input.referral_name, input.payment_category, input.panel_name, JSON.stringify(input.tests), input.notes, input.voided];
   if (input.revision) {
    const edited = await client.query('update public.kawt_lab_visits set patient_name=$1,patient_reference=$2,occurred_at=$3,shift=$4,referral_source=$5,referral_name=$6,payment_category=$7,panel_name=$8,tests=$9,notes=$10,voided=$11 where id=$12 and revision=$13 returning id', [...data, input.id, input.revision]);
    if (!edited.rowCount) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   } else {
    const inserted = await client.query('insert into public.kawt_lab_visits(patient_name,patient_reference,occurred_at,shift,referral_source,referral_name,payment_category,panel_name,tests,notes,voided,id,laboratory_name,creation_hash,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) on conflict(id) do nothing returning id', [...data, input.id, name, fingerprint, actor.user.id]);
    if (!inserted.rowCount) {
     const retry = (await client.query('select creation_hash,created_by from public.kawt_lab_visits where id=$1', [input.id])).rows[0];
     if (!retry || retry.creation_hash !== fingerprint || retry.created_by !== actor.user.id) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
     return { visit: await publicRecord(), already_saved: true };
    }
   }
   return { visit: await publicRecord(), already_saved: false };
  });
  return Response.json(result, { headers: privateHeaders });
 } catch (error) { return visitError(error); }
}
