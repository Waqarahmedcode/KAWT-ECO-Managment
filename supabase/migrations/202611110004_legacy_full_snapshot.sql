-- Preserve every field of the original six imported records, even fields not otherwise normalized.
alter table public.historical_camp_statistics add column if not exists source_snapshot jsonb;
alter table public.camps add column if not exists time_window text;
