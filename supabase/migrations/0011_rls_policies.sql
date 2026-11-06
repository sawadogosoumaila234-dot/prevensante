-- migration 0011 — politiques RLS table par table — <source: section 7.3>
-- profiles : soi, perimetre du site, ou administration
create policy profiles_select_scoped on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or (public.current_site_id() is not null and site_id = public.current_site_id())
  );
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin())
  with check (public.is_admin());
create policy profiles_insert_admin on public.profiles
  for insert to authenticated with check (public.is_admin());

-- organizations : lecture etendue, ecriture admin
create policy organizations_select_all on public.organizations
  for select to authenticated using (true);
create policy organizations_admin_write on public.organizations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- sites
create policy sites_select_scoped on public.sites
  for select to authenticated using (public.can_access_site(id));
create policy sites_write_manage on public.sites
  for all to authenticated
  using (public.can_manage_site(id) or public.is_admin())
  with check (public.can_manage_site(id) or public.is_admin());

-- zones
create policy zones_select_scoped on public.zones
  for select to authenticated using (public.can_access_site(site_id));
create policy zones_write_manage on public.zones
  for all to authenticated
  using (public.can_manage_site(site_id) or public.is_admin())
  with check (public.can_manage_site(site_id) or public.is_admin());

-- equipments
create policy equipments_select_scoped on public.equipments
  for select to authenticated using (public.can_access_site(site_id));
create policy equipments_write_manage on public.equipments
  for all to authenticated
  using (public.can_manage_site(site_id) or public.is_admin())
  with check (public.can_manage_site(site_id) or public.is_admin());

-- risk_categories : referentiel, ecriture HSE ou admin
create policy risk_categories_select_all on public.risk_categories
  for select to authenticated using (is_active or public.is_admin());
create policy risk_categories_write_manage on public.risk_categories
  for all to authenticated
  using (public.is_hse() or public.is_admin())
  with check (public.is_hse() or public.is_admin());

-- safety_events : le salarie voit ses signalements, le HSE voit le site
create policy safety_events_select_scoped on public.safety_events
  for select to authenticated using (
    reporter_id = auth.uid()
    or public.can_access_site(site_id)
  );
create policy safety_events_insert_reporter on public.safety_events
  for insert to authenticated with check (
    reporter_id = auth.uid()
    and public.can_access_site(site_id)
    and status = 'submitted'
  );
create policy safety_events_update_manage on public.safety_events
  for update to authenticated
  using (public.can_manage_site(site_id) or public.is_admin())
  with check (public.can_manage_site(site_id) or public.is_admin());

-- journal : lecture heritee du perimetre, ecriture reservee aux triggers (defense en profondeur)
create policy safety_event_logs_select_scoped on public.safety_event_logs
  for select to authenticated using (
    exists (
      select 1 from public.safety_events e
      where e.id = event_id
        and (e.reporter_id = auth.uid() or public.can_access_site(e.site_id))
    )
  );
create policy safety_event_logs_no_direct_write on public.safety_event_logs
  for insert to authenticated with check (false);

-- corrective_actions
create policy corrective_actions_select_scoped on public.corrective_actions
  for select to authenticated using (
    owner_id = auth.uid()
    or public.can_access_site((select site_id from public.safety_events where id = event_id))
  );
create policy corrective_actions_update_owner on public.corrective_actions
  for update to authenticated
  using (public.is_action_owner(id) or public.can_manage_site(
           (select site_id from public.safety_events where id = event_id)))
  with check (public.is_action_owner(id) or public.can_manage_site(
           (select site_id from public.safety_events where id = event_id)));
create policy corrective_actions_insert_manage on public.corrective_actions
  for insert to authenticated with check (public.can_manage_site(
    (select site_id from public.safety_events where id = event_id)) or public.is_admin());

-- escalations
create policy escalations_select_scoped on public.escalations
  for select to authenticated using (
    notified_user_id = auth.uid()
    or public.can_access_site((select site_id from public.safety_events where id = event_id))
  );
create policy escalations_write_manage on public.escalations
  for all to authenticated
  using (public.can_manage_site((select site_id from public.safety_events where id = event_id))
         or public.is_admin())
  with check (public.can_manage_site((select site_id from public.safety_events where id = event_id))
         or public.is_admin());

-- safety_documents : seuls les documents valides sont lisibles par les salaries
create policy safety_documents_select_validated on public.safety_documents
  for select to authenticated using (
    status = 'validated' or public.is_hse() or public.is_admin()
  );
create policy safety_documents_write_manage on public.safety_documents
  for all to authenticated
  using (public.is_hse() or public.is_admin())
  with check (public.is_hse() or public.is_admin());

-- document_versions
create policy document_versions_select_scoped on public.document_versions
  for select to authenticated using (
    exists (
      select 1 from public.safety_documents d
      where d.id = document_id
        and (d.status = 'validated' or public.is_hse() or public.is_admin())
    )
  );
create policy document_versions_write_manage on public.document_versions
  for all to authenticated
  using (public.is_hse() or public.is_admin())
  with check (public.is_hse() or public.is_admin());

-- ai_proposals : consultation et validation par le HSE, lecture par les concerns
create policy ai_proposals_select_scoped on public.ai_proposals
  for select to authenticated using (
    asked_by = auth.uid()
    or public.can_access_site((select site_id from public.safety_events where id = event_id))
    or public.is_admin()
  );
create policy ai_proposals_insert_asker on public.ai_proposals
  for insert to authenticated with check (asked_by = auth.uid());
create policy ai_proposals_update_reviewer on public.ai_proposals
  for update to authenticated
  using (public.can_manage_site((select site_id from public.safety_events where id = event_id))
         or public.is_admin())
  with check (public.can_manage_site((select site_id from public.safety_events where id = event_id))
         or public.is_admin());

-- medical_records : isole, jamais visible par les roles de securite non habilites
create policy medical_records_select_authorized on public.medical_records
  for select to authenticated using (public.can_view_medical(event_id));
create policy medical_records_write_physician on public.medical_records
  for all to authenticated
  using (public.can_view_medical(event_id) and public.current_role() = 'occupational_physician')
  with check (public.can_view_medical(event_id) and public.current_role() = 'occupational_physician');

-- site_worked_hours
create policy site_worked_hours_select_scoped on public.site_worked_hours
  for select to authenticated using (public.can_access_site(site_id));
create policy site_worked_hours_write_manage on public.site_worked_hours
  for all to authenticated
  using (public.can_manage_site(site_id) or public.is_admin())
  with check (public.can_manage_site(site_id) or public.is_admin());

-- notifications : prive
create policy notifications_own_select on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy notifications_own_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- outbox et audit : administrateur uniquement
create policy email_outbox_admin_select on public.email_outbox
  for select to authenticated using (public.is_admin());
create policy sms_outbox_admin_select on public.sms_outbox
  for select to authenticated using (public.is_admin());
create policy audit_log_select_scoped on public.audit_log
  for select to authenticated using (
    public.is_admin()
    or (public.current_site_id() is not null
        and entity_type = 'safety_events'
        and exists (select 1 from public.safety_events e
                    where e.id = entity_id and public.can_access_site(e.site_id)))
  );

-- parametres applicatifs
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);
create policy app_settings_admin_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
