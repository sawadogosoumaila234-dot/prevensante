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
