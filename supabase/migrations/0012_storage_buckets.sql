-- migration 0012 — buckets Storage et policies associees — <source: section 9>
insert into storage.buckets (id, name, public) values
  ('event-photos',    'event-photos',    false),
  ('action-evidence', 'action-evidence', false),
  ('safety-documents','safety-documents',false),
  ('medical-evidence','medical-evidence',false)
on conflict (id) do nothing;

create policy event_photos_read_scoped on storage.objects
  for select to authenticated using (
    bucket_id = 'event-photos' and exists (
      select 1 from public.safety_events e
      where e.photo_paths @> array[name]
        and (e.reporter_id = auth.uid() or public.can_access_site(e.site_id))
    )
  );

create policy event_photos_write_reporter on storage.objects
  for insert to authenticated with check (
    bucket_id = 'event-photos'
    and (public.current_site_id() is not null or public.is_admin())
  );

create policy action_evidence_read_scoped on storage.objects
  for select to authenticated using (
    bucket_id = 'action-evidence' and exists (
      select 1 from public.corrective_actions a
      where a.closure_evidence_path = name
        and (a.owner_id = auth.uid() or public.can_access_site(
              (select site_id from public.safety_events where id = a.event_id)))
    )
  );

create policy action_evidence_write_owner on storage.objects
  for insert to authenticated with check (
    bucket_id = 'action-evidence' and (
      public.current_role() in ('action_owner','maintenance_lead','hse_officer')
    )
  );

create policy safety_documents_read_validated on storage.objects
  for select to authenticated using (
    bucket_id = 'safety-documents' and (
      public.is_hse() or public.is_admin()
      or exists (
        select 1 from public.safety_documents d
        where d.file_path = name and d.status = 'validated'
      )
    )
  );

create policy safety_documents_write_hse on storage.objects
  for all to authenticated
  using (bucket_id = 'safety-documents' and (public.is_hse() or public.is_admin()))
  with check (bucket_id = 'safety-documents' and (public.is_hse() or public.is_admin()));

create policy medical_evidence_read_physician on storage.objects
  for select to authenticated using (
    bucket_id = 'medical-evidence' and public.can_view_medical(
      (select id from public.safety_events where id::text = (storage.foldername(name))[1])
    )
  );

create policy medical_evidence_write_physician on storage.objects
  for insert to authenticated with check (
    bucket_id = 'medical-evidence' and public.current_role() = 'occupational_physician'
  );
