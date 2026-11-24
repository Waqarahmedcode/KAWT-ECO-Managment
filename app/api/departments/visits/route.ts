import { createHash } from 'node:crypto';
import { z } from 'zod';
import { departmentSchema, departmentVisitInput, periodInput } from '@/lib/departments';
import { departmentTransaction } from '@/lib/department-server';
import { sameOrigin } from '@/lib/actor-db';
import { onboardingBody, onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
const fields = 'id,department,patient_name,patient_reference,occurred_at,service_date::text,shift,doctor_id,doctor_name,service,referral_source,referral_name,payment_category,panel_name,reference_amount_minor::float8,support_amount_minor::float8,notes,voided,revision';
export async function GET(request: Request) {
 try {
  const url = new URL(request.url), department = departmentSchema.parse(url.searchParams.get('department'));
  const range = periodInput.parse({ start: url.searchParams.get('start'), end: url.searchParams.get('end') });
  const result = await departmentTransaction(department, false, async (db, actor, operator) => {
   const summary = (await db.query('select public.kawt_department_summary($1,$2,$3) as value', [department, range.start, range.end])).rows[0].value;
   const doctors = (await db.query('select * from public.kawt_department_roster($1)', [department])).rows;
   const page = z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('page') ?? 0);
   const total = operator ? (await db.query('select count(*)::int as n from public.kawt_department_visits where department=$1 and service_date between $2 and $3', [department, range.start, range.end])).rows[0].n : 0;
   const visits = operator ? (await db.query('select ' + fields + ' from public.kawt_department_visits where department=$1 and service_date between $2 and $3 order by occurred_at desc,id limit 20 offset $4', [department, range.start, range.end, page * 20])).rows : [];
   const selected = url.searchParams.get('id');
   const history = selected && operator ? (await db.query("select action,previous,current_value,changed_at from public.kawt_operations_audit where entity_kind='department_visit' and department=$1 and entity_key=$2 order by id desc limit 30", [department, z.uuid().parse(selected)])).rows : [];
   return { summary, doctors, visits, total, page, history, operator, admin: actor.role === 'admin', serverNow: new Date().toISOString() };
  });
  return Response.json(result, { headers: onboardingHeaders });
 } catch (e) { return onboardingError(e); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const input = departmentVisitInput.parse(await onboardingBody(request));
  const result = await departmentTransaction(input.department, true, async (db, actor) => {
   await db.query("select pg_advisory_xact_lock(hashtext('kawt-department-visit:'||$1))", [input.id]);
   const current = (await db.query('select * from public.kawt_department_visits where id=$1 for update', [input.id])).rows[0];
   const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
   const record = async () => (await db.query('select ' + fields + ' from public.kawt_department_visits where id=$1', [input.id])).rows[0];
   if (!input.revision && current) {
    if (current.creation_hash !== hash || current.created_by !== actor.id) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
    return { visit: await record(), already_saved: true };
   }
   if (input.revision && (!current || current.revision !== input.revision || current.department !== input.department)) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   const values = [input.patient_name,input.patient_reference,input.occurred_at,input.shift,input.doctor_id,input.service,input.referral_source,input.referral_name,input.payment_category,input.panel_name,input.reference_amount_minor,input.support_amount_minor,input.notes,input.voided];
   if (input.revision) await db.query('update public.kawt_department_visits set patient_name=$1,patient_reference=$2,occurred_at=$3,shift=$4,doctor_id=$5,service=$6,referral_source=$7,referral_name=$8,payment_category=$9,panel_name=$10,reference_amount_minor=$11,support_amount_minor=$12,notes=$13,voided=$14 where id=$15', [...values,input.id]);
   else await db.query('insert into public.kawt_department_visits(patient_name,patient_reference,occurred_at,shift,doctor_id,service,referral_source,referral_name,payment_category,panel_name,reference_amount_minor,support_amount_minor,notes,voided,id,department,creation_hash,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)', [...values,input.id,input.department,hash,actor.id]);
   return { visit: await record(), already_saved: false };
  });
  return Response.json(result, { headers: onboardingHeaders });
 } catch (e) { return onboardingError(e); }
}
