/**
 * Brouillon de signalement conserve dans `localStorage`.
 *
 * Aucune promesse d'envoi hors-ligne : le brouillon permet de ne pas perdre
 * la saisie, il ne garantit pas la transmission.
 */

export interface ReportDraft {
  kind: string;
  site_id: string;
  zone_id: string;
  equipment_id?: string;
  risk_category_id?: string;
  activity: string;
  description: string;
  immediate_measures: string;
  reported_consequences: string;
  work_stoppage: boolean;
  injury_reported: boolean;
  is_anonymous: boolean;
  severity_immediate: boolean;
  photos: { id: string; dataUrl: string; name: string }[];
  updated_at: string;
}

const KEY = 'prevensante.draft';

export function loadDraft(): ReportDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReportDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ReportDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, updated_at: new Date().toISOString() }));
  } catch {
    /* quota atteint : le brouillon est conserve en memoire seulement */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
