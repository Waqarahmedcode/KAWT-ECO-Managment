create table public.kawt_mc_import_batches (
 source_hash text primary key check(source_hash ~ '^[0-9a-f]{64}$'),
 source_label text not null check(length(btrim(source_label)) between 1 and 500),
 records_created int not null check(records_created between 1 and 100),
 imported_by uuid not null references public.profiles(id),
 imported_at timestamptz not null default now()
);
alter table public.kawt_mc_import_batches enable row level security;
revoke all on public.kawt_mc_import_batches from anon;
grant select,insert on public.kawt_mc_import_batches to authenticated;
revoke update,delete on public.kawt_mc_import_batches from authenticated;
create policy kawt_mc_batch_read on public.kawt_mc_import_batches for select to authenticated using(public.has_role(array['admin','camp_manager']::public.app_role[]));
create policy kawt_mc_batch_create on public.kawt_mc_import_batches for insert to authenticated with check(public.has_role(array['admin','camp_manager']::public.app_role[]) and imported_by=(select auth.uid()));
