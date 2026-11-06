/**
 * Couche d'acces aux donnees.
 *
 * Toutes les requetes utilisent des `select` explicites (jamais `select *`)
 * et une pagination par curseur (50 lignes par page). Si Supabase n'est pas
 * configure, les memes fonctions servent le jeu de donnees de demonstration :
 * la forme des donnees est identique dans les deux cas.
 */

import { supabase } from './supabase/client';
import { demoState } from '../data/demo';
import {
  canAccessSite,
  canViewMedical,
  currentProfile,
  visibleActions,
  visibleEvents,
} from './rls/scope';
import type {
  AiProposal,
  AppSetting,
  AuditLog,
  CorrectiveAction,
  CursorPage,
  DocumentVersion,
  EmailOutbox,
  Escalation,
  MedicalRecord,
  Notification,
  Organization,
  Profile,
  RiskCategory,
  SafetyDocument,
  SafetyEvent,
  SafetyEventLog,
  Site,
  SiteWorkedHours,
  SmsOutbox,
  Zone,
  Equipment,
} from '../data/types';

export const PAGE_SIZE = 50;

/* ── Utilitaires de pagination par curseur (mode demonstration) ─────────── */

function paginate<T>(rows: T[], cursor: string | null, limit = PAGE_SIZE): CursorPage<T> {
  const start = cursor ? Number.parseInt(cursor, 10) : 0;
  const items = rows.slice(start, start + limit);
  const next = start + limit < rows.length ? String(start + limit) : null;
  return { items, next_cursor: next, total: rows.length };
}

function supabasePage<T>(rows: T[] | null, count: number | null, limit: number): CursorPage<T> {
  const items = rows ?? [];
  const next = items.length === limit ? String(Number.NaN) : null;
  return { items, next_cursor: next, total: count };
}

/* ── Reperentiels ──────────────────────────────────────────────────────── */

export async function listOrganizations(): Promise<Organization[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, sector, country, is_active, created_at, updated_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Organization[];
  }
  return demoState.organizations;
}

export async function listSites(): Promise<Site[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('sites')
      .select(
        'id, organization_id, name, code, sector, address, emergency_contact, is_pilot, is_active, created_at, updated_at',
      )
      .order('name', { ascending: true });
    if (error) throw error;
    return data as Site[];
  }
  return demoState.sites;
}

export async function listZones(siteId?: string): Promise<Zone[]> {
  if (supabase) {
    let q = supabase
      .from('zones')
      .select('id, site_id, name, type, code, is_active, created_at, updated_at')
      .order('name', { ascending: true });
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    if (error) throw error;
    return data as Zone[];
  }
  return siteId ? demoState.zones.filter((z) => z.site_id === siteId) : demoState.zones;
}

export async function listEquipments(siteId?: string, zoneId?: string): Promise<Equipment[]> {
  if (supabase) {
    let q = supabase
      .from('equipments')
      .select(
        'id, site_id, zone_id, name, asset_code, equipment_type, is_critical, is_active, created_at, updated_at',
      )
      .order('name', { ascending: true });
    if (siteId) q = q.eq('site_id', siteId);
    if (zoneId) q = q.eq('zone_id', zoneId);
    const { data, error } = await q;
    if (error) throw error;
    return data as Equipment[];
  }
  return demoState.equipments.filter(
    (e) => (!siteId || e.site_id === siteId) && (!zoneId || e.zone_id === zoneId),
  );
}

export async function listRiskCategories(sector?: string): Promise<RiskCategory[]> {
  if (supabase) {
    let q = supabase
      .from('risk_categories')
      .select(
        'id, sector, code, label, default_severity, requires_equipment, is_active, created_at, updated_at',
      )
      .order('label', { ascending: true });
    if (sector) q = q.eq('sector', sector);
    const { data, error } = await q;
    if (error) throw error;
    return data as RiskCategory[];
  }
  return sector ? demoState.categories.filter((c) => c.sector === sector) : demoState.categories;
}

export async function listProfiles(): Promise<Profile[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, phone, role, organization_id, site_id, job_title, is_medical_authorized, is_active, locale, created_at, updated_at',
      )
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data as Profile[];
  }
  return demoState.profiles;
}

/* ── Filtres des evenements ────────────────────────────────────────────── */

export interface EventFilters {
  site_id?: string;
  zone_id?: string;
  kind?: string;
  status?: string;
  severity?: string;
  risk_category_id?: string;
  assigned_to?: string;
  reporter_id?: string;
  period?: '30d' | '90d' | 'year' | 'all';
  search?: string;
}

export async function listSafetyEvents(
  filters: EventFilters = {},
  cursor: string | null = null,
  limit = PAGE_SIZE,
): Promise<CursorPage<SafetyEvent>> {
  if (supabase) {
    let q = supabase
      .from('safety_events')
      .select(
        'id, reference, kind, status, severity, site_id, zone_id, equipment_id, risk_category_id, occurred_at, reported_at, activity, description, immediate_measures, reported_consequences, work_stoppage, injury_reported, photo_paths, reporter_id, is_anonymous, triaged_by, triaged_at, acknowledged_at, closed_by, closed_at, closure_note, created_at, updated_at',
        { count: 'exact' },
      )
      .order('reported_at', { ascending: false })
      .limit(limit);
    if (filters.site_id) q = q.eq('site_id', filters.site_id);
    if (filters.zone_id) q = q.eq('zone_id', filters.zone_id);
    if (filters.kind) q = q.eq('kind', filters.kind);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.severity) q = q.eq('severity', filters.severity);
    if (filters.risk_category_id) q = q.eq('risk_category_id', filters.risk_category_id);
    if (filters.reporter_id) q = q.eq('reporter_id', filters.reporter_id);
    if (filters.assigned_to) q = q.eq('triaged_by', filters.assigned_to);
    if (filters.search) q = q.ilike('description', `%${filters.search}%`);
    if (filters.period && filters.period !== 'all') {
      const days = filters.period === '30d' ? 30 : filters.period === '90d' ? 90 : 365;
      q = q.gte('reported_at', new Date(Date.now() - days * 86400000).toISOString());
    }
    const { data, error, count } = await q;
    if (error) throw error;
    return supabasePage(data as SafetyEvent[], count, limit);
  }

  let rows = visibleEvents(demoState.events, currentProfile());
  if (filters.site_id) rows = rows.filter((e) => e.site_id === filters.site_id);
  if (filters.zone_id) rows = rows.filter((e) => e.zone_id === filters.zone_id);
  if (filters.kind) rows = rows.filter((e) => e.kind === filters.kind);
  if (filters.status) rows = rows.filter((e) => e.status === filters.status);
  if (filters.severity) rows = rows.filter((e) => e.severity === filters.severity);
  if (filters.risk_category_id) rows = rows.filter((e) => e.risk_category_id === filters.risk_category_id);
  if (filters.reporter_id) rows = rows.filter((e) => e.reporter_id === filters.reporter_id);
  if (filters.assigned_to) rows = rows.filter((e) => e.triaged_by === filters.assigned_to);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(
      (e) =>
        e.description.toLowerCase().includes(s) ||
        e.reference.toLowerCase().includes(s) ||
        (e.activity ?? '').toLowerCase().includes(s),
    );
  }
  if (filters.period && filters.period !== 'all') {
    const days = filters.period === '30d' ? 30 : filters.period === '90d' ? 90 : 365;
    const limitDate = Date.now() - days * 86400000;
    rows = rows.filter((e) => new Date(e.reported_at).getTime() >= limitDate);
  }
  return paginate(rows, cursor, limit);
}

export async function getSafetyEvent(id: string): Promise<SafetyEvent | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('safety_events')
      .select(
        'id, reference, kind, status, severity, site_id, zone_id, equipment_id, risk_category_id, occurred_at, reported_at, activity, description, immediate_measures, reported_consequences, work_stoppage, injury_reported, photo_paths, reporter_id, is_anonymous, triaged_by, triaged_at, acknowledged_at, closed_by, closed_at, closure_note, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as SafetyEvent) ?? null;
  }
  const profile = currentProfile();
  const event = demoState.events.find((e) => e.id === id) ?? null;
  if (!event) return null;
  // Meme regle que `safety_events_select_scoped` : rapporteur ou acces au site.
  if (!visibleEvents([event], profile).length) return null;
  return event;
}

export async function listEventLogs(eventId: string): Promise<SafetyEventLog[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('safety_event_logs')
      .select(
        'id, event_id, actor_id, actor_role, action, field_name, old_value, new_value, note, payload, created_at',
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as SafetyEventLog[];
  }
  const scoped = visibleEvents(demoState.events, currentProfile());
  const eventIds = new Set(scoped.map((e) => e.id));
  return demoState.logs.filter((l) => l.event_id === eventId && eventIds.has(l.event_id));
}

/* ── Actions correctives ───────────────────────────────────────────────── */

export interface ActionFilters {
  site_id?: string;
  event_id?: string;
  status?: string;
  severity?: string;
  owner_id?: string;
  overdue?: boolean;
  search?: string;
}

export async function listCorrectiveActions(
  filters: ActionFilters = {},
  cursor: string | null = null,
  limit = PAGE_SIZE,
): Promise<CursorPage<CorrectiveAction>> {
  if (supabase) {
    let q = supabase
      .from('corrective_actions')
      .select(
        'id, reference, event_id, title, description, owner_id, owner_role, status, severity, due_at, started_at, submitted_for_verification_at, closed_at, closed_by, closure_evidence_path, closure_note, verified_by, verified_at, reopen_count, created_by, created_at, updated_at',
        { count: 'exact' },
      )
      .order('due_at', { ascending: true })
      .limit(limit);
    if (filters.event_id) q = q.eq('event_id', filters.event_id);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.severity) q = q.eq('severity', filters.severity);
    if (filters.owner_id) q = q.eq('owner_id', filters.owner_id);
    if (filters.search) q = q.ilike('title', `%${filters.search}%`);
    // `corrective_actions` ne porte pas de `site_id` : le perimetre passe par
    // les evenements du site (colonne `event_id`).
    if (filters.site_id) {
      const { data: siteEvents } = await supabase
        .from('safety_events')
        .select('id')
        .eq('site_id', filters.site_id);
      const ids = (siteEvents ?? []).map((e) => e.id as string);
      q = ids.length > 0 ? q.in('event_id', ids) : q.eq('event_id', '__none__');
    }
    const { data, error, count } = await q;
    if (error) throw error;
    return supabasePage(data as CorrectiveAction[], count, limit);
  }

  let rows = visibleActions(demoState.actions, currentProfile());
  if (filters.site_id) {
    const siteIds = new Set(
      demoState.events.filter((e) => e.site_id === filters.site_id).map((e) => e.id),
    );
    rows = rows.filter((a) => siteIds.has(a.event_id));
  }
  if (filters.event_id) rows = rows.filter((a) => a.event_id === filters.event_id);
  if (filters.status) rows = rows.filter((a) => a.status === filters.status);
  if (filters.severity) rows = rows.filter((a) => a.severity === filters.severity);
  if (filters.owner_id) rows = rows.filter((a) => a.owner_id === filters.owner_id);
  if (filters.overdue) {
    rows = rows.filter(
      (a) => ['to_do', 'in_progress'].includes(a.status) && new Date(a.due_at).getTime() < Date.now(),
    );
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(
      (a) => a.title.toLowerCase().includes(s) || a.reference.toLowerCase().includes(s),
    );
  }
  return paginate(rows, cursor, limit);
}

export async function getCorrectiveAction(id: string): Promise<CorrectiveAction | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('corrective_actions')
      .select(
        'id, reference, event_id, title, description, owner_id, owner_role, status, severity, due_at, started_at, submitted_for_verification_at, closed_at, closed_by, closure_evidence_path, closure_note, verified_by, verified_at, reopen_count, created_by, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as CorrectiveAction) ?? null;
  }
  const profile = currentProfile();
  const action = demoState.actions.find((a) => a.id === id) ?? null;
  if (!action) return null;
  if (!visibleActions([action], profile).length) return null;
  return action;
}

/* ── Escalades ─────────────────────────────────────────────────────────── */

export async function listEscalations(openOnly = false): Promise<Escalation[]> {
  if (supabase) {
    let q = supabase
      .from('escalations')
      .select(
        'id, event_id, level, reason, triggered_by, notified_role, notified_user_id, acknowledged_by, acknowledged_at, channel, created_at',
      )
      .order('created_at', { ascending: false });
    if (openOnly) q = q.is('acknowledged_at', null);
    const { data, error } = await q;
    if (error) throw error;
    return data as Escalation[];
  }
  const scoped = visibleEvents(demoState.events, currentProfile());
  const eventIds = new Set(scoped.map((e) => e.id));
  return openOnly
    ? demoState.escalations.filter((e) => !e.acknowledged_at && eventIds.has(e.event_id))
    : demoState.escalations.filter((e) => eventIds.has(e.event_id));
}

/* ── Consignes (documents) ─────────────────────────────────────────────── */

export async function listSafetyDocuments(
  status?: string,
  sector?: string,
): Promise<SafetyDocument[]> {
  if (supabase) {
    let q = supabase
      .from('safety_documents')
      .select(
        'id, reference, title, sector, scope_text, current_version, status, validated_by, validated_at, review_due_at, file_path, created_by, created_at, updated_at',
      )
      .order('reference', { ascending: true });
    if (status) q = q.eq('status', status);
    if (sector) q = q.eq('sector', sector);
    const { data, error } = await q;
    if (error) throw error;
    return data as SafetyDocument[];
  }
  return demoState.documents.filter(
    (d) => (!status || d.status === status) && (!sector || d.sector === sector),
  );
}

export async function getSafetyDocument(id: string): Promise<SafetyDocument | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('safety_documents')
      .select(
        'id, reference, title, sector, scope_text, current_version, status, validated_by, validated_at, review_due_at, file_path, created_by, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as SafetyDocument) ?? null;
  }
  return demoState.documents.find((d) => d.id === id) ?? null;
}

export async function listDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('document_versions')
      .select('id, document_id, version, change_summary, file_path, author_id, created_at')
      .eq('document_id', documentId)
      .order('version', { ascending: false });
    if (error) throw error;
    return data as DocumentVersion[];
  }
  return demoState.documentVersions
    .filter((v) => v.document_id === documentId)
    .sort((a, b) => b.version - a.version);
}

/* ── Propositions IA ───────────────────────────────────────────────────── */

export async function listAiProposals(status?: string): Promise<AiProposal[]> {
  if (supabase) {
    let q = supabase
      .from('ai_proposals')
      .select(
        'id, event_id, asked_by, proposal_type, model_name, suggested_category_id, suggested_severity, suggested_document_id, confidence, rationale, references, limitations, status, reviewed_by, reviewed_at, review_note, applied_at, created_at',
      )
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data as AiProposal[];
  }
  const scoped = visibleEvents(demoState.events, currentProfile());
  const eventIds = new Set(scoped.map((e) => e.id));
  const allowed = demoState.proposals.filter(
    (p) => p.event_id !== null && eventIds.has(p.event_id),
  );
  return status ? allowed.filter((p) => p.status === status) : allowed;
}

/* ── Donnees de sante (CR03) ───────────────────────────────────────────── */

export async function listMedicalRecords(eventId?: string): Promise<MedicalRecord[]> {
  if (supabase) {
    let q = supabase
      .from('medical_records')
      .select(
        'id, event_id, subject_id, visibility, injury_type, body_part, care_given, fitness_return, recorded_by, recorded_at, created_at',
      )
      .order('recorded_at', { ascending: false });
    if (eventId) q = q.eq('event_id', eventId);
    const { data, error } = await q;
    if (error) throw error;
    return data as MedicalRecord[];
  }
  const profile = currentProfile();
  // Meme regle que `medical_records_select_authorized` : le profil doit etre
  // habilite a consulter le dossier medical de l'evenement concerne.
  const allowed = demoState.medical.filter((m) => {
    const event = demoState.events.find((e) => e.id === m.event_id) ?? null;
    return canViewMedical(profile, event);
  });
  return eventId ? allowed.filter((m) => m.event_id === eventId) : allowed;
}

/** Dossier medical rattache a un evenement (route `/medical/:eventId`). */
export async function getMedicalRecordForEvent(eventId: string): Promise<MedicalRecord | null> {
  const records = await listMedicalRecords(eventId);
  return records[0] ?? null;
}

/* ── Notifications ─────────────────────────────────────────────────────── */

export async function listNotifications(userId: string): Promise<Notification[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id, user_id, event_id, action_id, kind, title, body, severity, data, read_at, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) throw error;
    return data as Notification[];
  }
  return demoState.notifications.filter((n) => n.user_id === userId);
}

/* ── Back-office ───────────────────────────────────────────────────────── */

export async function listAuditLog(): Promise<AuditLog[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('audit_log')
      .select(
        'id, actor_id, actor_role, action, entity_type, entity_id, before_data, after_data, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) throw error;
    return data as AuditLog[];
  }
  return demoState.audit;
}

export async function listEmailOutbox(): Promise<EmailOutbox[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('email_outbox')
      .select(
        'id, template, to_email, recipient_name, subject, body, payload, status, attempts, provider_message_id, last_error, scheduled_at, sent_at, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) throw error;
    return data as EmailOutbox[];
  }
  return demoState.emailOutbox;
}

export async function listSmsOutbox(): Promise<SmsOutbox[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('sms_outbox')
      .select('id, to_phone, body, payload, status, attempts, last_error, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) throw error;
    return data as SmsOutbox[];
  }
  return demoState.smsOutbox;
}

export async function listAppSettings(): Promise<AppSetting[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value, updated_by, updated_at')
      .order('key', { ascending: true });
    if (error) throw error;
    return data as AppSetting[];
  }
  return demoState.settings;
}

export async function listWorkedHours(siteId?: string): Promise<SiteWorkedHours[]> {
  if (supabase) {
    let q = supabase
      .from('site_worked_hours')
      .select('id, site_id, period_start, hours, source, created_at, updated_at')
      .order('period_start', { ascending: false });
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    if (error) throw error;
    return data as SiteWorkedHours[];
  }
  const profile = currentProfile();
  return demoState.workedHours.filter(
    (h) => (!siteId || h.site_id === siteId) && canAccessSite(profile, h.site_id),
  );
}

/* ── Vues de pilotage ──────────────────────────────────────────────────── */

export interface DashboardSummary {
  total: number;
  open: number;
  closed: number;
  byKind: { kind: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  overdueActions: number;
  openEscalations: number;
  avgHoursToTriage: number | null;
  recurrentRisks: number;
}

export async function getDashboardSummary(siteId?: string): Promise<DashboardSummary> {
  if (supabase) {
    const { data, error } = await supabase
      .from('v_dashboard_kpi')
      .select(
        'site_id, kind, status, severity, events, avg_hours_to_triage, avg_hours_to_close',
      );
    if (error) throw error;
    const rows = (data ?? []) as {
      site_id: string;
      kind: string;
      status: string;
      severity: string;
      events: number;
      avg_hours_to_triage: number | null;
      avg_hours_to_close: number | null;
    }[];
    const scoped = siteId ? rows.filter((r) => r.site_id === siteId) : rows;
    const total = scoped.reduce((s, r) => s + r.events, 0);
    const open = scoped
      .filter((r) => !['closed', 'rejected'].includes(r.status))
      .reduce((s, r) => s + r.events, 0);
    const closed = scoped
      .filter((r) => r.status === 'closed')
      .reduce((s, r) => s + r.events, 0);
    const triageValues = scoped
      .map((r) => r.avg_hours_to_triage)
      .filter((v): v is number => v !== null);
    const byKindMap = new Map<string, number>();
    const bySeverityMap = new Map<string, number>();
    for (const r of scoped) {
      byKindMap.set(r.kind, (byKindMap.get(r.kind) ?? 0) + r.events);
      bySeverityMap.set(r.severity, (bySeverityMap.get(r.severity) ?? 0) + r.events);
    }
    const overdue = await listCorrectiveActions({ site_id: siteId, overdue: true });
    const escalations = await listEscalations(true);
    const recurrences = await listRecurrentRisks(siteId);
    return {
      total,
      open,
      closed,
      byKind: [...byKindMap].map(([kind, count]) => ({ kind, count })),
      bySeverity: [...bySeverityMap].map(([severity, count]) => ({ severity, count })),
      overdueActions: overdue.total ?? 0,
      openEscalations: escalations.length,
      avgHoursToTriage: triageValues.length
        ? triageValues.reduce((s, v) => s + v, 0) / triageValues.length
        : null,
      recurrentRisks: recurrences.length,
    };
  }

  const scoped = visibleEvents(demoState.events, currentProfile());
  const events = siteId ? scoped.filter((e) => e.site_id === siteId) : scoped;
  const byKindMap = new Map<string, number>();
  const bySeverityMap = new Map<string, number>();
  for (const e of events) {
    byKindMap.set(e.kind, (byKindMap.get(e.kind) ?? 0) + 1);
    bySeverityMap.set(e.severity, (bySeverityMap.get(e.severity) ?? 0) + 1);
  }
  const eventIds = new Set(events.map((e) => e.id));
  const overdue = visibleActions(demoState.actions, currentProfile()).filter(
    (a) =>
      eventIds.has(a.event_id) &&
      ['to_do', 'in_progress'].includes(a.status) &&
      new Date(a.due_at).getTime() < Date.now(),
  );
  // Les escalades ouvertes suivent le meme perimetre que les evenements :
  // une escalade d'un site hors perimetre ne doit pas alimenter le KPI.
  const openEscalations = demoState.escalations.filter(
    (e) => !e.acknowledged_at && eventIds.has(e.event_id),
  ).length;
  const triageHours = events
    .filter((e) => e.triaged_at)
    .map((e) => (new Date(e.triaged_at as string).getTime() - new Date(e.reported_at).getTime()) / 3600000);
  return {
    total: events.length,
    open: events.filter((e) => !['closed', 'rejected'].includes(e.status)).length,
    closed: events.filter((e) => e.status === 'closed').length,
    byKind: [...byKindMap].map(([kind, count]) => ({ kind, count })),
    bySeverity: [...bySeverityMap].map(([severity, count]) => ({ severity, count })),
    overdueActions: overdue.length,
    openEscalations,
    avgHoursToTriage: triageHours.length
      ? triageHours.reduce((s, v) => s + v, 0) / triageHours.length
      : null,
    recurrentRisks: listRecurrentRisksSync(siteId).length,
  };
}

export interface RecurrentRisk {
  site_id: string;
  zone_id: string | null;
  equipment_id: string | null;
  risk_category_id: string | null;
  occurrences: number;
  accidents: number;
}

function listRecurrentRisksSync(siteId?: string): RecurrentRisk[] {
  const map = new Map<string, RecurrentRisk>();
  // Meme perimetre de lecture que les listes d'evenements : un risque
  // recurrent porte par un site hors perimetre ne doit pas etre compte.
  for (const e of visibleEvents(demoState.events, currentProfile())) {
    if (e.status === 'rejected') continue;
    if (siteId && e.site_id !== siteId) continue;
    const key = `${e.site_id}|${e.zone_id ?? ''}|${e.equipment_id ?? ''}|${e.risk_category_id ?? ''}`;
    const current = map.get(key);
    if (current) {
      current.occurrences += 1;
      if (e.kind === 'accident') current.accidents += 1;
    } else {
      map.set(key, {
        site_id: e.site_id,
        zone_id: e.zone_id,
        equipment_id: e.equipment_id,
        risk_category_id: e.risk_category_id,
        occurrences: 1,
        accidents: e.kind === 'accident' ? 1 : 0,
      });
    }
  }
  return [...map.values()].filter((r) => r.occurrences >= 2);
}

export async function listRecurrentRisks(siteId?: string): Promise<RecurrentRisk[]> {
  if (supabase) {
    let q = supabase
      .from('v_recurrent_risks')
      .select('site_id, zone_id, equipment_id, risk_category_id, occurrences, accidents');
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as RecurrentRisk[];
  }
  return listRecurrentRisksSync(siteId);
}

export interface AccidentRate {
  site_id: string;
  period_start: string;
  hours: number;
  accidents: number;
}

export async function listAccidentRates(siteId?: string): Promise<AccidentRate[]> {
  if (supabase) {
    let q = supabase
      .from('v_accident_rate')
      .select('site_id, period_start, hours, accidents');
    if (siteId) q = q.eq('site_id', siteId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as AccidentRate[];
  }
  const profile = currentProfile();
  const scoped = visibleEvents(demoState.events, profile);
  return demoState.workedHours
    .filter((h) => (!siteId || h.site_id === siteId) && canAccessSite(profile, h.site_id))
    .map((h) => ({
      site_id: h.site_id,
      period_start: h.period_start,
      hours: h.hours,
      accidents: scoped.filter(
        (e) => e.site_id === h.site_id && e.kind === 'accident' && e.reported_at >= h.period_start,
      ).length,
    }));
}
