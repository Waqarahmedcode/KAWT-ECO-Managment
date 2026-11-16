create table public.donation_certificates (
 id uuid primary key default gen_random_uuid(),donation_id uuid not null unique references public.donations(id),
 authorized_name text not null,authorized_title text not null,issued_by uuid not null references public.profiles(id),
 issued_at timestamptz not null default now(),document_references jsonb not null,
 statement text not null,check(length(trim(statement)) between 12 and 240)
);
alter table public.donation_certificates enable row level security;
revoke all on public.donation_certificates from public,anon,authenticated;
grant select on public.donation_certificates to authenticated;
create policy certificate_read on public.donation_certificates for select to authenticated using(
 public.has_workspace_role(array['admin']) or exists(select 1 from public.donations n join public.donors d on d.id=n.donor_id where n.id=donation_id and d.auth_user_id=auth.uid())
);
create function public.issue_donation_certificate(target uuid,signatory text,signatory_title text,approved_statement text) returns uuid
language plpgsql security definer set search_path='' as $$
declare document_kind text;document_id uuid;document_snapshot jsonb;references_json jsonb:='{}';result uuid;
begin
 if not public.has_workspace_role(array['admin']) then raise exception 'FORBIDDEN';end if;
 if length(trim(signatory))<2 or length(trim(signatory_title))<2 or length(trim(approved_statement))<12 then raise exception 'Authorized signatory, position and eligibility statement required';end if;
 if not exists(select 1 from public.donations where id=target and status='confirmed' and refunded_minor_units=0) then raise exception 'An unrefunded confirmed contribution is required';end if;
 foreach document_kind in array array['FBR','PCP','SHCC','ISO'] loop
  select id,jsonb_build_object('id',id,'title',title,'source_reference',source_reference,'verified_at',verified_at,'valid_until',valid_until,'verified_by',verified_by) into document_id,document_snapshot from public.institutional_documents where upper(kind)=document_kind and status='verified' and verified_by is not null and verified_at is not null and valid_until>=current_date order by valid_until desc limit 1;
  if document_id is null then raise exception 'Current verified % evidence is required',document_kind;end if;
  references_json=references_json||jsonb_build_object(document_kind,document_snapshot);
 end loop;
 insert into public.donation_certificates(donation_id,authorized_name,authorized_title,issued_by,document_references,statement)
 values(target,signatory,signatory_title,auth.uid(),references_json,approved_statement) returning id into result;
 return result;
end;$$;
revoke all on function public.issue_donation_certificate(uuid,text,text,text) from public,anon;
grant execute on function public.issue_donation_certificate(uuid,text,text,text) to authenticated;
create trigger audit_certificate after insert on public.donation_certificates for each row execute function public.record_workspace_audit();
