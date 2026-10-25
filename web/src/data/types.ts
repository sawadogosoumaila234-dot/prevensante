/**
 * Types métier — alignés sur les énumérations PostgreSQL (supabase/migrations).
 * Toute divergence ici doit être répercutée dans les migrations.
 */

export type RoleActeur =
  | 'travailleur'
  | 'chef_equipe'
  | 'responsable_hse'
  | 'responsable_maintenance'
  | 'medecin_du_travail'
  | 'directeur_site'
  | 'administrateur';

export type TypeEvenement = 'danger' | 'incident' | 'accident';

export type StatutSignalement =
  | 'nouveau'
  | 'en_qualification'
  | 'qualifie'
  | 'en_traitement'
  | 'clos'
  | 'rejete';

export type StatutAction = 'a_faire' | 'en_cours' | 'a_verifier' | 'cloturee';

export type NiveauPriorite = 'critique' | 'elevee' | 'moyenne' | 'faible';

export type CategorieRisque =
  | 'mecanique'
  | 'electrique'
  | 'chute_hauteur'
  | 'chute_objet'
  | 'chimique'
  | 'manutention'
  | 'environnement'
  | 'incendie'
  | 'circulation_engins';

export interface Signalement {
  id: string;
  reference: string;
  type_evenement: TypeEvenement;
  site: string;
  zone: string;
  titre: string;
  description: string;
  categorie: CategorieRisque | null;
  priorite: NiveauPriorite;
  statut: StatutSignalement;
  declare_at: string;
  evenement_at: string;
  actions: number;
  photos: number;
  en_retard?: boolean;
}

export interface ActionCorrective {
  id: string;
  titre: string;
  description: string | null;
  statut: StatutAction;
  statut_libelle: string;
  responsable: string;
  echeance: string;
  en_retard: boolean;
  avancement: number;
  signalement_ref: string;
  site: string;
}

export interface Notification {
  id: string;
  emoji: string;
  titre: string;
  detail: string;
  quand: string;
  non_lue: boolean;
}

export interface CategorieBarre {
  label: string;
  valeur: number;
  couleur: string;
}

export interface MoisPoint {
  mois: string;
  valeur: number;
}

export interface Site {
  id: string;
  nom: string;
  secteur: string;
  ouverts: number;
  en_retard: number;
  utilisateurs: number;
  zones: number;
}

export interface Consigne {
  code: string;
  titre: string;
  statut: 'validee' | 'en_revue' | 'brouillon';
}
