-- Follow-up updates are authorized; dispense counts are always derived from patient-linked lines.
grant update on public.centre_referrals to authenticated;
create policy clinician_referral_followup on public.centre_referrals for update to authenticated
 using(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]))
 with check(public.has_role(array['admin','camp_manager','doctor']::public.app_role[]));

create function public.verify_inventory_dispense_total() returns trigger language plpgsql set search_path='' as $$
declare actual integer;
begin
 select coalesce(sum(d.units),0)::int into actual from public.camp_pharmacy_dispensations d where d.inventory_id=new.id;
 if new.dispensed_units<>actual then raise exception 'Dispensed quantity must equal patient-linked dispensing records';end if;
 return new;
end;$$;
create trigger inventory_dispense_total before insert or update on public.camp_pharmacy_inventory
 for each row execute function public.verify_inventory_dispense_total();

create or replace function public.apply_dispensation() returns trigger language plpgsql set search_path='' as $$
declare inv record;pat_camp text;
begin
 select camp_id,opening_units,procured_units,dispensed_units,wastage_units into inv
 from public.camp_pharmacy_inventory where id=new.inventory_id for update;
 if not found then raise exception 'Unknown inventory batch';end if;
 select camp_id into pat_camp from public.camp_patients where id=new.patient_id;
 if inv.camp_id is distinct from pat_camp then raise exception 'Patient and inventory belong to different camps';end if;
 if inv.opening_units+inv.procured_units-inv.dispensed_units-inv.wastage_units<new.units then raise exception 'Insufficient stock';end if;
 return new;
end;$$;
create function public.refresh_dispense_total() returns trigger language plpgsql set search_path='' as $$
begin
 update public.camp_pharmacy_inventory set dispensed_units=(
   select coalesce(sum(units),0)::int from public.camp_pharmacy_dispensations where inventory_id=new.inventory_id
 ) where id=new.inventory_id;
 return new;
end;$$;
create trigger refresh_dispense_totals after insert on public.camp_pharmacy_dispensations
 for each row execute function public.refresh_dispense_total();
