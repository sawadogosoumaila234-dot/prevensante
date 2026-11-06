/**
 * Libelles derives des cles i18n (types, statuts, severites, roles,
 * secteurs). Aucune chaine nouvelle : tout provient de la table i18n.
 */

import { en, type TranslationKey } from './en';
import type { ActionStatus, EventKind, EventStatus, SeverityLevel } from '../../data/types';

const EVENT_STATUS_KEYS: EventStatus[] = [
  'submitted',
  'under_review',
  'triaged',
  'in_progress',
  'awaiting_verification',
  'closed',
  'rejected',
  'escalated',
];

export function kindLabel(kind: EventKind | string): string {
  return en[`kind.${kind}` as TranslationKey] ?? kind;
}

export function severityLabel(level: SeverityLevel | string): string {
  return en[`severity.${level}` as TranslationKey] ?? level;
}

export function statusLabel(status: EventStatus | string): string {
  return EVENT_STATUS_KEYS.includes(status as EventStatus)
    ? en[`status.${status}` as TranslationKey]
    : en[`actionStatus.${status as ActionStatus}` as TranslationKey] ?? status;
}

/** Nom lisible d'un role applicatif. */
export const ROLE_LABELS: Record<string, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  hse_officer: 'HSE officer',
  maintenance_lead: 'Maintenance lead',
  action_owner: 'Action owner',
  occupational_physician: 'Occupational physician',
  site_director: 'Site director',
  admin: 'Administrator',
};

/** Libelle anglais d'un secteur d'activite. */
export const SECTOR_LABELS: Record<string, string> = {
  mining: 'Mining',
  quarry: 'Quarry',
  cement: 'Cement',
  manufacturing: 'Manufacturing',
  metalworking: 'Metalworking',
  food_processing: 'Food processing',
  construction: 'Construction',
  logistics: 'Logistics',
};

/** Libelle anglais d'un type de zone. */
export const ZONE_TYPE_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  mine_area: 'Mine area',
  quarry_area: 'Quarry area',
  plant_unit: 'Plant unit',
  construction_site: 'Construction site',
  warehouse_area: 'Warehouse area',
  yard_area: 'Yard area',
};
