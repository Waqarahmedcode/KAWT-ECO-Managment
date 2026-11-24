import { z } from 'zod';
import { actorTransaction, sameOrigin } from '@/lib/actor-db';
import { labRequestStatuses, staffDecisionInput } from '@/lib/laboratory-onboarding';
import { onboardingBody, onboardingError, onboardingHeaders } from '@/lib/laboratory-onboarding-server';
export async function GET(request: Request) {
 try {
  const url = new URL(request.url), summaryOnly = url.searchParams.get('summary') === '1';
  const status = z.enum(['all', ...labRequestStatuses]).parse(url.searchParams.get('status') ?? 'pending');
  const search = z.string().trim().max(160).parse(url.searchParams.get('search') ?? '');
  const result = await actorTransaction(['admin'], async client => {
   const pendingCount = (await client.query("select count(*)::int as count from public.kawt_lab_access_requests where status='pending'")).rows[0].count;
   if (summaryOnly) return { pendingCount };
   const requests = (await client.query("select r.*,a.revision as current_grant_revision from public.kawt_lab_access_requests r left join public.kawt_lab_access a on a.user_id=r.user_id where ($1='all' or r.status=$1) and ($2='' or strpos(lower(r.requester_email),lower($2))>0 or strpos(lower(r.requester_name),lower($2))>0) order by (r.status='pending') desc,case when r.status='pending' then r.created_at end asc,r.created_at desc,r.id limit 101", [status, search])).rows;
   const grants = (await client.query('select * from public.kawt_lab_access_directory()')).rows;
   const history = (await client.query('select a.entity_kind,a.action,a.changed_at,a.previous,a.current_value,p.email from public.kawt_lab_onboarding_audit a left join public.profiles p on p.id=a.subject_user_id order by a.id desc limit 20')).rows;
   return { pendingCount, requests: requests.slice(0, 100), requestsTruncated: requests.length > 100, grants: grants.slice(0, 500), grantsTruncated: grants.length > 500, history };
  });
  return Response.json(result, { headers: onboardingHeaders });
 } catch (error) { return onboardingError(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request);const input = staffDecisionInput.parse(await onboardingBody(request));
  const result = await actorTransaction(['admin'], async client => {
   const row = (await client.query('select id,user_id,status,revision from public.kawt_lab_access_requests where id=$1 for update', [input.id])).rows[0];
   if (!row || row.revision !== input.revision || row.status !== 'pending') throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   if (input.status === 'approved') {
    await client.query("select pg_advisory_xact_lock(hashtext('kawt-lab-grant:'||$1))", [row.user_id]);
    const current = (await client.query('select revision from public.kawt_lab_access where user_id=$1 for update', [row.user_id])).rows[0];
    if ((current?.revision ?? null) !== input.current_grant_revision) throw Object.assign(new Error('CONFLICT'), { code: '23505' });
   }
   const updated = (await client.query('update public.kawt_lab_access_requests set status=$1,granted_access=$2,granted_laboratory_name=$3,decision_note=$4 where id=$5 and revision=$6 returning *', [input.status, input.status === 'approved' ? input.granted_access : null, input.status === 'approved' ? input.laboratory_name : null, input.decision_note, input.id, input.revision])).rows[0];
   return { request: updated };
  });
  return Response.json(result, { headers: onboardingHeaders });
 } catch (error) { return onboardingError(error); }
}
