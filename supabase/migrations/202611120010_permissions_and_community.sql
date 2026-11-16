-- Align direct Data API access with the server role matrix.
do $$ declare t text;
begin foreach t in array array['bank_routes','integration_outbox','institutional_documents','published_reports'] loop
 execute format('drop policy workspace_management on public.%I',t);
 execute format('create policy management_read on public.%I for select to authenticated using(public.has_workspace_role(array[''admin'',''camp_manager'']))',t);
 execute format('create policy administrator_insert on public.%I for insert to authenticated with check(public.has_workspace_role(array[''admin'']))',t);
 execute format('create policy administrator_update on public.%I for update to authenticated using(public.has_workspace_role(array[''admin''])) with check(public.has_workspace_role(array[''admin'']))',t);
end loop;end $$;
drop policy workspace_management on public.inventory_adjustments;
create policy management_adjustment_read on public.inventory_adjustments for select to authenticated using(public.has_workspace_role(array['admin','camp_manager']));
create policy management_adjustment_request on public.inventory_adjustments for insert to authenticated
 with check(public.has_workspace_role(array['admin','camp_manager']) and requested_by=auth.uid() and status='pending' and approved_by is null);
revoke update on public.inventory_adjustments from authenticated;
revoke insert,update on public.donations from authenticated;
create function public.confirm_bank_donation(donation_id uuid,evidence text) returns uuid
language plpgsql security definer set search_path='' as $$
declare found_id uuid;
begin
 if not public.has_workspace_role(array['admin']) then raise exception 'FORBIDDEN';end if;
 if evidence is null or length(trim(evidence))<4 then raise exception 'Reconciled payment evidence is required';end if;
 update public.donations set status='confirmed',proof_reference=evidence,confirmed_by=auth.uid(),confirmed_at=now()
 where id=donation_id and status='pending' and provider='bank_transfer' returning id into found_id;
 if found_id is null then raise exception 'Pending bank-transfer donation not found';end if;
 return found_id;
end;$$;
revoke all on function public.confirm_bank_donation(uuid,text) from public,anon;
grant execute on function public.confirm_bank_donation(uuid,text) to authenticated;
drop policy roster_write on public.camp_staff_roster;
drop policy roster_edit on public.camp_staff_roster;
create policy roster_create on public.camp_staff_roster for insert to authenticated
 with check(public.has_workspace_role(array['admin']) or (public.has_workspace_role(array['camp_manager']) and payout_status<>'paid'));
create policy roster_modify on public.camp_staff_roster for update to authenticated
 using(public.has_workspace_role(array['admin','camp_manager']))
 with check(public.has_workspace_role(array['admin']) or (public.has_workspace_role(array['camp_manager']) and payout_status<>'paid'));
alter table public.camp_staff_roster add constraint paid_honorarium_evidence check(payout_status<>'paid' or (attendance_confirmed and coalesce(length(notes),0)>=4));
create function public.valid_pk_iban(input text) returns boolean language plpgsql immutable set search_path='' as $$
declare value text:=upper(regexp_replace(input,'\s','','g'));character text;remainder int:=0;number int;
begin
 if value is null or value !~ '^PK[0-9]{2}[A-Z]{4}[A-Z0-9]{16}$' then return false;end if;
 value=substr(value,5)||substr(value,1,4);
 for i in 1..length(value) loop
  character=substr(value,i,1);
  if character ~ '[A-Z]' then number=ascii(character)-55;remainder=(remainder*100+number)%97;
  else remainder=(remainder*10+character::int)%97;end if;
 end loop;
 return remainder=1;
end;$$;
alter table public.bank_routes add constraint bank_iban_checksum check(public.valid_pk_iban(iban));
alter table public.bank_routes add constraint active_bank_evidence check(not active or (verified_by is not null and verified_at is not null and coalesce(length(verification_reference),0)>=4));
create function public.stamp_verified_evidence() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_table_name='bank_routes' and coalesce((to_jsonb(new)->>'active')::boolean,false)) or (tg_table_name='institutional_documents' and to_jsonb(new)->>'status'='verified') then
  if not public.has_workspace_role(array['admin']) then raise exception 'FORBIDDEN';end if;
  new.verified_by=auth.uid();new.verified_at=now();
 end if;
 return new;
end;$$;
create trigger stamp_bank_evidence before insert or update on public.bank_routes for each row execute function public.stamp_verified_evidence();
create trigger stamp_institutional_evidence before insert or update on public.institutional_documents for each row execute function public.stamp_verified_evidence();
drop policy pharmacist_inventory_insert on public.camp_pharmacy_inventory;
create policy pharmacist_inventory_insert on public.camp_pharmacy_inventory for insert to authenticated
 with check(public.has_workspace_role(array['admin','camp_manager','pharmacist']) and confirmed_by=auth.uid());
create table public.community_activities (
 id uuid primary key default gen_random_uuid(),title text not null,
 kind text not null check(kind in ('HEAT_PREVENTION','DISASTER_RESPONSE','WATER_DISTRIBUTION','HEALTH_SCREENING','FOOD_SUPPORT','YOUTH_VOLUNTEERING')),
 held_on date not null,location text not null,beneficiaries int not null check(beneficiaries>=0),
 water_liters numeric(14,2) not null default 0 check(water_liters>=0),ors_units int not null default 0 check(ors_units>=0),
 volunteer_hours numeric(12,2) not null default 0 check(volunteer_hours>=0),evidence_reference text not null,
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
alter table public.community_activities enable row level security;
revoke all on public.community_activities from anon,authenticated;
grant select,insert on public.community_activities to authenticated;
create policy community_management_read on public.community_activities for select to authenticated using(public.has_workspace_role(array['admin','camp_manager']));
create policy community_management_insert on public.community_activities for insert to authenticated with check(public.has_workspace_role(array['admin','camp_manager']) and recorded_by=auth.uid());
create trigger audit_workspace after insert on public.community_activities for each row execute function public.record_workspace_audit();
