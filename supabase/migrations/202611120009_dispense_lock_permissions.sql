-- SELECT ... FOR UPDATE needs UPDATE privilege. Keep staff unable to alter
-- balances directly and acquire the lock inside this narrow, actor-checked trigger.
create or replace function public.apply_dispensation() returns trigger
language plpgsql security definer set search_path='' as $$
declare inventory public.camp_pharmacy_inventory;patient_camp text;
begin
 if not public.has_workspace_role(array['admin','pharmacist']) or new.dispensed_by is distinct from auth.uid() then
  raise exception 'FORBIDDEN';
 end if;
 select * into inventory from public.camp_pharmacy_inventory where id=new.inventory_id for update;
 if not found then raise exception 'Unknown inventory batch';end if;
 select camp_id into patient_camp from public.camp_patients where id=new.patient_id;
 if inventory.camp_id is distinct from patient_camp then raise exception 'Patient and inventory belong to different camps';end if;
 if new.units<=0 or inventory.opening_units+inventory.procured_units-inventory.dispensed_units-inventory.wastage_units<new.units then
  raise exception 'Insufficient stock';
 end if;
 return new;
end;$$;
