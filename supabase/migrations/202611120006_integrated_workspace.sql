-- Shared operational workspace. Original historical records remain immutable imports.
alter type public.app_role add value if not exists 'csr_partner';
alter table public.camp_patients add column is_emergency boolean not null default false;
alter table public.profiles add column email text;
update public.profiles p set email=u.email from auth.users u where p.id=u.id;
create or replace function public.kawt_create_user_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,role,email,display_name) values(new.id,'donor',new.email,new.raw_user_meta_data->>'full_name') on conflict(id) do nothing;return new;end;$$;
alter table public.camp_patients add column client_request_id uuid;
create unique index patient_intake_idempotency on public.camp_patients(created_by,client_request_id) where client_request_id is not null;
alter table public.patient_eligibility add column subsidy_percent smallint not null default 100 check(subsidy_percent in (25,50,100));
alter table public.camp_financial_ledgers add column direction smallint not null default 1 check(direction in (-1,1));
create unique index one_financial_reversal on public.camp_financial_ledgers(reversal_of) where reversal_of is not null;

create function public.has_workspace_role(required text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text=any(required))
$$;
revoke all on function public.has_workspace_role(text[]) from public,anon;
grant execute on function public.has_workspace_role(text[]) to authenticated;

create or replace function public.enforce_zakat_eligibility() returns trigger
language plpgsql security definer set search_path='' as $$
declare original public.camp_financial_ledgers;
begin
 if new.reversal_of is not null then
  select * into original from public.camp_financial_ledgers where id=new.reversal_of;
  if not found or original.direction<>1 or new.direction<>-1
   or (new.camp_id,new.fund,new.expense,new.amount_paisa) is distinct from (original.camp_id,original.fund,original.expense,original.amount_paisa)
   or new.patient_id is distinct from original.patient_id or new.eligibility_id is distinct from original.eligibility_id then
   raise exception 'Reversal must exactly offset one original posting';
  end if;
  return new;
 end if;
 if new.direction<>1 then raise exception 'Negative direction requires an original posting';end if;
 if new.patient_id is not null and not exists(select 1 from public.camp_patients p where p.id=new.patient_id and p.camp_id=new.camp_id) then
  raise exception 'Patient belongs to another camp';
 end if;
 if new.fund='ZAKAT' and not exists(
  select 1 from public.patient_eligibility e join public.profiles p on p.id=e.approved_by
  where e.id=new.eligibility_id and e.camp_patient_id=new.patient_id and e.eligible_for_zakat and e.revoked_at is null
  and p.role in ('admin','camp_manager')) then raise exception 'Active patient eligibility approval is required';end if;
 return new;
end;$$;

create table public.inventory_adjustments (
 id uuid primary key default gen_random_uuid(), inventory_id uuid not null references public.camp_pharmacy_inventory(id),
 procurement_delta int not null default 0, wastage_delta int not null default 0,
 reason text not null check(length(reason)>=8), requested_by uuid not null references public.profiles(id),
 requested_at timestamptz not null default now(), approved_by uuid references public.profiles(id), approved_at timestamptz,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 check(procurement_delta<>0 or wastage_delta<>0)
);
create function public.approve_inventory_adjustment(adjustment_id uuid, approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare a public.inventory_adjustments;
begin
 if not public.has_workspace_role(array['admin','camp_manager']) then raise exception 'FORBIDDEN';end if;
 select * into a from public.inventory_adjustments where id=adjustment_id and status='pending' for update;
 if not found then raise exception 'Pending adjustment not found';end if;
 if approve then
  update public.camp_pharmacy_inventory set procured_units=procured_units+a.procurement_delta,wastage_units=wastage_units+a.wastage_delta where id=a.inventory_id;
 end if;
 update public.inventory_adjustments set status=case when approve then 'approved' else 'rejected' end,approved_by=auth.uid(),approved_at=now() where id=a.id;
end;$$;
revoke all on function public.approve_inventory_adjustment(uuid,boolean) from public,anon;
grant execute on function public.approve_inventory_adjustment(uuid,boolean) to authenticated;
-- Only controlled adjustments and patient-linked dispense triggers can change existing balances.
revoke update on public.camp_pharmacy_inventory from authenticated;
create or replace function public.refresh_dispense_total() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.camp_pharmacy_inventory set dispensed_units=(select coalesce(sum(units),0)::int from public.camp_pharmacy_dispensations where inventory_id=new.inventory_id) where id=new.inventory_id;
 return new;
end;$$;

create table public.project_milestones (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.capital_projects(id),
 title text not null, due_date date, budget_paisa bigint check(budget_paisa>=0),
 status text not null default 'planned' check(status in ('planned','in_progress','completed','blocked')), notes text
);
create table public.wash_readings (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.wash_projects(id),
 recorded_on date not null,source_liters numeric(14,2) not null check(source_liters>0),
 pure_liters numeric(14,2) not null check(pure_liters>=0 and pure_liters<=source_liters),
 quality_reference text,recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create function public.refresh_wash_reading() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.wash_projects set volume_source_liters=(select source_liters from public.wash_readings where project_id=new.project_id order by recorded_on desc,created_at desc limit 1),
 volume_pure_liters=(select pure_liters from public.wash_readings where project_id=new.project_id order by recorded_on desc,created_at desc limit 1) where id=new.project_id;
 return new;
end;$$;
create trigger latest_wash_reading after insert on public.wash_readings for each row execute function public.refresh_wash_reading();

create table public.csr_partners (
 id uuid primary key default gen_random_uuid(),organization text not null,sector text not null,
 contact_name text,contact_email text,interests text[] not null default '{}',consent_to_contact boolean not null default false,
 status text not null default 'prospect' check(status in ('prospect','contacted','partner','inactive')),
 created_at timestamptz not null default now()
);
create table public.csr_memberships (
 user_id uuid not null references public.profiles(id),partner_id uuid not null references public.csr_partners(id),primary key(user_id,partner_id)
);
create table public.csr_commitments (
 id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.csr_partners(id),
 project_id uuid references public.capital_projects(id),camp_id text references public.camps(id),
 pillar text not null check(pillar in ('social','environment','governance','engagement')),
 sdg text not null check(sdg in ('SDG3','SDG6','SDG8','SDG13','SDG17')),
 description text not null,pledged_paisa bigint not null default 0 check(pledged_paisa>=0),
 volunteer_hours numeric(10,2) not null default 0 check(volunteer_hours>=0),status text not null default 'proposed'
 check(status in ('proposed','approved','active','completed'))
);
create table public.fundraising_campaigns (
 id uuid primary key default gen_random_uuid(),title text not null,season text not null,channel text not null,
 country text,start_date date,end_date date,budget_paisa bigint not null default 0 check(budget_paisa>=0),
 spend_paisa bigint not null default 0 check(spend_paisa>=0),status text not null default 'planned',source_reference text,
 check(end_date is null or start_date is null or end_date>=start_date)
);
create table public.peer_benchmarks (
 id uuid primary key default gen_random_uuid(),organization text not null,metric text not null,
 value numeric(18,4) not null,unit text not null,period_start date not null,period_end date not null,
 source_url text not null check(source_url ~ '^https://'),methodology text not null,verified_by uuid not null references public.profiles(id),
 check(period_end>=period_start),created_at timestamptz not null default now()
);
create table public.bank_routes (
 id uuid primary key default gen_random_uuid(),bank_name text not null,fund public.fund_type not null,
 iban text not null,account_title text not null,verified_by uuid references public.profiles(id),
 verification_reference text,verified_at timestamptz,active boolean not null default false,
 check(not active or (verified_by is not null and verified_at is not null and length(verification_reference)>=4))
);
create table public.sponsorships (
 id uuid primary key default gen_random_uuid(),donor_id uuid not null references public.donors(id),
 camp_id text references public.camps(id),project_id uuid references public.capital_projects(id),
 tier text not null,amount_minor_units bigint not null check(amount_minor_units>0),currency text not null,
 dedication text,status text not null default 'pledged' check(status in ('pledged','active','fulfilled','cancelled')),created_at timestamptz not null default now()
);
alter table public.donations add column campaign_id uuid references public.fundraising_campaigns(id);
alter table public.donations add column bank_route_id uuid references public.bank_routes(id);
alter table public.donations add column proof_reference text;
alter table public.donations add column confirmed_by uuid references public.profiles(id);
alter table public.donations add column confirmed_at timestamptz;
alter table public.donations add column request_id uuid unique;
alter table public.donor_leads add column full_name text;
alter table public.donor_leads add column email text;
alter table public.donor_leads add column phone text;
alter table public.donor_leads add column marketing_consent boolean not null default false;
alter table public.donor_leads add column assigned_to uuid references public.profiles(id);
create table public.integration_outbox (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('receipt','retention','impact_report','meta_lead_lookup')),
 donation_id uuid references public.donations(id),lead_id uuid references public.donor_leads(id),donor_id uuid references public.donors(id),
 dedupe_key text not null unique,status text not null default 'queued'
 check(status in ('queued','processing','submitted','failed','needs_configuration','needs_reconciliation')),
 attempts int not null default 0,last_error text,provider_reference text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.published_reports (
 id uuid primary key default gen_random_uuid(),title text not null,camp_id text references public.camps(id),
 public_url text not null check(public_url ~ '^https://'),approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default now()
);
alter table public.integration_outbox add column report_id uuid references public.published_reports(id);
grant select,insert,update on public.donor_leads to authenticated;
create policy admin_leads on public.donor_leads for all to authenticated using(public.has_workspace_role(array['admin'])) with check(public.has_workspace_role(array['admin']));
create table public.institutional_documents (
 id uuid primary key default gen_random_uuid(),title text not null,kind text not null,
 source_reference text not null,valid_until date,verified_by uuid references public.profiles(id),verified_at timestamptz,
 status text not null default 'pending_review' check(status in ('pending_review','verified','expired'))
);
create table public.public_request_limits (
 fingerprint text primary key,window_start timestamptz not null default now(),requests int not null default 0
);

create function public.donation_confirmed_effects() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and (tg_op='INSERT' or old.status is distinct from 'confirmed') then
  insert into public.integration_outbox(kind,donation_id,donor_id,dedupe_key)
  select 'receipt',new.id,new.donor_id,'receipt:'||new.id from public.donors where id=new.donor_id and receipt_opt_in and phone is not null
  on conflict(dedupe_key) do nothing;
 end if;
 if new.capital_project_id is not null then
  update public.capital_projects set raised_paisa=(select coalesce(sum(amount_minor_units),0) from public.donations where capital_project_id=new.capital_project_id and status='confirmed' and currency='PKR') where id=new.capital_project_id;
 end if;
 return new;
end;$$;
create trigger donation_effects after insert or update of status on public.donations for each row execute function public.donation_confirmed_effects();

create function public.record_workspace_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor_id,event_name,entity,entity_id,details)
 values(auth.uid(),tg_op,tg_table_name,to_jsonb(new)->>'id',jsonb_build_object('changed_at',now()));
 return new;
end;$$;

do $$ declare t text;
begin
 foreach t in array array['inventory_adjustments','project_milestones','wash_readings','csr_partners','csr_memberships','csr_commitments','fundraising_campaigns','peer_benchmarks','bank_routes','sponsorships','integration_outbox','published_reports','institutional_documents'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy workspace_management on public.%I for all to authenticated using(public.has_workspace_role(array[''admin'',''camp_manager''])) with check(public.has_workspace_role(array[''admin'',''camp_manager'']))',t);
 end loop;
 foreach t in array array['camps','camp_patients','patient_eligibility','camp_consultations','camp_staff_roster','camp_financial_ledgers','centre_referrals','inventory_adjustments','capital_projects','wash_readings','csr_commitments','donations','bank_routes'] loop
  execute format('create trigger audit_workspace after insert or update on public.%I for each row execute function public.record_workspace_audit()',t);
 end loop;
end;$$;
alter table public.public_request_limits enable row level security;
revoke all on public.public_request_limits from anon,authenticated;
grant select on public.audit_log to authenticated;
create policy admin_audit on public.audit_log for select to authenticated using(public.has_workspace_role(array['admin']));
grant select on public.profiles to authenticated;
create policy admin_profiles on public.profiles for select to authenticated using(public.has_workspace_role(array['admin']));
grant insert,update on public.capital_projects,public.wash_projects,public.donations to authenticated;
create policy manage_capital on public.capital_projects for all to authenticated using(public.has_workspace_role(array['admin','camp_manager'])) with check(public.has_workspace_role(array['admin','camp_manager']));
create policy manage_wash on public.wash_projects for all to authenticated using(public.has_workspace_role(array['admin','camp_manager'])) with check(public.has_workspace_role(array['admin','camp_manager']));
create policy finance_donations on public.donations for all to authenticated using(public.has_workspace_role(array['admin'])) with check(public.has_workspace_role(array['admin']));
create policy pharmacist_adjustment_read on public.inventory_adjustments for select to authenticated using(public.has_workspace_role(array['pharmacist']));
create policy pharmacist_adjustment_request on public.inventory_adjustments for insert to authenticated with check(public.has_workspace_role(array['pharmacist']) and requested_by=auth.uid() and status='pending' and approved_by is null);
create policy partner_own_membership on public.csr_memberships for select to authenticated using(user_id=auth.uid());
create policy partner_own_commitments on public.csr_commitments for select to authenticated using(exists(select 1 from public.csr_memberships m where m.partner_id=csr_commitments.partner_id and m.user_id=auth.uid()));
create policy partner_own_organization on public.csr_partners for select to authenticated using(exists(select 1 from public.csr_memberships m where m.partner_id=csr_partners.id and m.user_id=auth.uid()));
create policy institutional_view on public.institutional_documents for select to authenticated using(status='verified');
create policy partner_capital_view on public.capital_projects for select to authenticated using(public.has_workspace_role(array['csr_partner']));
create policy partner_published_reports on public.published_reports for select to authenticated using(public.has_workspace_role(array['csr_partner','donor']));
create policy donor_sponsorships on public.sponsorships for select to authenticated using(exists(select 1 from public.donors d where d.id=donor_id and d.auth_user_id=auth.uid()));

create function public.set_staff_role(target uuid, desired text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_workspace_role(array['admin']) then raise exception 'FORBIDDEN';end if;
 if desired not in ('admin','camp_manager','doctor','pharmacist','donor','csr_partner') then raise exception 'Invalid role';end if;
 if desired<>'admin' and exists(select 1 from public.profiles where id=target and role='admin') and (select count(*) from public.profiles where role='admin')<=1 then raise exception 'Cannot remove the final administrator';end if;
 update public.profiles set role=desired::public.app_role where id=target;
 if not found then raise exception 'User must first sign up';end if;
 insert into public.audit_log(actor_id,event_name,entity,entity_id,details) values(auth.uid(),'ROLE_CHANGED','profiles',target::text,jsonb_build_object('role',desired));
end;$$;
revoke all on function public.set_staff_role(uuid,text) from public,anon;
grant execute on function public.set_staff_role(uuid,text) to authenticated;
