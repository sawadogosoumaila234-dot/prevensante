-- migration 0013 — triggers metier — <source: section 8.1>
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_sites_updated before update on public.sites
  for each row execute function public.set_updated_at();
create trigger trg_zones_updated before update on public.zones
  for each row execute function public.set_updated_at();
create trigger trg_equipments_updated before update on public.equipments
  for each row execute function public.set_updated_at();
create trigger trg_risk_categories_updated before update on public.risk_categories
  for each row execute function public.set_updated_at();
create trigger trg_safety_events_updated before update on public.safety_events
  for each row execute function public.set_updated_at();
create trigger trg_corrective_actions_updated before update on public.corrective_actions
  for each row execute function public.set_updated_at();
create trigger trg_safety_documents_updated before update on public.safety_documents
  for each row execute function public.set_updated_at();
create trigger trg_site_worked_hours_updated before update on public.site_worked_hours
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',
                   split_part(coalesce(new.email, ''), '@', 1)),
          new.email,
          'worker')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id,
                                before_data, after_data)
  values (auth.uid(), public.current_role(),
          lower(tg_op), tg_table_name,
          coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger trg_audit_safety_events after insert or update or delete on public.safety_events
  for each row execute function public.audit_row_change();
create trigger trg_audit_corrective_actions after insert or update or delete on public.corrective_actions
  for each row execute function public.audit_row_change();
create trigger trg_audit_ai_proposals after insert or update or delete on public.ai_proposals
  for each row execute function public.audit_row_change();
create trigger trg_audit_safety_documents after insert or update or delete on public.safety_documents
  for each row execute function public.audit_row_change();

create or replace function public.safety_events_reference_gen()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'PES-' || to_char(now(), 'YYYY')
                    || '-' || lpad(nextval('public.event_ref_seq')::text, 5, '0');
  end if;
  return new;
end $$;
create trigger trg_safety_events_reference before insert on public.safety_events
  for each row execute function public.safety_events_reference_gen();

create or replace function public.action_reference_gen()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'ACT-' || to_char(now(), 'YYYY')
                    || '-' || lpad(nextval('public.action_ref_seq')::text, 5, '0');
  end if;
  return new;
end $$;
create trigger trg_corrective_actions_reference before insert on public.corrective_actions
  for each row execute function public.action_reference_gen();

create or replace function public.guard_event_transition()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'closed' and (new.closed_by is null or new.closed_at is null
                                or new.closure_note is null or btrim(new.closure_note) = '') then
    raise exception 'Closing an event requires a closer, a date and a closure note'
      using errcode = '23514';
  end if;
  if new.status = 'rejected' and (new.closure_note is null or btrim(new.closure_note) = '') then
    raise exception 'Rejecting an event requires a reason'
      using errcode = '23514';
  end if;
  if old.severity = 'critical' and new.severity <> 'critical'
     and public.current_role() not in ('hse_officer','site_director','admin') then
    raise exception 'Only an HSE officer can lower the severity of a critical event'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_safety_events_guard before update on public.safety_events
  for each row execute function public.guard_event_transition();

create or replace function public.guard_anonymous_report()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.is_anonymous and new.is_anonymous = false and public.current_role() <> 'admin' then
    raise exception 'Only an administrator can remove the anonymous flag of a report'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_safety_events_anonymous before update on public.safety_events
  for each row execute function public.guard_anonymous_report();

create or replace function public.guard_action_transition()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'to_verify' and new.submitted_for_verification_at is null then
    raise exception 'Moving an action to "to_verify" requires a submission date'
      using errcode = '23514';
  end if;
  if new.status = 'closed' and (
        new.closed_at is null or new.closed_by is null
        or new.closure_evidence_path is null or new.closure_note is null
        or new.verified_by is null or new.verified_at is null) then
    raise exception 'Closing an action requires closure proof and a verification record'
      using errcode = '23514';
  end if;
  if new.status = 'closed' and new.verified_by is not null and new.verified_by = new.owner_id then
    raise exception 'An action cannot be verified by its own owner'
      using errcode = '23514';
  end if;
  if new.status = 'closed' and old.status <> 'to_verify' then
    raise exception 'An action must pass through the "to_verify" status before closing'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_corrective_actions_guard before update on public.corrective_actions
  for each row execute function public.guard_action_transition();

create or replace function public.ai_proposal_review_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.applied_at is not null and old.applied_at is null then
    if new.reviewed_by is null or new.status <> 'accepted' then
      raise exception 'An AI proposal can only be applied after a human validation'
        using errcode = '23514';
    end if;
  end if;
  if new.status <> 'pending_review' and new.reviewed_by is null then
    raise exception 'Reviewing an AI proposal requires a reviewer'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_ai_proposals_guard before update on public.ai_proposals
  for each row execute function public.ai_proposal_review_guard();

create or replace function public.document_version_bump()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.current_version <> old.current_version then
    if new.validated_by is null or new.validated_at is null then
      raise exception 'A new document version requires a validator and a validation date'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger trg_safety_documents_version before update on public.safety_documents
  for each row execute function public.document_version_bump();

create or replace function public.medical_record_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = coalesce(new.recorded_by, auth.uid())
      and p.is_active
      and (p.role = 'occupational_physician' or p.is_medical_authorized)
  ) then
    raise exception 'Medical records can only be recorded by an authorized medical profile'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_medical_records_guard before insert on public.medical_records
  for each row execute function public.medical_record_guard();

create or replace function public.escalate_critical_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.severity = 'critical' and new.kind in ('danger','accident') then
    insert into public.escalations (event_id, level, reason, triggered_by,
                                    notified_role, channel)
    values (new.id, 'hse_officer',
            'Critical severity reported on ' || new.reference,
            auth.uid(), 'hse_officer', 'in_app');
    -- correction : dans un trigger AFTER, la modification de NEW est ignoree ;
    -- le passage en 'escalated' se fait donc par un UPDATE explicite.
    update public.safety_events set status = 'escalated' where id = new.id;
  end if;
  return new;
end $$;
create trigger trg_safety_events_escalate after insert on public.safety_events
  for each row execute function public.escalate_critical_event();

create or replace function public.safety_events_log_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_action public.log_action;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif new.status is distinct from old.status then
    v_action := 'status_changed';
  else
    v_action := 'updated';
  end if;
  insert into public.safety_event_logs (event_id, actor_id, actor_role, action, note)
  values (new.id, auth.uid(), public.current_role(), v_action,
          case when tg_op = 'INSERT' then 'Event registered' else null end);
  return new;
end $$;
create trigger trg_safety_events_log after insert or update on public.safety_events
  for each row execute function public.safety_events_log_changes();

create or replace function public.ai_proposal_log()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.safety_event_logs (event_id, actor_id, actor_role, action, note)
    values (new.event_id, auth.uid(), public.current_role(),
            case when new.status = 'accepted' then 'validated'
                 when new.status = 'rejected' then 'rejected'
                 else 'proposed' end,
            'AI proposal ' || new.status);
  end if;
  return new;
end $$;
create trigger trg_ai_proposals_log after update on public.ai_proposals
  for each row execute function public.ai_proposal_log();

create or replace function public.outbox_notify()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (user_id, event_id, kind, title, body, severity, data)
  select e.triaged_by, e.id, 'event_updated',
         'Safety event ' || e.reference || ' was updated',
         'Status changed to ' || e.status::text || '.', 'info',
         jsonb_build_object('event_id', e.id, 'action', 'open_event')
  from public.safety_events e
  where e.id = new.event_id and e.triaged_by is not null
    and not exists (
      select 1 from public.notifications n
      where n.event_id = e.id and n.kind = 'event_updated' and n.read_at is null
    );
  return new;
end $$;
create trigger trg_outbox_notify after insert on public.safety_event_logs
  for each row execute function public.outbox_notify();
