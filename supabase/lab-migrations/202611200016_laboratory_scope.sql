-- The existing source reports identify the Khidmat-e-Alam Diagnostic Centre.
-- Partner laboratories remain separate; staff grants are scoped to one lab.
alter table public.kawt_lab_access add column laboratory_name text not null default 'Khidmat-e-Alam Diagnostic Centre' check(length(btrim(laboratory_name)) between 1 and 180);
alter table public.kawt_lab_access add column laboratory_key text generated always as(lower(btrim(laboratory_name))) stored;
alter table public.kawt_lab_reports add column laboratory_name text not null default 'Khidmat-e-Alam Diagnostic Centre' check(length(btrim(laboratory_name)) between 1 and 180);
alter table public.kawt_lab_reports add column laboratory_key text generated always as(lower(btrim(laboratory_name))) stored;
alter table public.kawt_lab_reports drop constraint kawt_lab_reports_period_kind_period_start_period_end_key;
alter table public.kawt_lab_reports add unique(laboratory_key,period_kind,period_start,period_end);
create index on public.kawt_lab_reports(laboratory_key,period_start,period_end);
create function public.kawt_lab_scope_allowed(write_access boolean,lab_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.has_role(array['admin']::public.app_role[]) or exists(
  select 1 from public.kawt_lab_access a join public.profiles p on p.id=a.user_id
  where a.user_id=(select auth.uid()) and a.active and p.role='donor'
  and a.laboratory_key=lower(btrim(lab_name)) and (not write_access or a.access='operator')
 )
$$;
revoke all on function public.kawt_lab_scope_allowed(boolean,text) from public,anon;
grant execute on function public.kawt_lab_scope_allowed(boolean,text) to authenticated;
drop policy kawt_lab_report_read on public.kawt_lab_reports;
drop policy kawt_lab_report_insert on public.kawt_lab_reports;
drop policy kawt_lab_report_update on public.kawt_lab_reports;
drop policy kawt_lab_audit_read on public.kawt_lab_audit;
create policy kawt_lab_report_read on public.kawt_lab_reports for select to authenticated using(public.kawt_lab_scope_allowed(false,laboratory_name));
create policy kawt_lab_report_insert on public.kawt_lab_reports for insert to authenticated with check(public.kawt_lab_scope_allowed(true,laboratory_name));
create policy kawt_lab_report_update on public.kawt_lab_reports for update to authenticated using(public.kawt_lab_scope_allowed(true,laboratory_name)) with check(public.kawt_lab_scope_allowed(true,laboratory_name));
create policy kawt_lab_audit_read on public.kawt_lab_audit for select to authenticated using(exists(select 1 from public.kawt_lab_reports r where r.id=report_id and public.kawt_lab_scope_allowed(false,r.laboratory_name)));
