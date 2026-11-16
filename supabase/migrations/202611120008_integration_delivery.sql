alter table public.donations add column provider_payment_intent_id text;
alter table public.donations add column refunded_minor_units bigint not null default 0 check(refunded_minor_units>=0 and refunded_minor_units<=amount_minor_units);
alter table public.donations add column receipt_delivered_at timestamptz;
alter table public.integration_outbox drop constraint integration_outbox_kind_check;
alter table public.integration_outbox add constraint integration_outbox_kind_check check(kind in ('receipt','retention','impact_report','meta_lead_lookup','welcome'));
alter table public.integration_outbox add column next_attempt_at timestamptz;
alter table public.integration_outbox add column delivered_at timestamptz;
alter table public.integration_outbox add column failure_code text;
create or replace function public.donation_confirmed_effects() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and (tg_op='INSERT' or old.status is distinct from 'confirmed') then
  insert into public.integration_outbox(kind,donation_id,donor_id,dedupe_key)
  select 'receipt',new.id,new.donor_id,'receipt:'||new.id from public.donors where id=new.donor_id and receipt_opt_in and phone is not null
  on conflict(dedupe_key) do nothing;
 end if;
 if new.capital_project_id is not null then
  update public.capital_projects set raised_paisa=(select coalesce(sum(amount_minor_units-refunded_minor_units),0) from public.donations where capital_project_id=new.capital_project_id and status='confirmed' and currency='PKR') where id=new.capital_project_id;
 end if;
 return new;
end;$$;
drop trigger donation_effects on public.donations;
create trigger donation_effects after insert or update of status,refunded_minor_units on public.donations for each row execute function public.donation_confirmed_effects();
