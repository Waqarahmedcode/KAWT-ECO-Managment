-- KAWT — source-of-truth PostgreSQL migration, Supabase/Postgres 15+
-- This schema keeps legacy summaries separate from authenticated, patient-linked live transactions.
create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','camp_manager','doctor','pharmacist','donor');
create type public.camp_status as enum ('planned','site_review','approved','in_progress','completed','cancelled');
create type public.fund_type as enum ('ZAKAT','GENERAL');
create type public.expense_type as enum ('MEDICINE','DIAGNOSTIC','HONORARIUM','TRANSPORT','VENUE','CATERING','FUEL','PHOTOGRAPHY','EQUIPMENT','OTHER');
create type public.referral_status as enum ('issued','scheduled','arrived','completed','cancelled','unreachable');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role public.app_role not null default 'donor', display_name text,
 created_at timestamptz not null default now()
);
create function public.create_user_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,role) values(new.id,'donor') on conflict(id) do nothing;return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_user_profile();
-- SECURITY: authenticate against auth.users, never editable user_metadata.
create function public.has_role(required public.app_role[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=any(required))
$$;
revoke all on function public.has_role(public.app_role[]) from public,anon;
grant execute on function public.has_role(public.app_role[]) to authenticated;

create table public.camps (
 id text primary key check(id ~ '^FMC-[0-9]{2,3}$'),
 title text not null, camp_date date, area text not null, address text,
 partner text, organizer text, selection_reason text,
 status public.camp_status not null default 'planned',
 hazard_assessment jsonb not null default '{}'::jsonb,
 approved_by uuid references public.profiles(id),
 source_type text not null default 'operational' check(source_type in ('legacy_source','operational')),
 created_at timestamptz not null default now()
);
create index on public.camps(camp_date);
create table public.historical_camp_statistics (
 camp_id text primary key references public.camps(id) on delete restrict,
 total_patients int not null check(total_patients>=0), male_recorded int, female_recorded int,
 children_recorded int, adults_recorded int, elderly_recorded int,
 emergencies_recorded int, referrals_recorded int, pregnant_recorded int,
 team_counts jsonb not null default '{}'::jsonb, historical_vitals jsonb,
 total_spend_paisa bigint not null check(total_spend_paisa>=0),
 zakat_spend_paisa bigint not null check(zakat_spend_paisa>=0),
 general_spend_paisa bigint not null check(general_spend_paisa>=0),
 medicine_units_reported int, notes text, data_note text,
 source_name text not null, verification_status text not null default 'pending_source_verification',
 check(total_spend_paisa=zakat_spend_paisa+general_spend_paisa)
);
create table public.historical_expense_lines (
 id bigint generated always as identity primary key,
 camp_id text not null references public.camps(id), item text not null,
 amount_paisa bigint not null check(amount_paisa>=0),source_label text not null,
 provenance text not null default 'legacy_report'
);
create table public.historical_medicine_lines (
 id bigint generated always as identity primary key,
 camp_id text not null references public.camps(id), medicine text not null,
 category text, units_reported int check(units_reported>=0),
 cost_paisa bigint check(cost_paisa>=0), formulation text,
 provenance text not null default 'source_summary_not_patient_dispensing'
);
create table public.historical_disease_summaries (
 id bigint generated always as identity primary key,
 camp_id text not null references public.camps(id), condition text not null,
 cases_reported int, pct_reported numeric(6,3),
 provenance text not null default 'legacy_summary_not_uid_linked'
);

create sequence public.patient_uid_seq;
create table public.camp_patients (
 id uuid primary key default gen_random_uuid(),
 uid text not null unique,
 camp_id text not null references public.camps(id),
 display_name text, age_years smallint not null check(age_years between 0 and 120),
 age_band text generated always as (case when age_years<15 then 'child_0_14' when age_years<60 then 'adult_15_59' else 'older_60_plus' end) stored,
 gender text not null check(gender in ('female','male','undisclosed')),
 pregnancy_status text not null default 'not_recorded' check(pregnancy_status in ('pregnant','not_pregnant','not_applicable','not_recorded')),
 bp_systolic smallint check(bp_systolic between 40 and 300),
 bp_diastolic smallint check(bp_diastolic between 20 and 220),
 blood_glucose_mg_dl numeric(6,1) check(blood_glucose_mg_dl between 10 and 1000),
 bmi numeric(5,2) check(bmi between 5 and 100),
 phone_encrypted bytea,
 consent_recorded boolean not null default false,
 registration_time timestamptz not null default now(),
 created_by uuid references public.profiles(id)
);
create index on public.camp_patients(camp_id);
create function public.assign_patient_uid() returns trigger language plpgsql set search_path='' as $$
begin
 if new.uid is not null and new.uid<>'' then raise exception 'UID is generated by database';end if;
 new.uid='KAWT-'||replace(new.camp_id,'-','')||'-'||lpad(nextval('public.patient_uid_seq')::text,7,'0');
 return new;
end;$$;
create trigger generate_uid before insert on public.camp_patients for each row execute function public.assign_patient_uid();

create table public.patient_eligibility (
 id uuid primary key default gen_random_uuid(),
 camp_patient_id uuid not null references public.camp_patients(id),
 eligible_for_zakat boolean not null, screening_reference text not null,
 approved_by uuid not null references public.profiles(id),
 approved_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique(camp_patient_id,id)
);
create unique index eligibility_active_unique on public.patient_eligibility(camp_patient_id) where revoked_at is null;
create table public.camp_consultations (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.camp_patients(id),
 camp_id text not null references public.camps(id),
 clinician_id uuid not null references public.profiles(id),
 chief_complaint text, clinical_note text, attended_at timestamptz not null default now()
);
create index on public.camp_consultations(camp_id,attended_at);
create table public.camp_consultation_diagnoses (
 id bigint generated always as identity primary key,
 consultation_id uuid not null references public.camp_consultations(id),
 category text not null check(category in ('GI_ACIDITY','MUSCULOSKELETAL','RESPIRATORY_ALLERGY','DERMATOLOGY','INFECTIONS','NEUROLOGICAL','NUTRITION_ANEMIA','OTHER')),
 clinical_code text, primary_diagnosis boolean not null default false
);
create table public.centre_referrals (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.camp_patients(id),
 camp_id text not null references public.camps(id),
 service text not null check(service in ('XRAY','ULTRASOUND','LAB','SPECIALIST_OPD','EMERGENCY','OTHER')),
 status public.referral_status not null default 'issued',
 referral_code text not null unique default encode(gen_random_bytes(12),'hex'),
 issued_by uuid not null references public.profiles(id),
 issued_at timestamptz not null default now(),
 followup_at timestamptz, completed_at timestamptz, clinical_notes text
);
create index on public.centre_referrals(patient_id,status);

create table public.medicine_catalog (
 id uuid primary key default gen_random_uuid(),
 generic_name text not null, formulation text not null,
 stock_unit text not null default 'unit',
 unique(generic_name,formulation,stock_unit)
);
create table public.camp_pharmacy_inventory (
 id uuid primary key default gen_random_uuid(),
 camp_id text not null references public.camps(id),
 medicine_id uuid not null references public.medicine_catalog(id),
 batch_no text not null default 'UNSPECIFIED',
 opening_units integer not null default 0 check(opening_units>=0),
 procured_units integer not null default 0 check(procured_units>=0),
 dispensed_units integer not null default 0 check(dispensed_units>=0),
 wastage_units integer not null default 0 check(wastage_units>=0),
 closing_units integer generated always as (opening_units+procured_units-dispensed_units-wastage_units) stored,
 confirmed_by uuid references public.profiles(id),
 unique(camp_id,medicine_id,batch_no),
 check(opening_units+procured_units>=dispensed_units+wastage_units)
);
create table public.camp_pharmacy_dispensations (
 id uuid primary key default gen_random_uuid(),
 inventory_id uuid not null references public.camp_pharmacy_inventory(id),
 patient_id uuid not null references public.camp_patients(id),
 units integer not null check(units>0),
 dispensed_by uuid not null references public.profiles(id),
 dispensed_at timestamptz not null default now()
);
create function public.apply_dispensation() returns trigger language plpgsql set search_path='' as $$
declare inv_camp text; pat_camp text;
begin
 select camp_id into inv_camp from public.camp_pharmacy_inventory where id=new.inventory_id for update;
 select camp_id into pat_camp from public.camp_patients where id=new.patient_id;
 if inv_camp is distinct from pat_camp then raise exception 'Patient and inventory belong to different camps';end if;
 update public.camp_pharmacy_inventory set dispensed_units=dispensed_units+new.units where id=new.inventory_id;
 return new;
end;$$;
create trigger increment_dispensed_units before insert on public.camp_pharmacy_dispensations for each row execute function public.apply_dispensation();
create function public.reject_dispense_mutation() returns trigger language plpgsql as $$begin raise exception 'Dispensations are immutable; use an approved adjustment workflow';end;$$;
create trigger no_dispensation_rewrite before update or delete on public.camp_pharmacy_dispensations for each row execute function public.reject_dispense_mutation();

create table public.camp_staff_roster (
 id uuid primary key default gen_random_uuid(),
 camp_id text not null references public.camps(id),
 staff_name text not null,role text not null check(role in ('DOCTOR','NURSE','PARAMEDIC','PHARMACIST','LAB_TECH','VOLUNTEER')),
 honorarium_paisa bigint not null default 0 check(honorarium_paisa>=0),
 attendance_confirmed boolean not null default false,
 payout_status text not null default 'pending' check(payout_status in ('pending','approved','paid')),
 notes text
);
create table public.camp_financial_ledgers (
 id uuid primary key default gen_random_uuid(),
 camp_id text not null references public.camps(id),
 fund public.fund_type not null, expense public.expense_type not null,
 amount_paisa bigint not null check(amount_paisa>0),
 patient_id uuid references public.camp_patients(id),
 eligibility_id uuid references public.patient_eligibility(id),
 invoice_number text, invoice_storage_path text,
 memo text, reversal_of uuid references public.camp_financial_ledgers(id),
 posted_by uuid not null references public.profiles(id),
 posted_at timestamptz not null default now(),
 constraint zakat_does_not_fund_overheads check (
  fund='GENERAL' or (expense in ('MEDICINE','DIAGNOSTIC') and patient_id is not null and eligibility_id is not null)
 )
);
create index on public.camp_financial_ledgers(camp_id,fund,posted_at);
create function public.enforce_zakat_eligibility() returns trigger language plpgsql set search_path='' as $$
begin
 if new.patient_id is not null and not exists(select 1 from public.camp_patients p where p.id=new.patient_id and p.camp_id=new.camp_id)
 then raise exception 'Patient belongs to another camp';end if;
 if new.fund='ZAKAT' and not exists (
  select 1 from public.patient_eligibility e join public.profiles approver on approver.id=e.approved_by
  where e.id=new.eligibility_id and e.camp_patient_id=new.patient_id and e.eligible_for_zakat=true
    and e.revoked_at is null and approver.role in ('admin','camp_manager'))
 then raise exception 'Zakat requires an active eligible-patient approval by a designated approver';end if;
 return new;
end;$$;
create trigger enforce_zakat before insert on public.camp_financial_ledgers for each row execute function public.enforce_zakat_eligibility();
create function public.prevent_financial_mutation() returns trigger language plpgsql as $$begin raise exception 'Financial posts are append-only; use a separately approved reversing entry';end;$$;
create trigger immutable_financial_entries before update or delete on public.camp_financial_ledgers for each row execute function public.prevent_financial_mutation();

create table public.donors (
 id uuid primary key default gen_random_uuid(),auth_user_id uuid references auth.users(id),
 full_name text, email text, phone text, country text,
 marketing_consent boolean not null default false,
 consent_at timestamptz, created_at timestamptz not null default now()
);
create index on public.donors(auth_user_id);
create table public.capital_projects (
 id uuid primary key default gen_random_uuid(),phase smallint not null check(phase between 1 and 4),
 title text not null,start_year smallint not null,end_year smallint not null,
 target_paisa bigint,raised_paisa bigint not null default 0,
 status text not null default 'planned',description text
);
create table public.donations (
 id uuid primary key default gen_random_uuid(),donor_id uuid references public.donors(id),
 camp_id text references public.camps(id),capital_project_id uuid references public.capital_projects(id),
 fund public.fund_type not null, currency text not null default 'PKR',
 amount_minor_units bigint not null check(amount_minor_units>0),
 provider text not null,provider_payment_id text, status text not null default 'pending'
  check(status in ('pending','confirmed','failed','refunded')),
 receipt_sent_at timestamptz, created_at timestamptz not null default now(),
 unique(provider,provider_payment_id)
);
create table public.donor_leads (
 id uuid primary key default gen_random_uuid(),provider text not null, external_lead_id text not null,
 campaign_ref text,submitted_at timestamptz not null default now(),
 contact_status text not null default 'needs_secure_lookup',
 pii_encrypted bytea, consent_basis text,
 unique(provider,external_lead_id)
);
create table public.webhook_events (
 id uuid primary key default gen_random_uuid(),provider text not null, event_id text not null,
 status text not null default 'received',payload_sha256 text not null,
 received_at timestamptz not null default now(), processed_at timestamptz,
 unique(provider,event_id)
);
create table public.wash_projects (
 id uuid primary key default gen_random_uuid(),title text not null,kind text not null check(kind in ('RO','SABEEL','BORE_WELL')),
 location text,volume_source_liters numeric(14,2),volume_pure_liters numeric(14,2),
 yield_pct numeric(8,3) generated always as (case when volume_source_liters>0 then volume_pure_liters*100/volume_source_liters else null end) stored,
 check(volume_source_liters is null or volume_source_liters>=0),
 check(volume_pure_liters is null or volume_pure_liters>=0),
 check(volume_source_liters is null or volume_pure_liters is null or volume_pure_liters<=volume_source_liters)
);
create table public.audit_log (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id),event_name text not null,entity text not null,
 entity_id text,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

-- All public tables require authenticated access. Unverified historical aggregates are staff-only;
-- donor-facing impact metrics must be explicitly published after independent review.
do $$ declare t text;
begin foreach t in array array[
 'profiles','camps','historical_camp_statistics','historical_expense_lines','historical_medicine_lines','historical_disease_summaries',
 'camp_patients','patient_eligibility','camp_consultations','camp_consultation_diagnoses','centre_referrals',
 'medicine_catalog','camp_pharmacy_inventory','camp_pharmacy_dispensations','camp_staff_roster','camp_financial_ledgers',
 'donors','capital_projects','donations','donor_leads','webhook_events','wash_projects','audit_log'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;end $$;
-- Grant operations deliberately; policies below still control rows.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select on public.camps,public.historical_camp_statistics,public.historical_expense_lines,public.historical_medicine_lines,public.historical_disease_summaries,public.capital_projects,public.wash_projects to authenticated;
grant select,insert on public.camp_patients,public.camp_consultations,public.camp_consultation_diagnoses,public.centre_referrals,public.camp_pharmacy_dispensations to authenticated;
grant select,insert,update on public.patient_eligibility,public.camp_pharmacy_inventory,public.camp_staff_roster to authenticated;
grant select on public.medicine_catalog,public.camp_financial_ledgers to authenticated;
grant insert on public.camp_financial_ledgers to authenticated;
grant select,insert,update on public.donors to authenticated;
grant select on public.donations to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy staff_camps on public.camps for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist']::public.app_role[]));
create policy staff_legacy_stats on public.historical_camp_statistics for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist']::public.app_role[]));
create policy finance_legacy_expenses on public.historical_expense_lines for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy staff_legacy_meds on public.historical_medicine_lines for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist']::public.app_role[]));
create policy staff_legacy_diseases on public.historical_disease_summaries for select to authenticated using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));
create policy staff_patient_read on public.camp_patients for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist']::public.app_role[]));
create policy clinic_patient_write on public.camp_patients for insert to authenticated with check(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]) and created_by=(select auth.uid()));
create policy approver_read on public.patient_eligibility for select to authenticated using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));
create policy approver_write on public.patient_eligibility for insert to authenticated with check(public.has_role(array['admin','camp_manager']::public.app_role[]) and approved_by=(select auth.uid()));
create policy clinician_consult_read on public.camp_consultations for select to authenticated using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));
create policy clinician_consult_insert on public.camp_consultations for insert to authenticated with check(public.has_role(array['admin','doctor']::public.app_role[]) and clinician_id=(select auth.uid()));
create policy clinician_diagnosis_read on public.camp_consultation_diagnoses for select to authenticated using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));
create policy clinician_diagnosis_insert on public.camp_consultation_diagnoses for insert to authenticated with check(public.has_role(array['admin','doctor']::public.app_role[]));
create policy clinician_referral_read on public.centre_referrals for select to authenticated using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));
create policy clinician_referral_insert on public.centre_referrals for insert to authenticated with check(public.has_role(array['admin','doctor']::public.app_role[]) and issued_by=(select auth.uid()));
create policy pharmacist_catalog on public.medicine_catalog for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist']::public.app_role[]));
create policy pharmacist_inventory_read on public.camp_pharmacy_inventory for select to authenticated using(public.has_role(array['admin','camp_manager','pharmacist']::public.app_role[]));
create policy pharmacist_inventory_insert on public.camp_pharmacy_inventory for insert to authenticated with check(public.has_role(array['admin','camp_manager','pharmacist']::public.app_role[]));
create policy pharmacist_inventory_update on public.camp_pharmacy_inventory for update to authenticated using(public.has_role(array['admin','camp_manager','pharmacist']::public.app_role[])) with check(public.has_role(array['admin','camp_manager','pharmacist']::public.app_role[]));
create policy pharmacist_dispensation_read on public.camp_pharmacy_dispensations for select to authenticated using(public.has_role(array['admin','camp_manager','pharmacist']::public.app_role[]));
create policy pharmacist_dispensation_insert on public.camp_pharmacy_dispensations for insert to authenticated with check(public.has_role(array['admin','pharmacist']::public.app_role[]) and dispensed_by=(select auth.uid()));
create policy roster_read on public.camp_staff_roster for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy roster_write on public.camp_staff_roster for insert to authenticated with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy roster_edit on public.camp_staff_roster for update to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[])) with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy finance_read on public.camp_financial_ledgers for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy finance_post on public.camp_financial_ledgers for insert to authenticated with check(public.has_role(array['admin']::public.app_role[]) and posted_by=(select auth.uid()));
create policy donor_own on public.donors for select to authenticated using(auth_user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy donor_create on public.donors for insert to authenticated with check(auth_user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy donor_update on public.donors for update to authenticated using(auth_user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[])) with check(auth_user_id=(select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy donor_donation_read on public.donations for select to authenticated using(public.has_role(array['admin']::public.app_role[]) or exists(select 1 from public.donors d where d.id=donor_id and d.auth_user_id=(select auth.uid())));
create policy staff_capital on public.capital_projects for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist','donor']::public.app_role[]));
create policy staff_wash on public.wash_projects for select to authenticated using(public.has_role(array['admin','camp_manager','doctor','pharmacist']::public.app_role[]));

-- SECURITY NOTE: database superuser/postgres/server connection can bypass RLS.
-- All Next.js server routes must authorize the current Supabase user BEFORE any privileged DB query.
