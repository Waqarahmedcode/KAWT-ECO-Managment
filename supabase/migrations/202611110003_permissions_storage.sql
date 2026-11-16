-- Operational write permissions and private receipt storage.
grant insert,update on public.camps to authenticated;
create policy camp_create on public.camps for insert to authenticated
 with check(public.has_role(array['admin','camp_manager']::public.app_role[]) and status in ('planned','site_review'));
create policy camp_update on public.camps for update to authenticated
 using(public.has_role(array['admin','camp_manager']::public.app_role[]))
 with check(public.has_role(array['admin','camp_manager']::public.app_role[]));
grant insert on public.medicine_catalog to authenticated;
create policy create_medicine_catalog on public.medicine_catalog for insert to authenticated
 with check(public.has_role(array['admin','pharmacist']::public.app_role[]));
-- No ordinary staff member can edit a previously approved eligibility decision.
revoke update on public.patient_eligibility from authenticated;
-- Receipt delivery requires separate affirmative opt-in, not marketing consent.
alter table public.donors add column receipt_opt_in boolean not null default false;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('private-camp-receipts','private-camp-receipts',false,10485760,array['application/pdf','image/jpeg','image/png'])
 on conflict (id) do nothing;
create policy receipt_private_insert on storage.objects for insert to authenticated
 with check(bucket_id='private-camp-receipts' and public.has_role(array['admin']::public.app_role[]));
create policy receipt_private_select on storage.objects for select to authenticated
 using(bucket_id='private-camp-receipts' and public.has_role(array['admin','camp_manager']::public.app_role[]));
