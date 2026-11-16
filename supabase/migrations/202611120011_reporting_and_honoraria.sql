alter table public.camp_staff_roster add column duty_units int not null default 1 check(duty_units between 1 and 366);
alter table public.camp_staff_roster add column rate_paisa bigint check(rate_paisa>=0);
alter table public.camp_staff_roster add constraint honorarium_calculation check(rate_paisa is null or honorarium_paisa=rate_paisa*duty_units);
-- A partial refund reduces confirmed capital receipts without changing gross gift history.
create or replace function public.donation_confirmed_effects() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and (tg_op='INSERT' or old.status is distinct from 'confirmed') then
  insert into public.integration_outbox(kind,donation_id,donor_id,dedupe_key)
   select 'receipt',new.id,new.donor_id,'receipt:'||new.id from public.donors
   where id=new.donor_id and receipt_opt_in and phone is not null
   on conflict(dedupe_key) do nothing;
 end if;
 if new.capital_project_id is not null then
  update public.capital_projects set raised_paisa=(select coalesce(sum(amount_minor_units-refunded_minor_units),0) from public.donations where capital_project_id=new.capital_project_id and status='confirmed' and currency='PKR') where id=new.capital_project_id;
 end if;
 return new;
end;$$;
drop trigger donation_effects on public.donations;
create trigger donation_effects after insert or update of status,refunded_minor_units on public.donations for each row execute function public.donation_confirmed_effects();
