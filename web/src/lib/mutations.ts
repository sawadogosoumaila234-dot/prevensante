/**
 * Mutations applicatives (ecritures).
 *
 * En mode demonstration, les mutations s'appliquent sur l'etat en memoire
 * `demoState` ; avec Supabase, elles appellent les RPC / tables du schema
 * `public`. La forme des donnees est identique dans les deux cas.
 */

import { supabase } from './supabase/client';
import { demoState } from '../data/demo';
import type {
  AiProposal,
  AppRole,
  CorrectiveAction,
  EscalationLevel,
  SafetyEvent,
  SafetyEventLog,
} from '../data/types';

export interface NewEventInput {
  kind: 'danger' | 'incident' | 'accident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  site_id: string;
  zone_id: string | null;
  equipment_id: string | null;
  risk_category_id: string | null;
  occurred_at: string;
  activity: string;
  description: string;
  immediate_measures: string;
  reported_consequences: string;
  work_stoppage: boolean;
  injury_reported: boolean;
  is_anonymous: boolean;
  photo_paths: string[];
  reporter_id: string | null;
}

let sequence = 100;

function nextReference(prefix: string): string {
  sequence += 1;
  return `${prefix}-2026-${String(sequence).padStart(5, '0')}`;
}

/** Cree un evenement de securite et renvoie sa reference. */
export async function createSafetyEvent(input: NewEventInput): Promise<SafetyEvent> {
  if (supabase) {
    const { data, error } = await supabase
      .from('safety_events')
      .insert({
        kind: input.kind,
        severity: input.severity,
        status: 'submitted',
        site_id: input.site_id,
        zone_id: input.zone_id,
        equipment_id: input.equipment_id,
        risk_category_id: input.risk_category_id,
        occurred_at: input.occurred_at,
        reported_at: new Date().toISOString(),
        activity: input.activity,
        description: input.description,
        immediate_measures: input.immediate_measures,
        reported_consequences: input.reported_consequences,
        work_stoppage: input.work_stoppage,
        injury_reported: input.injury_reported,
        is_anonymous: input.is_anonymous,
        photo_paths: input.photo_paths,
        reporter_id: input.reporter_id,
      })
      .select(
        'id, reference, kind, status, severity, site_id, zone_id, equipment_id, risk_category_id, occurred_at, reported_at, activity, description, immediate_measures, reported_consequences, work_stoppage, injury_reported, photo_paths, reporter_id, is_anonymous, triaged_by, triaged_at, acknowledged_at, closed_by, closed_at, closure_note, created_at, updated_at',
      )
      .single();
    if (error) throw error;
    return data as SafetyEvent;
  }

  const now = new Date().toISOString();
  const event: SafetyEvent = {
    id: `evt-${Date.now()}`,
    reference: nextReference('PES'),
    kind: input.kind,
    status: 'submitted',
    severity: input.severity,
    site_id: input.site_id,
    zone_id: input.zone_id,
    equipment_id: input.equipment_id,
    risk_category_id: input.risk_category_id,
    occurred_at: input.occurred_at,
    reported_at: now,
    activity: input.activity,
    description: input.description,
    immediate_measures: input.immediate_measures,
    reported_consequences: input.reported_consequences,
    work_stoppage: input.work_stoppage,
    injury_reported: input.injury_reported,
    is_anonymous: input.is_anonymous,
    photo_paths: input.photo_paths,
    reporter_id: input.reporter_id,
    triaged_by: null,
    triaged_at: null,
    acknowledged_at: null,
    closed_by: null,
    closed_at: null,
    closure_note: null,
    created_at: now,
    updated_at: now,
  };
  demoState.events.unshift(event);
  demoState.logs.push({
    id: `log-${Date.now()}`,
    event_id: event.id,
    actor_id: input.reporter_id,
    actor_role: 'worker',
    action: 'created',
    field_name: null,
    old_value: null,
    new_value: null,
    note: 'Report submitted from the mobile application.',
    payload: { kind: input.kind, severity: input.severity },
    created_at: now,
  });
  return event;
}

/** Enregistre le triage d'un evenement. */
export async function triageSafetyEvent(input: {
  event_id: string;
  risk_category_id: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  zone_id: string | null;
  equipment_id: string | null;
  triaged_by: string;
  note: string;
}): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('safety_events')
      .update({
        risk_category_id: input.risk_category_id,
        severity: input.severity,
        zone_id: input.zone_id,
        equipment_id: input.equipment_id,
        status: 'triaged',
        triaged_by: input.triaged_by,
        triaged_at: new Date().toISOString(),
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', input.event_id);
    if (error) throw error;
    return;
  }
  const event = demoState.events.find((e) => e.id === input.event_id);
  if (!event) throw new Error('Event not found.');
  const now = new Date().toISOString();
  event.risk_category_id = input.risk_category_id;
  event.severity = input.severity;
  event.zone_id = input.zone_id;
  event.equipment_id = input.equipment_id;
  event.status = 'triaged';
  event.triaged_by = input.triaged_by;
  event.triaged_at = now;
  event.acknowledged_at = now;
  event.updated_at = now;
  demoState.logs.push({
    id: `log-${Date.now()}`,
    event_id: event.id,
    actor_id: input.triaged_by,
    actor_role: 'hse_officer',
    action: 'status_changed',
    field_name: 'status',
    old_value: 'under_review',
    new_value: 'triaged',
    note: input.note,
    payload: {},
    created_at: now,
  });
}

/** Change la severite d'un evenement (evenement detail). */
export async function changeEventSeverity(
  eventId: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  actorId: string,
  note: string,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('safety_events')
      .update({ severity })
      .eq('id', eventId);
    if (error) throw error;
    return;
  }
  const event = demoState.events.find((e) => e.id === eventId);
  if (!event) throw new Error('Event not found.');
  const old = event.severity;
  event.severity = severity;
  event.updated_at = new Date().toISOString();
  demoState.logs.push({
    id: `log-${Date.now()}`,
    event_id: eventId,
    actor_id: actorId,
    actor_role: 'hse_officer',
    action: 'updated',
    field_name: 'severity',
    old_value: old,
    new_value: severity,
    note,
    payload: {},
    created_at: new Date().toISOString(),
  });
}

/** Ferme un evenement : un motif et le nom du verificateur sont exiges. */
export async function closeSafetyEvent(
  eventId: string,
  closureNote: string,
  verifierName: string,
  actorId: string,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('safety_events')
      .update({
        status: 'closed',
        closed_by: actorId,
        closed_at: new Date().toISOString(),
        closure_note: `${closureNote} — verified by ${verifierName}`,
      })
      .eq('id', eventId);
    if (error) throw error;
    return;
  }
  const event = demoState.events.find((e) => e.id === eventId);
  if (!event) throw new Error('Event not found.');
  const now = new Date().toISOString();
  event.status = 'closed';
  event.closed_by = actorId;
  event.closed_at = now;
  event.closure_note = `${closureNote} — verified by ${verifierName}`;
  event.updated_at = now;
  demoState.logs.push({
    id: `log-${Date.now()}`,
    event_id: eventId,
    actor_id: actorId,
    actor_role: 'hse_officer',
    action: 'closed',
    field_name: 'status',
    old_value: 'awaiting_verification',
    new_value: 'closed',
    note: event.closure_note,
    payload: {},
    created_at: now,
  });
}

/** Ajoute un commentaire a un evenement (journal append-only). */
export async function addEventComment(
  eventId: string,
  actorId: string,
  actorRole: AppRole,
  note: string,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('safety_event_logs')
      .insert({
        event_id: eventId,
        actor_id: actorId,
        actor_role: actorRole,
        action: 'commented',
        note,
      });
    if (error) throw error;
    return;
  }
  demoState.logs.push({
    id: `log-${Date.now()}`,
    event_id: eventId,
    actor_id: actorId,
    actor_role: actorRole,
    action: 'commented',
    field_name: null,
    old_value: null,
    new_value: null,
    note,
    payload: {},
    created_at: new Date().toISOString(),
  });
}

/** Escalade un evenement vers le niveau superieur. */
export async function escalateSafetyEvent(
  eventId: string,
  level: EscalationLevel,
  reason: string,
  actorId: string,
  notifiedUserId: string | null,
  notifiedRole: AppRole,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('safety_events')
      .update({ status: 'escalated' })
      .eq('id', eventId);
    if (error) throw error;
    return;
  }
  const event = demoState.events.find((e) => e.id === eventId);
  if (!event) throw new Error('Event not found.');
  const now = new Date().toISOString();
  event.status = 'escalated';
  event.updated_at = now;
  demoState.escalations.unshift({
    id: `esc-${Date.now()}`,
    event_id: eventId,
    level,
    reason,
    triggered_by: actorId,
    notified_role: notifiedRole,
    notified_user_id: notifiedUserId,
    acknowledged_by: null,
    acknowledged_at: null,
    channel: 'in_app',
    created_at: now,
  });
  demoState.logs.push({
    id: `log-${Date.now()}`,
    event_id: eventId,
    actor_id: actorId,
    actor_role: 'hse_officer',
    action: 'escalated',
    field_name: 'severity',
    old_value: event.severity,
    new_value: event.severity,
    note: reason,
    payload: { level },
    created_at: now,
  });
}

/** Cree une action corrective rattachee a un evenement. */
export async function createCorrectiveAction(input: {
  event_id: string;
  title: string;
  description: string;
  owner_id: string;
  owner_role: AppRole;
  severity: 'low' | 'medium' | 'high' | 'critical';
  due_at: string;
  created_by: string;
}): Promise<CorrectiveAction> {
  if (supabase) {
    const { data, error } = await supabase
      .from('corrective_actions')
      .insert({
        event_id: input.event_id,
        title: input.title,
        description: input.description,
        owner_id: input.owner_id,
        owner_role: input.owner_role,
        severity: input.severity,
        due_at: input.due_at,
        status: 'to_do',
        created_by: input.created_by,
      })
      .select(
        'id, reference, event_id, title, description, owner_id, owner_role, status, severity, due_at, started_at, submitted_for_verification_at, closed_at, closed_by, closure_evidence_path, closure_note, verified_by, verified_at, reopen_count, created_by, created_at, updated_at',
      )
      .single();
    if (error) throw error;
    return data as CorrectiveAction;
  }
  const now = new Date().toISOString();
  const action: CorrectiveAction = {
    id: `act-${Date.now()}`,
    reference: nextReference('ACT'),
    event_id: input.event_id,
    title: input.title,
    description: input.description,
    owner_id: input.owner_id,
    owner_role: input.owner_role,
    status: 'to_do',
    severity: input.severity,
    due_at: input.due_at,
    started_at: null,
    submitted_for_verification_at: null,
    closed_at: null,
    closed_by: null,
    closure_evidence_path: null,
    closure_note: null,
    verified_by: null,
    verified_at: null,
    reopen_count: 0,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
  };
  demoState.actions.unshift(action);
  return action;
}

/** Demarre le traitement d'une action. */
export async function startAction(actionId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('corrective_actions')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', actionId);
    if (error) throw error;
    return;
  }
  const action = demoState.actions.find((a) => a.id === actionId);
  if (!action) throw new Error('Action not found.');
  action.status = 'in_progress';
  action.started_at = new Date().toISOString();
  action.updated_at = new Date().toISOString();
}

/**
 * Soumet une action pour verification. La preuve de cloture est obligatoire
 * (CR04) : le serveur la refuse aussi.
 */
export async function submitActionForVerification(
  actionId: string,
  evidencePath: string,
  note: string,
): Promise<void> {
  if (!evidencePath) throw new Error('Closure proof is required before verification.');
  if (supabase) {
    const { error } = await supabase
      .from('corrective_actions')
      .update({
        status: 'to_verify',
        submitted_for_verification_at: new Date().toISOString(),
        closure_evidence_path: evidencePath,
        closure_note: note,
      })
      .eq('id', actionId);
    if (error) throw error;
    return;
  }
  const action = demoState.actions.find((a) => a.id === actionId);
  if (!action) throw new Error('Action not found.');
  action.status = 'to_verify';
  action.submitted_for_verification_at = new Date().toISOString();
  action.closure_evidence_path = evidencePath;
  action.closure_note = note;
  action.updated_at = new Date().toISOString();
}

/** Verifie et cloture une action (le verificateur ne peut pas etre l'actionnaire). */
export async function verifyAndCloseAction(
  actionId: string,
  verifierId: string,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('corrective_actions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: verifierId,
        verified_by: verifierId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', actionId);
    if (error) throw error;
    return;
  }
  const action = demoState.actions.find((a) => a.id === actionId);
  if (!action) throw new Error('Action not found.');
  if (action.owner_id === verifierId) {
    throw new Error('An action cannot be verified by its own owner.');
  }
  const now = new Date().toISOString();
  action.status = 'closed';
  action.closed_at = now;
  action.closed_by = verifierId;
  action.verified_by = verifierId;
  action.verified_at = now;
  action.updated_at = now;
}

/** Rejette la preuve : l'action repart en `in_progress` et `reopen_count` augmente. */
export async function rejectClosureProof(
  actionId: string,
  reason: string,
  verifierId: string,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('corrective_actions')
      .update({
        status: 'in_progress',
        reopen_count: (demoState.actions.find((a) => a.id === actionId)?.reopen_count ?? 0) + 1,
        closure_note: reason,
      })
      .eq('id', actionId);
    if (error) throw error;
    return;
  }
  const action = demoState.actions.find((a) => a.id === actionId);
  if (!action) throw new Error('Action not found.');
  if (action.owner_id === verifierId) {
    throw new Error('An action cannot be verified by its own owner.');
  }
  action.status = 'in_progress';
  action.reopen_count += 1;
  action.closure_note = reason;
  action.submitted_for_verification_at = null;
  action.updated_at = new Date().toISOString();
}

/** Rouvre une action cloturee. */
export async function reopenAction(actionId: string, reason: string, actorId: string): Promise<void> {
  void actorId;
  if (supabase) {
    const { error } = await supabase
      .from('corrective_actions')
      .update({ status: 'in_progress', reopen_count: 1, closure_note: reason })
      .eq('id', actionId);
    if (error) throw error;
    return;
  }
  const action = demoState.actions.find((a) => a.id === actionId);
  if (!action) throw new Error('Action not found.');
  action.status = 'in_progress';
  action.reopen_count += 1;
  action.closure_note = reason;
  action.closed_at = null;
  action.verified_at = null;
  action.verified_by = null;
  action.updated_at = new Date().toISOString();
}

/** Accepte ou rejette une proposition IA (jamais appliquee automatiquement, CR06). */
export async function reviewAiProposal(input: {
  proposal_id: string;
  decision: 'accepted' | 'rejected';
  reviewed_by: string;
  review_note: string;
}): Promise<AiProposal> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ai_proposals')
      .update({
        status: input.decision,
        reviewed_by: input.reviewed_by,
        reviewed_at: new Date().toISOString(),
        review_note: input.review_note,
      })
      .eq('id', input.proposal_id)
      .select(
        'id, event_id, asked_by, proposal_type, model_name, suggested_category_id, suggested_severity, suggested_document_id, confidence, rationale, references, limitations, status, reviewed_by, reviewed_at, review_note, applied_at, created_at',
      )
      .single();
    if (error) throw error;
    return data as AiProposal;
  }
  const proposal = demoState.proposals.find((p) => p.id === input.proposal_id);
  if (!proposal) throw new Error('Proposal not found.');
  proposal.status = input.decision;
  proposal.reviewed_by = input.reviewed_by;
  proposal.reviewed_at = new Date().toISOString();
  proposal.review_note = input.review_note;
  return proposal;
}

/** Demande une proposition IA (l'assistant ne modifie jamais l'evenement). */
export async function requestAssistantProposal(input: {
  event_id: string | null;
  proposal_type: 'classification' | 'instruction_lookup';
  asked_by: string;
}): Promise<AiProposal> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ai_proposals')
      .insert({
        event_id: input.event_id,
        proposal_type: input.proposal_type,
        asked_by: input.asked_by,
        model_name: 'rule-assist-v1',
        confidence: 0.71,
        rationale:
          'The description matches a pattern already documented in the validated instruction corpus.',
        references: ['C-207'],
        limitations:
          'The assistant can be wrong. A competent person must confirm this classification.',
        status: 'pending_review',
      })
      .select(
        'id, event_id, asked_by, proposal_type, model_name, suggested_category_id, suggested_severity, suggested_document_id, confidence, rationale, references, limitations, status, reviewed_by, reviewed_at, review_note, applied_at, created_at',
      )
      .single();
    if (error) throw error;
    return data as AiProposal;
  }
  const now = new Date().toISOString();
  const proposal: AiProposal = {
    id: `ai-${Date.now()}`,
    event_id: input.event_id,
    asked_by: input.asked_by,
    proposal_type: input.proposal_type,
    model_name: 'rule-assist-v1',
    suggested_category_id: 'cat-elec',
    suggested_severity: 'high',
    suggested_document_id: 'doc-3',
    confidence: 0.71,
    rationale:
      'The description matches a pattern already documented in the validated instruction corpus.',
    references: ['C-207'],
    limitations:
      'The assistant can be wrong. A competent person must confirm this classification.',
    status: 'pending_review',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    applied_at: null,
    created_at: now,
  };
  demoState.proposals.unshift(proposal);
  return proposal;
}

/** Marque une notification comme lue. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) throw error;
    return;
  }
  const notification = demoState.notifications.find((n) => n.id === notificationId);
  if (notification) notification.read_at = new Date().toISOString();
}

/** Journal d'un evenement (helper de lecture expose pour les vues). */
export type { SafetyEventLog };


/** Ecrit un reglage applicatif (`app_settings.key`, `app_settings.value` jsonb). */
export async function upsertAppSetting(key: string, value: unknown): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return;
  }
  const existing = demoState.settings.find((s) => s.key === key);
  if (existing) {
    existing.value = value as Record<string, unknown>;
    existing.updated_at = new Date().toISOString();
  } else {
    demoState.settings.push({
      key,
      value: value as Record<string, unknown>,
      updated_by: null,
      updated_at: new Date().toISOString(),
    });
  }
}
