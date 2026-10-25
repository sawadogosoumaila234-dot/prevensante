/**
 * Formatage —dates et libellés— partagé par toute l'application.
 * Format français, sans dépendance externe.
 */

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FORMAT.format(d).replace('.', '');
}

export function formatDateLongue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_LONGUE.format(d);
}

export const LIBELLE_STATUT: Record<string, string> = {
  nouveau: 'Nouveau',
  en_qualification: 'En qualification',
  qualifie: 'Qualifié',
  en_traitement: 'En cours',
  clos: 'Clôturé',
  rejete: 'Rejeté',
  a_faire: 'À faire',
  en_cours: 'En cours',
  a_verifier: 'À vérifier',
  cloturee: 'Clôturée',
};

/**
 * Variante CSS de la pastille d'état.
 *
 * Le CSS ne définit que des variantes sémantiques (todo/progress/verify/
 * closed/late) : passer directement le statut métier ('nouveau',
 * 'a_faire'…) produirait une pastille sans couleur. Ce mapping fait le
 * lien entre les deux vocabulaires.
 */
export const VARIANTE_STATUT: Record<string, string> = {
  // Signalements
  nouveau: 'todo',
  en_qualification: 'verify',
  qualifie: 'progress',
  en_traitement: 'progress',
  clos: 'closed',
  rejete: 'late',
  // Actions correctives
  a_faire: 'todo',
  en_cours: 'progress',
  a_verifier: 'verify',
  cloturee: 'closed',
  // Misc
  late: 'late',
  // Consignes
  validee: 'closed',
  en_revue: 'verify',
  brouillon: 'todo',
};

export const LIBELLE_CATEGORIE: Record<string, string> = {
  mecanique: 'Mécanique',
  electrique: 'Électrique',
  chute_hauteur: 'Chute de hauteur',
  chute_objet: "Chute d'objet",
  chimique: 'Chimique',
  manutention: 'Manutention',
  environnement: 'Environnement',
  incendie: 'Incendie',
  circulation_engins: "Circulation d'engins",
};

export const LIBELLE_PRIORITE: Record<string, string> = {
  critique: 'Critique',
  elevee: 'Élevée',
  moyenne: 'Moyenne',
  faible: 'Faible',
};

export const EMOJI_TYPE: Record<string, string> = {
  danger: '⚠️',
  incident: '⚡',
  accident: '🚑',
};