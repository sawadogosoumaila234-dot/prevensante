-- migration 0014 — fonctions RPC publiques — <source: section 8.2>
create or replace function public.submit_safety_event(
  p_kind public.event_kind,
  p_site_id uuid,
  p_zone_id uuid,
  p_equipment_id uuid,
  p_occurred_at timestamptz,
  p_description text,
  p_activity text,
  p_immediate_measures text,
  p_photo_paths text[] default '{}',
  p_is_anonymous boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.safety_events%rowtype;
begin
  if not public.can_access_site(p_site_id) then
    raise exception 'You are not allowed to report on this site' using errcode = '42501';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'A description is required' using errcode = '23514';
  end if;

  insert into public.safety_events (
    kind, site_id, zone_id, equipment_id, occurred_at, description,
    activity, immediate_measures, photo_paths, reporter_id, is_anonymous)
  values (
    p_kind, p_site_id, p_zone_id, p_equipment_id, p_occurred_at, p_description,
    p_activity, p_immediate_measures, coalesce(p_photo_paths, '{}'), auth.uid(),
    p_is_anonymous)
  returning * into v_event;

  return jsonb_build_object(
    'id', v_event.id,
    'reference', v_event.reference,
    'status', v_event.status,
    'severity', v_event.severity);
end $$;

create or replace function public.triage_safety_event(
  p_event_id uuid,
  p_risk_category_id uuid,
  p_severity public.severity_level,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_site uuid;
begin
  select site_id into v_site from public.safety_events where id = p_event_id;
  if not public.can_manage_site(v_site) then
    raise exception 'You are not allowed to triage this event' using errcode = '42501';
  end if;

  update public.safety_events
     set risk_category_id = p_risk_category_id,
         severity = p_severity,
         status = 'triaged',
         triaged_by = auth.uid(),
         triaged_at = now(),
         acknowledged_at = now()
   where id = p_event_id;

  return jsonb_build_object('id', p_event_id, 'status', 'triaged');
end $$;

create or replace function public.assign_corrective_action(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_owner_id uuid,
  p_due_at timestamptz,
  p_severity public.severity_level
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_site uuid;
  v_action public.corrective_actions%rowtype;
begin
  select site_id into v_site from public.safety_events where id = p_event_id;
  if not public.can_manage_site(v_site) then
    raise exception 'You are not allowed to create an action on this event' using errcode = '42501';
  end if;
  if p_owner_id is null or p_due_at is null then
    raise exception 'An action requires an owner and a due date' using errcode = '23514';
  end if;

  insert into public.corrective_actions (
    event_id, title, description, owner_id, due_at, severity, created_by)
  values (
    p_event_id, p_title, p_description, p_owner_id, p_due_at,
    coalesce(p_severity, 'medium'), auth.uid())
  returning * into v_action;

  return jsonb_build_object('id', v_action.id, 'reference', v_action.reference);
end $$;

create or replace function public.submit_action_for_verification(
  p_action_id uuid,
  p_evidence_path text,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not (public.is_action_owner(p_action_id)
          or public.can_manage_site((select site_id from public.safety_events
                                     where id = (select event_id from public.corrective_actions
                                                 where id = p_action_id)))) then
    raise exception 'You are not allowed to submit this action' using errcode = '42501';
  end if;
  if p_evidence_path is null or btrim(p_evidence_path) = '' then
    raise exception 'Closure proof is required to submit an action for verification'
      using errcode = '23514';
  end if;

  update public.corrective_actions
     set status = 'to_verify',
         submitted_for_verification_at = now(),
         closure_evidence_path = p_evidence_path,
         closure_note = p_note
   where id = p_action_id;

  return jsonb_build_object('id', p_action_id, 'status', 'to_verify');
end $$;

create or replace function public.verify_and_close_action(
  p_action_id uuid,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_verify_action(p_action_id) then
    raise exception 'You are not allowed to verify this action' using errcode = '42501';
  end if;

  update public.corrective_actions
     set status = 'closed',
         verified_by = auth.uid(),
         verified_at = now(),
         closed_at = now(),
         closed_by = auth.uid()
   where id = p_action_id;

  return jsonb_build_object('id', p_action_id, 'status', 'closed');
end $$;

create or replace function public.apply_ai_proposal(
  p_proposal_id uuid,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_proposal public.ai_proposals%rowtype;
  v_event uuid;
  v_site uuid;
begin
  select * into v_proposal from public.ai_proposals where id = p_proposal_id;
  if v_proposal.id is null then
    raise exception 'Proposal not found' using errcode = 'P0002';
  end if;
  if v_proposal.status <> 'accepted' or v_proposal.reviewed_by is null then
    raise exception 'An AI proposal must be reviewed and accepted before it is applied'
      using errcode = '23514';
  end if;

  v_event := v_proposal.event_id;
  select site_id into v_site from public.safety_events where id = v_event;
  if not public.can_manage_site(v_site) then
    raise exception 'You are not allowed to apply a proposal on this event' using errcode = '42501';
  end if;

  if v_proposal.proposal_type = 'classification' then
    update public.safety_events
       set risk_category_id = v_proposal.suggested_category_id,
           severity = coalesce(v_proposal.suggested_severity, severity)
     where id = v_event;
  end if;

  update public.ai_proposals
     set applied_at = now(), review_note = p_note
   where id = p_proposal_id;

  return jsonb_build_object('id', p_proposal_id, 'applied', true);
end $$;
