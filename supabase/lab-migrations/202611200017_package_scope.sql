-- Partner lab entry accounts cannot read the main centre's package pricing.
drop policy kawt_mc_package_read on public.kawt_mc_packages;
create policy kawt_mc_package_read on public.kawt_mc_packages for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]) or public.kawt_lab_scope_allowed(false,'Khidmat-e-Alam Diagnostic Centre'));
drop policy kawt_mc_price_read on public.kawt_mc_prices;
create policy kawt_mc_price_read on public.kawt_mc_prices for select to authenticated using((doctor_id is not null and public.has_role(array['admin','camp_manager','doctor']::public.app_role[])) or (package_id is not null and (public.has_role(array['admin','camp_manager']::public.app_role[]) or public.kawt_lab_scope_allowed(false,'Khidmat-e-Alam Diagnostic Centre'))));
