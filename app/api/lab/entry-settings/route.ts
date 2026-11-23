import { sameOrigin } from '@/lib/actor-db';
import { labTransaction } from '@/lib/laboratory-server';
import { entrySettingsInput } from '@/lib/laboratory-visits';
import { scopedVisitLaboratory, privateHeaders, visitError } from '@/lib/laboratory-visits-server';
export async function GET(request: Request) {
 try {
  const requested = new URL(request.url).searchParams.get('laboratory_name') ?? undefined;
  const result = await labTransaction(false, async (client, actor) => {
   const name = scopedVisitLaboratory(actor, requested);
   const settings = (await client.query('select id,laboratory_name,valid_from::text,shift_starts,reference_prices,revision from public.kawt_lab_entry_settings where laboratory_key=lower(btrim($1))', [name])).rows[0] ?? null;
   return { settings, server_now: new Date().toISOString(), laboratory_name: name };
  });
  return Response.json(result, { headers: privateHeaders });
 } catch (error) { return visitError(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const raw = await request.text();
  if (raw.length > 100_000) return Response.json({ error: 'Settings file bohat bari hai' }, { status: 413, headers: privateHeaders });
  let value;try { value = JSON.parse(raw); } catch { return Response.json({ error: 'Valid settings darkar hain' }, { status: 400, headers: privateHeaders }); }
  const input = entrySettingsInput.parse(value);
  const settings = await labTransaction(false, async (client, actor) => {
   if (actor.access !== 'admin') throw new Error('FORBIDDEN');
   const name = scopedVisitLaboratory(actor, input.laboratory_name);
   await client.query("select pg_advisory_xact_lock(hashtext('kawt-lab-settings:'||lower(btrim($1))))", [name]);
   const current = (await client.query('select id,revision from public.kawt_lab_entry_settings where laboratory_key=lower(btrim($1)) for update', [name])).rows[0];
   if (current && input.revision !== current.revision) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   if (current) return (await client.query('update public.kawt_lab_entry_settings set shift_starts=$1,reference_prices=$2,valid_from=$3 where id=$4 returning id,laboratory_name,valid_from::text,shift_starts,reference_prices,revision', [input.shift_starts ? JSON.stringify(input.shift_starts) : null, JSON.stringify(input.reference_prices), input.valid_from, current.id])).rows[0];
   if (input.revision) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   return (await client.query('insert into public.kawt_lab_entry_settings(laboratory_name,shift_starts,reference_prices,valid_from,created_by,updated_by) values($1,$2,$3,$4,$5,$5) returning id,laboratory_name,valid_from::text,shift_starts,reference_prices,revision', [name, input.shift_starts ? JSON.stringify(input.shift_starts) : null, JSON.stringify(input.reference_prices), input.valid_from, actor.user.id])).rows[0];
  });
  return Response.json({ settings }, { headers: privateHeaders });
 } catch (error) { return visitError(error); }
}
