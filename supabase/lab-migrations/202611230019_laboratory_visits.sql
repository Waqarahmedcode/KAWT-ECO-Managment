-- Department patient/test entries. This is a performance register, not billing.
create function public.kawt_lab_reference_tests_ok(value jsonb, allow_empty boolean) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; seen text[]='{}'; label text;
begin
 if value is null or jsonb_typeof(value)<>'array' or jsonb_array_length(value)>100 or (not allow_empty and jsonb_array_length(value)=0) then return false; end if;
 for item in select jsonb_array_elements(value) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>(case when allow_empty then 2 else 3 end) or not(item?'label') or not(item?'amount_minor') then return false;end if;
  label=item->>'label';
  if jsonb_typeof(item->'label')<>'string' or length(btrim(label)) not between 1 and 160 or lower(label)=any(seen) then return false;end if;
  seen=array_append(seen,lower(label));
  if not allow_empty then
   if not(item?'quantity') or jsonb_typeof(item->'quantity')<>'number' or (item->>'quantity')!~'^\d+$' then return false;end if;
   if (item->>'quantity')::numeric not between 1 and 100 then return false;end if;
  end if;
  if item->'amount_minor'<>'null'::jsonb then
   if jsonb_typeof(item->'amount_minor')<>'number' or (item->>'amount_minor')!~'^\d+$' then return false;end if;
   if (item->>'amount_minor')::numeric>100000000000 then return false;end if;
  end if;
 end loop;
 return true;
end;
$$;
revoke all on function public.kawt_lab_reference_tests_ok(jsonb,boolean) from public,anon;
grant execute on function public.kawt_lab_reference_tests_ok(jsonb,boolean) to authenticated;

create table public.kawt_lab_entry_settings (
 id uuid primary key default gen_random_uuid(),
 laboratory_name text not null check(length(btrim(laboratory_name)) between 1 and 180),
 laboratory_key text generated always as (lower(btrim(laboratory_name))) stored unique,
 shift_starts jsonb,
 valid_from date check(valid_from>='1900-01-01' and valid_from<'2200-01-01'),
 reference_prices jsonb not null default '[]' check(public.kawt_lab_reference_tests_ok(reference_prices,true)),
 revision int not null default 1,
 created_by uuid not null references public.profiles(id),updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((shift_starts is null and jsonb_array_length(reference_prices)=0) or valid_from is not null)
);
create table public.kawt_lab_visits (
 id uuid primary key,
 laboratory_name text not null check(length(btrim(laboratory_name)) between 1 and 180),
 laboratory_key text generated always as (lower(btrim(laboratory_name))) stored,
 patient_name text not null default '' check(length(patient_name)<=160),
 patient_reference text not null default '' check(length(patient_reference)<=100),
 occurred_at timestamptz not null check(occurred_at>='1900-01-01' and occurred_at<'2200-01-01'),
 service_date date not null,
 shift text not null check(shift in ('morning','evening','night')),
 automatic_shift boolean not null default false,
 settings_revision int,
 referral_source text not null check(referral_source in ('IN_HOUSE','MOU','URGENT_CARE','EXTERNAL')),
 referral_name text not null default '' check(length(referral_name)<=160),
 payment_category text not null check(payment_category in ('paid','free','subsidized','panel')),
 panel_name text not null default '' check(length(panel_name)<=160),
 tests jsonb not null check(public.kawt_lab_reference_tests_ok(tests,false)),
 notes text not null default '' check(length(notes)<=1000),voided boolean not null default false,
 creation_hash text not null check(creation_hash ~ '^[0-9a-f]{64}$'),
 revision int not null default 1,
 created_by uuid not null references public.profiles(id),updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(length(btrim(patient_name))>0 or length(btrim(patient_reference))>0),
 check(referral_source<>'MOU' or length(btrim(referral_name))>0),
 check(payment_category<>'panel' or length(btrim(panel_name))>0),
 check(not voided or length(btrim(notes))>0)
);
create index on public.kawt_lab_visits(laboratory_key,service_date,shift);
create table public.kawt_lab_entry_audit (
 id bigint generated always as identity primary key,
 entity_id uuid not null,entity_kind text not null check(entity_kind in ('visit','settings')),
 laboratory_name text not null,actor_id uuid not null references public.profiles(id),
 action text not null,previous jsonb,current_value jsonb not null,changed_at timestamptz not null default now()
);
create index on public.kawt_lab_entry_audit(entity_id,id);

create function public.kawt_lab_entry_stamp() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid=(select auth.uid());config public.kawt_lab_entry_settings;item text;times text[];use_config boolean;
begin
 if actor is null then raise insufficient_privilege;end if;
 if tg_table_name='kawt_lab_entry_settings' then
  if not public.has_role(array['admin']::public.app_role[]) then raise insufficient_privilege;end if;
  if new.shift_starts is not null then
   if jsonb_typeof(new.shift_starts)<>'object' or (select count(*) from jsonb_object_keys(new.shift_starts))<>3 then raise check_violation;end if;
   foreach item in array array['morning','evening','night'] loop
    if not(new.shift_starts?item) or jsonb_typeof(new.shift_starts->item)<>'string' or new.shift_starts->>item!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise check_violation;end if;
   end loop;
   times=array[new.shift_starts->>'morning',new.shift_starts->>'evening',new.shift_starts->>'night'];
   if times[1]=times[2] or times[1]=times[3] or times[2]=times[3] then raise check_violation;end if;
  end if;
 else
  if not public.kawt_lab_scope_allowed(true,new.laboratory_name) then raise insufficient_privilege;end if;
  if new.occurred_at>now()+interval '5 minutes' then raise check_violation;end if;
  new.service_date=(new.occurred_at at time zone 'Asia/Karachi')::date;
  use_config=(tg_op='INSERT');
  if tg_op='UPDATE' then use_config=new.occurred_at is distinct from old.occurred_at or new.shift is distinct from old.shift;end if;
  if use_config then
   select * into config from public.kawt_lab_entry_settings where laboratory_key=lower(btrim(new.laboratory_name));
   if config.shift_starts is not null and new.service_date>=config.valid_from then
    select key into new.shift from jsonb_each_text(config.shift_starts)
     order by (value::time<=(new.occurred_at at time zone 'Asia/Karachi')::time) desc,value::time desc limit 1;
    new.automatic_shift=true;new.settings_revision=config.revision;
   else new.automatic_shift=false;new.settings_revision=null;end if;
  else new.automatic_shift=old.automatic_shift;new.settings_revision=old.settings_revision;end if;
 end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or lower(btrim(new.laboratory_name))<>old.laboratory_key then raise insufficient_privilege;end if;
  new.created_by=old.created_by;new.created_at=old.created_at;new.revision=old.revision+1;
  if tg_table_name='kawt_lab_visits' then new.creation_hash=old.creation_hash;end if;
 else new.created_by=actor;new.created_at=now();new.revision=1;end if;
 new.updated_by=actor;new.updated_at=now();return new;
end;
$$;
create function public.kawt_lab_entry_record_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.kawt_lab_entry_audit(entity_id,entity_kind,laboratory_name,actor_id,action,previous,current_value)
 values(new.id,case when tg_table_name='kawt_lab_visits' then 'visit' else 'settings' end,new.laboratory_name,(select auth.uid()),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function public.kawt_lab_entry_stamp(),public.kawt_lab_entry_record_change() from public,anon,authenticated;
create trigger kawt_lab_visit_stamp before insert or update on public.kawt_lab_visits for each row execute function public.kawt_lab_entry_stamp();
create trigger kawt_lab_setting_stamp before insert or update on public.kawt_lab_entry_settings for each row execute function public.kawt_lab_entry_stamp();
create trigger kawt_lab_visit_audit after insert or update on public.kawt_lab_visits for each row execute function public.kawt_lab_entry_record_change();
create trigger kawt_lab_setting_audit after insert or update on public.kawt_lab_entry_settings for each row execute function public.kawt_lab_entry_record_change();
alter table public.kawt_lab_visits enable row level security;
alter table public.kawt_lab_entry_settings enable row level security;
alter table public.kawt_lab_entry_audit enable row level security;
revoke all on public.kawt_lab_visits,public.kawt_lab_entry_settings,public.kawt_lab_entry_audit from anon;
grant select,insert,update on public.kawt_lab_visits,public.kawt_lab_entry_settings to authenticated;
revoke delete on public.kawt_lab_visits,public.kawt_lab_entry_settings from authenticated;
grant select on public.kawt_lab_entry_audit to authenticated;
revoke insert,update,delete on public.kawt_lab_entry_audit from authenticated;
create policy kawt_lab_visit_read on public.kawt_lab_visits for select to authenticated using(public.kawt_lab_scope_allowed(true,laboratory_name));
create policy kawt_lab_visit_insert on public.kawt_lab_visits for insert to authenticated with check(public.kawt_lab_scope_allowed(true,laboratory_name));
create policy kawt_lab_visit_update on public.kawt_lab_visits for update to authenticated using(public.kawt_lab_scope_allowed(true,laboratory_name)) with check(public.kawt_lab_scope_allowed(true,laboratory_name));
create policy kawt_lab_setting_read on public.kawt_lab_entry_settings for select to authenticated using(public.kawt_lab_scope_allowed(false,laboratory_name));
create policy kawt_lab_setting_insert on public.kawt_lab_entry_settings for insert to authenticated with check(public.has_role(array['admin']::public.app_role[]));
create policy kawt_lab_setting_update on public.kawt_lab_entry_settings for update to authenticated using(public.has_role(array['admin']::public.app_role[])) with check(public.has_role(array['admin']::public.app_role[]));
create policy kawt_lab_entry_history_read on public.kawt_lab_entry_audit for select to authenticated using(public.kawt_lab_scope_allowed(true,laboratory_name));

-- Viewers receive aggregates through this function, never patient identities.
create function public.kawt_lab_visit_summary(lab_name text,from_date date,to_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.kawt_lab_scope_allowed(false,lab_name) then raise insufficient_privilege;end if;
 if from_date is null or to_date is null or from_date>to_date or to_date-from_date>3660 then raise invalid_parameter_value;end if;
 with visits as materialized (
  select shift,referral_source,payment_category,tests,(select sum((t->>'quantity')::int) from jsonb_array_elements(tests) t) as tests_count from public.kawt_lab_visits
  where laboratory_key=lower(btrim(lab_name)) and service_date between from_date and to_date and not voided
 ), test_rows as materialized (select shift,t->>'label' as label,(t->>'quantity')::int as quantity from visits v cross join lateral jsonb_array_elements(v.tests) t),
 shifts as (select shift,count(*) as visits,sum(tests_count) as tests_count from visits group by shift),
 tests as (select label,coalesce(sum(quantity) filter(where shift='morning'),0) as morning,coalesce(sum(quantity) filter(where shift='evening'),0) as evening,coalesce(sum(quantity) filter(where shift='night'),0) as night,sum(quantity) as total from test_rows group by label),
 refs as (select referral_source as source,count(*) as visits,sum(tests_count) as tests_count from visits group by referral_source
  union all select 'URGENT_CARE:'||shift,count(*),sum(tests_count) from visits where referral_source='URGENT_CARE' group by shift),
 categories as (select payment_category as category,count(*) as visits,sum(tests_count) as tests_count from visits group by payment_category)
 select jsonb_build_object('visits',(select count(*) from visits),'tests_count',(select coalesce(sum(quantity),0) from test_rows),
  'shifts',coalesce((select jsonb_agg(to_jsonb(s)) from shifts s),'[]'::jsonb),
  'tests',coalesce((select jsonb_agg(to_jsonb(t) order by t.total desc,t.label) from tests t),'[]'::jsonb),
  'referrals',coalesce((select jsonb_agg(to_jsonb(r)) from refs r),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(c)) from categories c),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.kawt_lab_visit_summary(text,date,date) from public,anon;
grant execute on function public.kawt_lab_visit_summary(text,date,date) to authenticated;
