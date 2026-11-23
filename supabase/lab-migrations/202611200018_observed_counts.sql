-- An explicit zero is an observation. A completely blank form is not a report.
alter table public.kawt_lab_reports add constraint kawt_lab_report_has_observation check(
 jsonb_path_exists(payload,'$.tests[*] ? (@.morning.type() == "number" || @.evening.type() == "number" || @.night.type() == "number")')
 or jsonb_path_exists(payload,'$.patients.* ? (@.type() == "number")')
 or jsonb_path_exists(payload,'$.outsource.* ? (@.type() == "number")')
 or jsonb_path_exists(payload,'$.urgent.*.* ? (@.type() == "number")')
);
