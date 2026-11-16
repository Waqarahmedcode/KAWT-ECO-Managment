-- KAWT database audit fixes (2026-11-11)
-- The historical reports were aggregated. Missing dispensing quantities are UNKNOWN, not zero.
-- Full legacy source rows remain unchanged in historical_camp_statistics.source_snapshot.
update public.historical_camp_statistics
set medicine_units_reported = null
where camp_id in ('FMC-04','FMC-05') and medicine_units_reported = 0;

-- FMC-04 categories are estimated medicine-share proxies; FMC-06 distribution derives
-- from a billing receipt. Neither is a clinician-recorded diagnosis by patient UID.
update public.historical_disease_summaries
set provenance = 'pharmacy_proxy_not_clinical_diagnosis'
where camp_id in ('FMC-04','FMC-06');

-- Enforce the patient/camp relationship at the database layer, not just in the API.
create function public.enforce_clinical_camp_match()
returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists (select 1 from public.camp_patients p
                 where p.id = new.patient_id and p.camp_id = new.camp_id) then
   raise exception 'Patient % is not registered in camp %', new.patient_id, new.camp_id;
 end if;
 return new;
end; $$;

create trigger consultation_patient_camp_match
before insert or update of patient_id,camp_id on public.camp_consultations
for each row execute function public.enforce_clinical_camp_match();

create trigger referral_patient_camp_match
before insert or update of patient_id,camp_id on public.centre_referrals
for each row execute function public.enforce_clinical_camp_match();

-- At most one primary clinician diagnosis per consultation.
create unique index if not exists one_primary_diagnosis_per_consultation
on public.camp_consultation_diagnoses(consultation_id)
where primary_diagnosis = true;

-- Fail closed for inventory rows whose dispensing totals cannot be linked to actual patients.
-- Historical medicine purchase lines are deliberately excluded from live dispensing tables.
comment on column public.historical_camp_statistics.medicine_units_reported is
  'NULL = quantity not documented; zero is only appropriate when a source explicitly verified no units';
comment on table public.historical_disease_summaries is
  'Source-derived historical distributions; check provenance. Pharmacy proxies are not confirmed clinical diagnoses.';

-- Zakat approval can be performed by a different manager from the admin posting
-- a ledger line. An invoker-rights trigger was blocked by the approver's
-- own-profile-only RLS policy. Use a trigger-only definer function to inspect
-- approved eligibility without broadening patient-record SELECT privileges.
create or replace function public.enforce_zakat_eligibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.patient_id is not null and not exists(
  select 1 from public.camp_patients p where p.id = new.patient_id and p.camp_id = new.camp_id
 ) then
  raise exception 'Patient belongs to another camp';
 end if;
 if new.fund = 'ZAKAT' and not exists (
  select 1 from public.patient_eligibility e
  join public.profiles approver on approver.id = e.approved_by
  where e.id = new.eligibility_id and e.camp_patient_id = new.patient_id
  and e.eligible_for_zakat = true and e.revoked_at is null
  and approver.role in ('admin','camp_manager')
 ) then
  raise exception 'Zakat expense requires an active approval for this specific patient';
 end if;
 return new;
end; $$;

-- Protect closed historical cohorts from accidental registration of fresh attendee IDs.
-- Past source reports must remain immutable reference summaries; any authorized
-- correction requires a separate provenance-controlled import workflow.
create function public.enforce_active_camp_for_intake()
returns trigger language plpgsql set search_path = '' as $$
declare current_status text;
begin
 select status::text into current_status from public.camps where id = new.camp_id;
 if current_status is null then
  raise exception 'Unknown medical camp';
 end if;
 if current_status not in ('approved','in_progress') then
  raise exception 'Intake is allowed only for approved or in-progress camps';
 end if;
 return new;
end; $$;
create trigger intake_open_camp_only
before insert on public.camp_patients
for each row execute function public.enforce_active_camp_for_intake();
