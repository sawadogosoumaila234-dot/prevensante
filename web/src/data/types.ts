/**
 * Types metier — alignes sur le nouveau schema SQL `public`
 * (organizations, sites, profiles, zones, equipments, risk_categories,
 *  safety_events, safety_event_logs, corrective_actions, escalations,
 *  safety_documents, document_versions, ai_proposals, medical_records,
 *  site_worked_hours, notifications, email_outbox, sms_outbox, audit_log,
 *  app_settings).
 *
 * Toutes les formes sont en snake_case, exactement comme les reponses API.
 */

export type AppRole =
  | 'worker'
  | 'supervisor'
  | 'hse_officer'
  | 'maintenance_lead'
  | 'action_owner'
  | 'occupational_physician'
  | 'site_director'
  | 'admin';

export type BusinessSector =
  | 'mining'
  | 'quarry'
  | 'cement'
  | 'manufacturing'
  | 'metalworking'
  | 'food_processing'
  | 'construction'
  | 'logistics';

export type EventKind = 'danger' | 'incident' | 'accident';
export type EventStatus =
  | 'submitted'
  | 'under_review'
  | 'triaged'
  | 'in_progress'
  | 'awaiting_verification'
  | 'closed'
  | 'rejected'
  | 'escalated';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ZoneType =
  | 'workshop'
  | 'mine_area'
  | 'quarry_area'
  | 'plant_unit'
  | 'construction_site'
  | 'warehouse_area'
  | 'yard_area';
export type ActionStatus = 'to_do' | 'in_progress' | 'to_verify' | 'closed' | 'cancelled';
export type EscalationLevel = 'hse_officer' | 'site_director' | 'company_officer';
export type AiProposalStatus = 'pending_review' | 'accepted' | 'rejected' | 'expired';
export type DocumentStatus = 'draft' | 'in_validation' | 'validated' | 'archived';
export type OutboxStatus = 'queued' | 'sent' | 'failed' | 'skipped';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';
export type LogAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'commented'
  | 'proposed'
  | 'validated'
  | 'rejected'
  | 'closed'
  | 'escalated';
export type MedicalVisibility = 'physician_only' | 'hse_anonymised' | 'none';

export interface Organization {
  id: string;
  name: string;
  sector: BusinessSector;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  sector: BusinessSector;
  address: string | null;
  emergency_contact: string | null;
  is_pilot: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: AppRole;
  organization_id: string | null;
  site_id: string | null;
  job_title: string | null;
  is_medical_authorized: boolean;
  is_active: boolean;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  site_id: string;
  name: string;
  type: ZoneType;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  site_id: string;
  zone_id: string | null;
  name: string;
  asset_code: string | null;
  equipment_type: string | null;
  is_critical: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskCategory {
  id: string;
  sector: BusinessSector;
  code: string;
  label: string;
  default_severity: SeverityLevel;
  requires_equipment: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafetyEvent {
  id: string;
  reference: string;
  kind: EventKind;
  status: EventStatus;
  severity: SeverityLevel;
  site_id: string;
  zone_id: string | null;
  equipment_id: string | null;
  risk_category_id: string | null;
  occurred_at: string;
  reported_at: string;
  activity: string | null;
  description: string;
  immediate_measures: string | null;
  reported_consequences: string | null;
  work_stoppage: boolean;
  injury_reported: boolean;
  photo_paths: string[];
  reporter_id: string | null;
  is_anonymous: boolean;
  triaged_by: string | null;
  triaged_at: string | null;
  acknowledged_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closure_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyEventLog {
  id: string;
  event_id: string;
  actor_id: string | null;
  actor_role: AppRole | null;
  action: LogAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CorrectiveAction {
  id: string;
  reference: string;
  event_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  owner_role: AppRole | null;
  status: ActionStatus;
  severity: SeverityLevel;
  due_at: string;
  started_at: string | null;
  submitted_for_verification_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closure_evidence_path: string | null;
  closure_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  reopen_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Escalation {
  id: string;
  event_id: string;
  level: EscalationLevel;
  reason: string;
  triggered_by: string | null;
  notified_role: AppRole;
  notified_user_id: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  channel: string;
  created_at: string;
}

export interface SafetyDocument {
  id: string;
  reference: string;
  title: string;
  sector: BusinessSector | null;
  scope_text: string | null;
  current_version: number;
  status: DocumentStatus;
  validated_by: string | null;
  validated_at: string | null;
  review_due_at: string | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  change_summary: string | null;
  file_path: string;
  author_id: string | null;
  created_at: string;
}

export interface AiProposal {
  id: string;
  event_id: string | null;
  asked_by: string | null;
  proposal_type: 'classification' | 'instruction_lookup';
  model_name: string;
  suggested_category_id: string | null;
  suggested_severity: SeverityLevel | null;
  suggested_document_id: string | null;
  confidence: number | null;
  rationale: string | null;
  references: string[];
  limitations: string | null;
  status: AiProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  event_id: string;
  subject_id: string | null;
  visibility: MedicalVisibility;
  injury_type: string | null;
  body_part: string | null;
  care_given: string | null;
  fitness_return: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
}

export interface SiteWorkedHours {
  id: string;
  site_id: string;
  period_start: string;
  hours: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  event_id: string | null;
  action_id: string | null;
  kind: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface EmailOutbox {
  id: string;
  template: string;
  to_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  provider_message_id: string | null;
  last_error: string | null;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
}

export interface SmsOutbox {
  id: string;
  to_phone: string;
  body: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: AppRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

/* ── Vues ──────────────────────────────────────────────────────────────── */

export interface DashboardKpiRow {
  site_id: string;
  kind: EventKind;
  status: EventStatus;
  severity: SeverityLevel;
  events: number;
  avg_hours_to_triage: number | null;
  avg_hours_to_close: number | null;
}

export interface OverdueActionRow {
  id: string;
  reference: string;
  event_id: string;
  title: string;
  owner_id: string | null;
  status: ActionStatus;
  due_at: string;
  severity: SeverityLevel;
  overdue_days: number;
}

export interface RecurrentRiskRow {
  site_id: string;
  zone_id: string | null;
  equipment_id: string | null;
  risk_category_id: string | null;
  occurrences: number;
  accidents: number;
}

export interface AccidentRateRow {
  site_id: string;
  period_start: string;
  hours: number;
  accidents: number;
}

/** Resultat pagine par curseur (50 lignes par page). */
export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  total: number | null;
}
