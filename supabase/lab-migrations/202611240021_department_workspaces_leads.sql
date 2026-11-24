-- Additive operational workspaces. No business data or memberships are seeded.
create table public.kawt_department_access (
 user_id uuid not null references public.profiles(id), department text not null check(department in ('opd','urgent-care')),
 access text not null check(access in ('operator','viewer')), active boolean not null default true,
 revision int not null default 1,changed_at timestamptz not null default now(),granted_by uuid references public.profiles(id),
 primary key(user_id,department)
);
create function public.kawt_department_allowed(dept text,write_access boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and
 (p.role='admin' or (p.role='donor' and exists(select 1 from public.kawt_department_access a where a.user_id=p.id and a.department=dept and a.active and (not write_access or a.access='operator')))));
$$;
revoke all on function public.kawt_department_allowed(text,boolean) from public,anon;
grant execute on function public.kawt_department_allowed(text,boolean) to authenticated;
create table public.kawt_department_visits (
 id uuid primary key,department text not null check(department in ('opd','urgent-care')),
 patient_name text not null default '' check(length(patient_name)<=160),patient_reference text not null default '' check(length(patient_reference)<=100),
 occurred_at timestamptz not null,service_date date generated always as ((occurred_at at time zone 'Asia/Karachi')::date) stored,
 shift text not null check(shift in ('morning','evening','night')),doctor_id uuid references public.kawt_mc_doctors(id),doctor_name text,
 service text not null check(length(btrim(service)) between 1 and 160),referral_source text not null check(referral_source in ('IN_HOUSE','EXTERNAL','MOU')),referral_name text not null default '',
 payment_category text not null check(payment_category in ('paid','free','subsidized','panel')),panel_name text not null default '',
 reference_amount_minor bigint check(reference_amount_minor between 0 and 100000000000),support_amount_minor bigint check(support_amount_minor between 0 and 100000000000),
 notes text not null default '' check(length(notes)<=2000),voided boolean not null default false,
 revision int not null default 1,creation_hash text not null,created_by uuid not null references public.profiles(id),updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(length(btrim(patient_name))>0 or length(btrim(patient_reference))>0),check(department<>'opd' or doctor_id is not null),
 check(referral_source<>'MOU' or length(btrim(referral_name))>0),check(payment_category<>'panel' or length(btrim(panel_name))>0),
 check(support_amount_minor is null or (reference_amount_minor is not null and support_amount_minor<=reference_amount_minor)),
 check(not voided or length(btrim(notes))>0)
);
create index on public.kawt_department_visits(department,service_date,occurred_at);
create table public.kawt_operations_audit (
 id bigint generated always as identity primary key,entity_kind text not null,entity_key text not null,department text,
 actor_id uuid references public.profiles(id),action text not null,previous jsonb,current_value jsonb not null,changed_at timestamptz not null default now()
);
create index on public.kawt_operations_audit(entity_kind,entity_key,id);
alter table public.donor_leads add column revision int not null default 1;
alter table public.donor_leads add column updated_at timestamptz not null default now();
alter table public.donor_leads add column next_follow_up date;
alter table public.donor_leads add column notes text not null default '';
alter table public.donor_leads add column linked_donor_id uuid references public.donors(id);
alter table public.donor_leads add column creation_hash text;
create index on public.donor_leads(contact_status,next_follow_up,submitted_at);

create function public.kawt_department_grant_stamp() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.has_role(array['admin']::public.app_role[]) then raise insufficient_privilege;end if;
 if new.active and not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where p.id=new.user_id and p.role='donor' and u.email_confirmed_at is not null) then raise exception 'A verified dedicated account is required';end if;
 if tg_op='UPDATE' then if new.user_id<>old.user_id or new.department<>old.department then raise insufficient_privilege;end if;new.revision=old.revision+1;else new.revision=1;end if;
 new.granted_by=(select auth.uid());new.changed_at=now();return new;
end;$$;
create function public.kawt_department_visit_stamp() returns trigger language plpgsql security definer set search_path='' as $$
declare doc record;
begin
 if not public.kawt_department_allowed(new.department,true) then raise insufficient_privilege;end if;
 if new.occurred_at>now()+interval '5 minutes' or new.occurred_at<'1900-01-01' or new.occurred_at>='2200-01-01' then raise exception 'Choose a valid past or current visit time';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.department<>old.department or new.created_by<>old.created_by or new.creation_hash<>old.creation_hash then raise insufficient_privilege;end if;
  new.revision=old.revision+1;new.created_at=old.created_at;
 else new.created_by=(select auth.uid());new.revision=1;new.created_at=now();end if;
 if new.doctor_id is not null then
  if tg_op='UPDATE' and new.doctor_id is not distinct from old.doctor_id then new.doctor_name=old.doctor_name;
  else
   select name,service_group,status into doc from public.kawt_mc_doctors where id=new.doctor_id;
   if doc.service_group is distinct from (case when new.department='opd' then 'OPD' else 'URGENT_CARE' end) or doc.status='inactive' then raise exception 'Select a doctor from this department roster';end if;
   new.doctor_name=doc.name;
  end if;
 else new.doctor_name=null;end if;
 new.updated_by=(select auth.uid());new.updated_at=now();return new;
end;$$;
create function public.kawt_lead_stamp() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.provider<>old.provider or new.external_lead_id<>old.external_lead_id then raise insufficient_privilege;end if;
  new.revision=old.revision+1;new.submitted_at=old.submitted_at;
 else new.revision=1;end if;
 if new.assigned_to is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to) and not exists(select 1 from public.profiles p where p.id=new.assigned_to and p.role='admin') then raise exception 'Lead assignment requires an administrator';end if;
 if (tg_op='INSERT' or new.contact_status is distinct from old.contact_status or new.linked_donor_id is distinct from old.linked_donor_id) and new.contact_status='converted' then
  if not new.marketing_consent then raise exception 'Record consent before progressing a lead';end if;
  if new.linked_donor_id is null or not exists(select 1 from public.donations d where d.donor_id=new.linked_donor_id and d.status='confirmed') then raise exception 'Conversion requires a linked donor with a confirmed contribution';end if;
 end if;
 if not new.marketing_consent and new.contact_status in ('new','contacted','qualified') then new.contact_status='do_not_contact';end if;
 if not new.marketing_consent or new.contact_status='do_not_contact' then new.next_follow_up=null;end if;
 new.updated_at=now();return new;
end;$$;
create function public.kawt_operations_record() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;key text;dept text;
begin
 if tg_table_name='kawt_department_access' then kind='department_grant';key=new.user_id::text||':'||new.department;dept=new.department;
 elsif tg_table_name='kawt_department_visits' then kind='department_visit';key=new.id::text;dept=new.department;
 else kind='lead';key=new.id::text;dept=null;end if;
 insert into public.kawt_operations_audit(entity_kind,entity_key,department,actor_id,action,previous,current_value)
 values(kind,key,dept,(select auth.uid()),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end;$$;
revoke all on function public.kawt_department_grant_stamp(),public.kawt_department_visit_stamp(),public.kawt_lead_stamp(),public.kawt_operations_record() from public,anon,authenticated;
create trigger kawt_department_grant_guard before insert or update on public.kawt_department_access for each row execute function public.kawt_department_grant_stamp();
create trigger kawt_department_visit_guard before insert or update on public.kawt_department_visits for each row execute function public.kawt_department_visit_stamp();
create trigger kawt_lead_guard before insert or update on public.donor_leads for each row execute function public.kawt_lead_stamp();
create trigger kawt_department_grant_audit after insert or update on public.kawt_department_access for each row execute function public.kawt_operations_record();
create trigger kawt_department_visit_audit after insert or update on public.kawt_department_visits for each row execute function public.kawt_operations_record();
create trigger kawt_lead_audit after insert or update on public.donor_leads for each row execute function public.kawt_operations_record();
alter table public.kawt_department_access enable row level security;
alter table public.kawt_department_visits enable row level security;
alter table public.kawt_operations_audit enable row level security;
revoke all on public.kawt_department_access,public.kawt_department_visits,public.kawt_operations_audit from anon;
grant select,insert,update on public.kawt_department_access,public.kawt_department_visits to authenticated;
revoke delete on public.kawt_department_access,public.kawt_department_visits from authenticated;
grant select on public.kawt_operations_audit to authenticated;
revoke insert,update,delete on public.kawt_operations_audit from authenticated;
create policy department_grant_read on public.kawt_department_access for select to authenticated using(user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy department_grant_manage on public.kawt_department_access for all to authenticated using(public.has_role(array['admin']::public.app_role[])) with check(public.has_role(array['admin']::public.app_role[]));
create policy department_visit_read on public.kawt_department_visits for select to authenticated using(public.kawt_department_allowed(department,true));
create policy department_visit_write on public.kawt_department_visits for insert to authenticated with check(public.kawt_department_allowed(department,true));
create policy department_visit_change on public.kawt_department_visits for update to authenticated using(public.kawt_department_allowed(department,true)) with check(public.kawt_department_allowed(department,true));
create policy operations_audit_read on public.kawt_operations_audit for select to authenticated using(public.has_role(array['admin']::public.app_role[]) or (entity_kind='department_visit' and public.kawt_department_allowed(department,true)));

create function public.kawt_department_summary(dept text,first_day date,last_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.kawt_department_allowed(dept,false) then raise insufficient_privilege;end if;
 if dept not in ('opd','urgent-care') or first_day>last_day or last_day-first_day>3660 then raise exception 'Invalid report range';end if;
 with v as (select * from public.kawt_department_visits where department=dept and service_date between first_day and last_day and not voided)
 select jsonb_build_object('visits',(select count(*) from v),
 'by_shift',(select coalesce(jsonb_agg(x),'[]') from (select shift label,count(*)::int count from v group by shift order by shift) x),
 'by_category',(select coalesce(jsonb_agg(x),'[]') from (select payment_category label,count(*)::int count from v group by payment_category order by payment_category) x),
 'by_doctor',(select coalesce(jsonb_agg(x),'[]') from (select coalesce(doctor_name,'Unassigned') label,count(*)::int count from v group by doctor_name order by count(*) desc) x),
 'by_service',(select coalesce(jsonb_agg(x),'[]') from (select service label,count(*)::int count from v group by service order by count(*) desc) x)) into result;
 return result;
end;$$;
create function public.kawt_department_roster(dept text) returns table(id uuid,name text,days_text text,times_text text,status text) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.kawt_department_allowed(dept,false) then raise insufficient_privilege;end if;
 return query select d.id,d.name,d.days_text,d.times_text,d.status from public.kawt_mc_doctors d where d.service_group=case when dept='opd' then 'OPD' else 'URGENT_CARE' end and d.status<>'inactive' order by d.name;
end;$$;
revoke all on function public.kawt_department_summary(text,date,date),public.kawt_department_roster(text) from public,anon;
grant execute on function public.kawt_department_summary(text,date,date),public.kawt_department_roster(text) to authenticated;
create function public.kawt_department_directory() returns table(user_id uuid,department text,access text,active boolean,revision int,email text,display_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_role(array['admin']::public.app_role[]) then raise insufficient_privilege;end if;
 return query select a.user_id,a.department,a.access,a.active,a.revision,u.email::text,coalesce(p.display_name,'') from public.kawt_department_access a join public.profiles p on p.id=a.user_id join auth.users u on u.id=a.user_id order by a.changed_at desc,a.user_id,a.department limit 501;
end;$$;
revoke all on function public.kawt_department_directory() from public,anon;
grant execute on function public.kawt_department_directory() to authenticated;
