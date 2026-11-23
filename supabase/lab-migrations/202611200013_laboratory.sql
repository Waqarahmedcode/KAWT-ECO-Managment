-- Additive department module. No source summaries or staff accounts are seeded.
create table public.kawt_lab_access (
 user_id uuid primary key references public.profiles(id),
 access text not null check(access in ('operator','viewer')),
 active boolean not null default true,
 granted_by uuid not null references public.profiles(id),
 changed_at timestamptz not null default now()
);
alter table public.kawt_lab_access enable row level security;
grant select,insert,update on public.kawt_lab_access to authenticated;
revoke all on public.kawt_lab_access from anon;
create policy kawt_lab_access_self on public.kawt_lab_access for select to authenticated
 using(user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy kawt_lab_access_admin on public.kawt_lab_access for all to authenticated
 using(public.has_role(array['admin']::public.app_role[]))
 with check(public.has_role(array['admin']::public.app_role[]) and exists(select 1 from public.profiles p where p.id=user_id and p.role='donor'));

create function public.kawt_lab_allowed(write_access boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select public.has_role(array['admin']::public.app_role[]) or exists(
  select 1 from public.kawt_lab_access a join public.profiles p on p.id=a.user_id
  where a.user_id=(select auth.uid()) and a.active and p.role='donor'
  and (not write_access or a.access='operator')
 )
$$;
revoke all on function public.kawt_lab_allowed(boolean) from public,anon;
grant execute on function public.kawt_lab_allowed(boolean) to authenticated;

create table public.kawt_lab_reports (
 id uuid primary key default gen_random_uuid(),
 period_kind text not null check(period_kind in ('day','week','month','half_year','year')),
 period_start date not null check(period_start>='1900-01-01' and period_start<'2200-01-01'),
 period_end date not null check(period_end>=period_start and period_end<'2200-01-01'),
 source_label text not null check(length(btrim(source_label)) between 1 and 240),
 entry_mode text not null check(entry_mode in ('manual','historical_import')),
 payload jsonb not null,
 revision int not null default 1,
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(period_kind,period_start,period_end),
 check(case period_kind
  when 'day' then period_start=period_end
  when 'week' then period_end=period_start+6
  when 'month' then period_start=date_trunc('month',period_start)::date and period_end=(period_start+interval '1 month'-interval '1 day')::date
  when 'half_year' then extract(month from period_start) in (1,7) and extract(day from period_start)=1 and period_end=(period_start+interval '6 months'-interval '1 day')::date
  when 'year' then extract(month from period_start)=1 and extract(day from period_start)=1 and period_end=(period_start+interval '1 year'-interval '1 day')::date
 end)
);
create table public.kawt_lab_audit (
 id bigint generated always as identity primary key,
 report_id uuid references public.kawt_lab_reports(id),
 actor_id uuid not null references public.profiles(id),
 action text not null,
 previous jsonb,
 current_value jsonb not null,
 changed_at timestamptz not null default now()
);
create function public.kawt_lab_count_ok(value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='null' or (jsonb_typeof(value)='number' and value::text ~ '^(0|[1-9][0-9]{0,7})$'),false)
$$;
revoke all on function public.kawt_lab_count_ok(jsonb) from public,anon;

create function public.kawt_lab_validate() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; shift_name text; count_name text; labels_count int; actor uuid;
begin
 actor=(select auth.uid());
 if actor is null or not public.kawt_lab_allowed(true) then raise insufficient_privilege; end if;
 if tg_op='INSERT' and new.entry_mode='historical_import' and not public.has_role(array['admin']::public.app_role[]) then raise insufficient_privilege; end if;
 if jsonb_typeof(new.payload) is distinct from 'object' or jsonb_typeof(new.payload->'tests') is distinct from 'array'
  or octet_length(new.payload::text)>1000000 then raise exception 'Invalid laboratory payload'; end if;
 if jsonb_array_length(new.payload->'tests') not between 1 and 500 then raise exception 'Provide 1 to 500 test rows'; end if;
 for item in select jsonb_array_elements(new.payload->'tests') loop
  if jsonb_typeof(item->'label') is distinct from 'string' or length(btrim(item->>'label')) not between 1 and 160 then raise exception 'Test label is required'; end if;
  foreach shift_name in array array['morning','evening','night'] loop
   if not public.kawt_lab_count_ok(item->shift_name) then raise exception 'Test counts must be nonnegative integers'; end if;
  end loop;
 end loop;
 select count(distinct lower(btrim(e->>'label'))) into labels_count from jsonb_array_elements(new.payload->'tests') e;
 if labels_count<>jsonb_array_length(new.payload->'tests') then raise exception 'Duplicate test label'; end if;
 foreach shift_name in array array['morning','evening','night'] loop
  if not public.kawt_lab_count_ok(new.payload->'patients'->shift_name) then raise exception 'Patient count is required for every shift'; end if;
  foreach count_name in array array['patients','tests'] loop
   if not public.kawt_lab_count_ok(new.payload->'urgent'->shift_name->count_name) then raise exception 'Emergency referral counts are required'; end if;
  end loop;
 end loop;
 foreach count_name in array array['patients','tests'] loop
  if not public.kawt_lab_count_ok(new.payload->'outsource'->count_name) then raise exception 'Outsource counts are required'; end if;
 end loop;
 if tg_op='INSERT' then new.created_by=actor;new.created_at=now();new.revision=1;
 else new.created_by=old.created_by;new.created_at=old.created_at;new.entry_mode=old.entry_mode;new.revision=old.revision+1;end if;
 new.updated_by=actor;new.updated_at=now();
 return new;
end;
$$;
revoke all on function public.kawt_lab_validate() from public,anon,authenticated;
create trigger kawt_lab_validate_report before insert or update on public.kawt_lab_reports for each row execute function public.kawt_lab_validate();
create function public.kawt_lab_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.kawt_lab_audit(report_id,actor_id,action,previous,current_value)
 values(new.id,(select auth.uid()),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function public.kawt_lab_audit_change() from public,anon,authenticated;
create trigger kawt_lab_record_change after insert or update on public.kawt_lab_reports for each row execute function public.kawt_lab_audit_change();
alter table public.kawt_lab_reports enable row level security;
alter table public.kawt_lab_audit enable row level security;
grant select,insert,update on public.kawt_lab_reports to authenticated;
grant select on public.kawt_lab_audit to authenticated;
revoke all on public.kawt_lab_reports,public.kawt_lab_audit from anon;
revoke insert,update,delete on public.kawt_lab_audit from authenticated;
revoke delete on public.kawt_lab_reports,public.kawt_lab_access from authenticated;
create policy kawt_lab_report_read on public.kawt_lab_reports for select to authenticated using(public.kawt_lab_allowed(false));
create policy kawt_lab_report_insert on public.kawt_lab_reports for insert to authenticated with check(public.kawt_lab_allowed(true));
create policy kawt_lab_report_update on public.kawt_lab_reports for update to authenticated using(public.kawt_lab_allowed(true)) with check(public.kawt_lab_allowed(true));
create policy kawt_lab_audit_read on public.kawt_lab_audit for select to authenticated using(public.kawt_lab_allowed(false));
