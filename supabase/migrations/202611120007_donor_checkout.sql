alter table public.donations add column checkout_url text;
alter table public.donations add column attribution jsonb not null default '{}'::jsonb;
alter table public.camps add column target_patients int check(target_patients>0);
alter table public.camps add column proposed_budget_paisa bigint check(proposed_budget_paisa>=0);
alter table public.camps add column planned_period text;
-- Persist publishable, explicitly approved report links in an integration job.
create index if not exists outbox_pending on public.integration_outbox(status,created_at);
create index if not exists campaign_donations on public.donations(campaign_id,status,currency);
