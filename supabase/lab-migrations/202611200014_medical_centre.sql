-- Medical-centre configuration. Rates are append-only versions, never repricing
-- historical source transactions. No doctor or package defaults are inserted.
create table public.kawt_mc_doctors (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 160),
 specialty text not null check(length(btrim(specialty)) between 2 and 160),
 qualifications text not null default '' check(length(qualifications)<=500),
 service_group text not null check(service_group in ('OPD','URGENT_CARE')),
 days_text text not null default '' check(length(days_text)<=500),
 times_text text not null default '' check(length(times_text)<=500),
 photo_url text check(photo_url is null or photo_url ~ '^https://(www\.)?khidmat-e-alam\.org/'),
 status text not null default 'draft' check(status in ('draft','active','inactive')),
 source_label text not null check(length(btrim(source_label)) between 1 and 500),
 effective_date date,
 notes text not null default '' check(length(notes)<=2000),
 revision int not null default 1,
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.kawt_mc_packages (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 160),
 components text[] not null check(cardinality(components) between 1 and 100),
 status text not null default 'draft' check(status in ('draft','active','inactive')),
 source_label text not null check(length(btrim(source_label)) between 1 and 500),
 notes text not null default '' check(length(notes)<=2000),
 revision int not null default 1,
 created_by uuid not null references public.profiles(id),
 updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.kawt_mc_prices (
 id uuid primary key default gen_random_uuid(),
 doctor_id uuid references public.kawt_mc_doctors(id),
 package_id uuid references public.kawt_mc_packages(id),
 valid_from date not null check(valid_from>='1900-01-01' and valid_from<'2200-01-01'),
 amount_minor bigint not null check(amount_minor between 0 and 100000000000),
 currency text not null check(currency='PKR'),
 source_label text not null check(length(btrim(source_label)) between 1 and 500),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 check((doctor_id is not null)::int+(package_id is not null)::int=1)
);
create index on public.kawt_mc_prices(doctor_id,valid_from desc,created_at desc);
create index on public.kawt_mc_prices(package_id,valid_from desc,created_at desc);
create table public.kawt_mc_audit (
 id bigint generated always as identity primary key,
 entity_table text not null,
 entity_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 action text not null,
 previous jsonb,
 current_value jsonb not null,
 changed_at timestamptz not null default now()
);
create function public.kawt_mc_stamp() returns trigger language plpgsql security definer set search_path='' as $$
declare item text;
begin
 if not public.has_role(array['admin','camp_manager']::public.app_role[]) or (select auth.uid()) is null then raise insufficient_privilege; end if;
 if tg_table_name='kawt_mc_packages' then
  foreach item in array new.components loop
   if item is null or length(btrim(item)) not between 1 and 160 then raise exception 'Package component is required'; end if;
  end loop;
 end if;
 if tg_op='INSERT' then new.created_by=(select auth.uid());new.created_at=now();
 else new.created_by=old.created_by;new.created_at=old.created_at;end if;
 if tg_table_name<>'kawt_mc_prices' then
  new.updated_by=(select auth.uid());new.updated_at=now();
  if tg_op='UPDATE' then new.revision=old.revision+1;else new.revision=1;end if;
 end if;
 return new;
end;
$$;
create function public.kawt_mc_record_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.kawt_mc_audit(entity_table,entity_id,actor_id,action,previous,current_value)
 values(tg_table_name,new.id,(select auth.uid()),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function public.kawt_mc_stamp(),public.kawt_mc_record_change() from public,anon,authenticated;
create trigger kawt_mc_doctor_stamp before insert or update on public.kawt_mc_doctors for each row execute function public.kawt_mc_stamp();
create trigger kawt_mc_package_stamp before insert or update on public.kawt_mc_packages for each row execute function public.kawt_mc_stamp();
create trigger kawt_mc_price_stamp before insert on public.kawt_mc_prices for each row execute function public.kawt_mc_stamp();
create trigger kawt_mc_doctor_audit after insert or update on public.kawt_mc_doctors for each row execute function public.kawt_mc_record_change();
create trigger kawt_mc_package_audit after insert or update on public.kawt_mc_packages for each row execute function public.kawt_mc_record_change();
create trigger kawt_mc_price_audit after insert on public.kawt_mc_prices for each row execute function public.kawt_mc_record_change();
alter table public.kawt_mc_doctors enable row level security;
alter table public.kawt_mc_packages enable row level security;
alter table public.kawt_mc_prices enable row level security;
alter table public.kawt_mc_audit enable row level security;
revoke all on public.kawt_mc_doctors,public.kawt_mc_packages,public.kawt_mc_prices,public.kawt_mc_audit from anon;
grant select,insert,update on public.kawt_mc_doctors,public.kawt_mc_packages to authenticated;
grant select,insert on public.kawt_mc_prices to authenticated;
grant select on public.kawt_mc_audit to authenticated;
revoke delete on public.kawt_mc_doctors,public.kawt_mc_packages from authenticated;
revoke update,delete on public.kawt_mc_prices from authenticated;
revoke insert,update,delete on public.kawt_mc_audit from authenticated;
create policy kawt_mc_doctor_read on public.kawt_mc_doctors for select to authenticated using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));
create policy kawt_mc_doctor_insert on public.kawt_mc_doctors for insert to authenticated with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy kawt_mc_doctor_update on public.kawt_mc_doctors for update to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[])) with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy kawt_mc_package_read on public.kawt_mc_packages for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]) or public.kawt_lab_allowed(false));
create policy kawt_mc_package_insert on public.kawt_mc_packages for insert to authenticated with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy kawt_mc_package_update on public.kawt_mc_packages for update to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[])) with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy kawt_mc_price_read on public.kawt_mc_prices for select to authenticated using(
 (doctor_id is not null and public.has_role(array['admin','camp_manager','doctor']::public.app_role[]))
 or (package_id is not null and (public.has_role(array['admin','camp_manager']::public.app_role[]) or public.kawt_lab_allowed(false))));
create policy kawt_mc_price_insert on public.kawt_mc_prices for insert to authenticated with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy kawt_mc_audit_read on public.kawt_mc_audit for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]));
