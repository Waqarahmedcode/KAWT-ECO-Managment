-- Staff requests do not grant access until an administrator approves them.
alter table public.kawt_lab_access add column revision int not null default 1;
alter policy kawt_lab_access_admin on public.kawt_lab_access with check(
 public.has_role(array['admin']::public.app_role[]) and
 (not active or exists(select 1 from public.profiles p where p.id=user_id and p.role='donor'))
);
create table public.kawt_lab_access_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 requester_email text not null check(length(requester_email) between 3 and 254),
 requester_name text not null default '' check(length(requester_name)<=140),
 laboratory_name text not null check(length(btrim(laboratory_name)) between 1 and 180),
 requested_access text not null check(requested_access in ('operator','viewer')),
 message text not null default '' check(length(message)<=1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 decision_note text not null default '' check(length(decision_note)<=1000),
 granted_access text check(granted_access in ('operator','viewer')),
 granted_laboratory_name text check(length(btrim(granted_laboratory_name)) between 1 and 180),
 decided_by uuid references public.profiles(id),decided_at timestamptz,
 revision int not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'approved' or (granted_access is not null and granted_laboratory_name is not null and decided_by is not null and decided_at is not null)),
 check(status<>'rejected' or (length(btrim(decision_note))>0 and decided_by is not null and decided_at is not null))
);
create unique index kawt_lab_one_pending_request on public.kawt_lab_access_requests(user_id) where status='pending';
create index on public.kawt_lab_access_requests(status,created_at,id);
create table public.kawt_lab_onboarding_audit (
 id bigint generated always as identity primary key,entity_id uuid not null,
 entity_kind text not null check(entity_kind in ('request','grant')),
 subject_user_id uuid not null references public.profiles(id),actor_id uuid references public.profiles(id),
 action text not null,previous jsonb,current_value jsonb not null,changed_at timestamptz not null default now()
);
create index on public.kawt_lab_onboarding_audit(subject_user_id,id);

create function public.kawt_lab_grant_stamp() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid=(select auth.uid());
begin
 if actor is not null and not public.has_role(array['admin']::public.app_role[]) then raise insufficient_privilege;end if;
 if new.active and not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=new.user_id and p.role='donor' and u.email_confirmed_at is not null) then
  raise exception 'Active Lab access ke liye verified dedicated account darkar hai';
 end if;
 if tg_op='UPDATE' then
  if new.user_id<>old.user_id then raise insufficient_privilege;end if;
  new.revision=old.revision+1;
 else new.revision=1;end if;
 if actor is not null then new.granted_by=actor;end if;
 new.laboratory_name=btrim(new.laboratory_name);new.changed_at=now();return new;
end;
$$;
create function public.kawt_lab_request_stamp() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid=(select auth.uid());person record;
begin
 if actor is null then raise insufficient_privilege;end if;
 if tg_op='INSERT' then
  if new.user_id<>actor then raise insufficient_privilege;end if;
  perform pg_advisory_xact_lock(hashtext('kawt-lab-request:'||actor::text));
  select u.email,u.email_confirmed_at,p.role,p.display_name into person from auth.users u join public.profiles p on p.id=u.id where u.id=actor;
  if person.role is distinct from 'donor' or person.email_confirmed_at is null then raise exception 'Lab request ke liye apne email ki tasdeeq aur dedicated account darkar hai';end if;
  if (select count(*) from public.kawt_lab_access_requests where user_id=actor and created_at>now()-interval '1 day')>=5 then raise exception 'Aaj ki request limit poori ho chuki hai; mojooda request administrator se review karwayein';end if;
  new.requester_email=person.email;new.requester_name=left(coalesce(person.display_name,''),140);
  new.status='pending';new.decision_note='';new.granted_access=null;new.granted_laboratory_name=null;new.decided_by=null;new.decided_at=null;new.revision=1;new.created_at=now();
 else
  if new.id<>old.id or new.user_id<>old.user_id or new.requester_email<>old.requester_email or new.requester_name<>old.requester_name or new.laboratory_name<>old.laboratory_name or new.requested_access<>old.requested_access or new.message<>old.message or old.status<>'pending' then raise insufficient_privilege;end if;
  if actor=old.user_id and new.status='withdrawn' then
   new.decision_note='';new.granted_access=null;new.granted_laboratory_name=null;new.decided_by=null;new.decided_at=null;
  elsif public.has_role(array['admin']::public.app_role[]) and new.status in ('approved','rejected') then
   new.decided_by=actor;new.decided_at=now();
   if new.status='approved' then
    if new.granted_access is null or new.granted_laboratory_name is null then raise check_violation;end if;
    if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=old.user_id and p.role='donor' and u.email_confirmed_at is not null and lower(u.email)=lower(old.requester_email)) then raise exception 'Account ka email ya role badal gaya hai; pehle latest details verify karein';end if;
    insert into public.kawt_lab_access(user_id,access,active,granted_by,laboratory_name)
     values(old.user_id,new.granted_access,true,actor,btrim(new.granted_laboratory_name))
     on conflict(user_id) do update set access=excluded.access,active=true,granted_by=excluded.granted_by,laboratory_name=excluded.laboratory_name;
   else new.granted_access=null;new.granted_laboratory_name=null;end if;
  else raise insufficient_privilege;end if;
  new.created_at=old.created_at;new.revision=old.revision+1;
 end if;
 new.updated_at=now();return new;
end;
$$;
create function public.kawt_lab_onboarding_record() returns trigger language plpgsql security definer set search_path='' as $$
declare item_id uuid;kind text;
begin
 if tg_table_name='kawt_lab_access_requests' then item_id=new.id;kind='request';else item_id=new.user_id;kind='grant';end if;
 insert into public.kawt_lab_onboarding_audit(entity_id,entity_kind,subject_user_id,actor_id,action,previous,current_value)
 values(item_id,kind,new.user_id,(select auth.uid()),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function public.kawt_lab_grant_stamp(),public.kawt_lab_request_stamp(),public.kawt_lab_onboarding_record() from public,anon,authenticated;
create trigger kawt_lab_grant_guard before insert or update on public.kawt_lab_access for each row execute function public.kawt_lab_grant_stamp();
create trigger kawt_lab_request_guard before insert or update on public.kawt_lab_access_requests for each row execute function public.kawt_lab_request_stamp();
create trigger kawt_lab_grant_history after insert or update on public.kawt_lab_access for each row execute function public.kawt_lab_onboarding_record();
create trigger kawt_lab_request_history after insert or update on public.kawt_lab_access_requests for each row execute function public.kawt_lab_onboarding_record();
alter table public.kawt_lab_access_requests enable row level security;
alter table public.kawt_lab_onboarding_audit enable row level security;
revoke all on public.kawt_lab_access_requests,public.kawt_lab_onboarding_audit from anon;
grant select,insert,update on public.kawt_lab_access_requests to authenticated;
revoke delete on public.kawt_lab_access_requests from authenticated;
grant select on public.kawt_lab_onboarding_audit to authenticated;
revoke insert,update,delete on public.kawt_lab_onboarding_audit from authenticated;
create policy kawt_lab_request_read on public.kawt_lab_access_requests for select to authenticated using(user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy kawt_lab_request_create on public.kawt_lab_access_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and decided_by is null);
create policy kawt_lab_request_change on public.kawt_lab_access_requests for update to authenticated using((user_id=(select auth.uid()) and status='pending') or public.has_role(array['admin']::public.app_role[])) with check(user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy kawt_lab_onboarding_admin_read on public.kawt_lab_onboarding_audit for select to authenticated using(public.has_role(array['admin']::public.app_role[]));

create function public.kawt_lab_access_directory() returns table(user_id uuid,email text,display_name text,profile_role text,access text,active boolean,laboratory_name text,revision int,changed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_role(array['admin']::public.app_role[]) then raise insufficient_privilege;end if;
 return query select a.user_id,u.email::text,coalesce(p.display_name,''),p.role::text,a.access,a.active,a.laboratory_name,a.revision,a.changed_at
 from public.kawt_lab_access a join public.profiles p on p.id=a.user_id join auth.users u on u.id=a.user_id
 order by a.active desc,a.changed_at desc,a.user_id limit 501;
end;
$$;
revoke all on function public.kawt_lab_access_directory() from public,anon;
grant execute on function public.kawt_lab_access_directory() to authenticated;
