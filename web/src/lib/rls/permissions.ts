/**
 * Aides de filtrage cote interface (section 11.1 — `lib/rls/`).
 *
 * Ces fonctions ne remplacent PAS les politiques RLS de la base : elles
 * traduisent le perimetre de l'utilisateur dans l'interface, pour masquer
 * un element et eviter une requete inutile. La securite reste assuree par
 * la base.
 */

import { canAccessSite } from './scope';
import type { AppRole, Profile } from '../../data/types';

/** Roles autorises dans l'espace metier HSE. */
export const HSE_ROLES: AppRole[] = ['hse_officer', 'supervisor', 'site_director'];

/** Roles habilites a consulter des donnees de sante. */
export const MEDICAL_ROLES: AppRole[] = ['occupational_physician'];

/** Roles autorises a valider une action corrective. */
export const VERIFIER_ROLES: AppRole[] = ['hse_officer', 'site_director'];

export function hasRole(profile: Profile | null, roles: AppRole[]): boolean {
  if (!profile) return false;
  return roles.includes(profile.role);
}

/** Un acces medical exige le role ET l'autorisation explicite du profil. */
export function canReadMedical(profile: Profile | null): boolean {
  if (!profile) return false;
  return MEDICAL_ROLES.includes(profile.role) && profile.is_medical_authorized;
}

/** L'utilisateur peut-il administrer l'instance ? */
export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin';
}

/**
 * Le profil est-il rattache a ce site (`profiles.site_id`) ?
 *
 * Attention : c'est le perimetre de *gestion* (`public.can_manage_site`),
 * volontairement plus etroit que le perimetre de *lecture*
 * (`public.can_access_site`, dans `./scope`). Un HSE rattache a un site voit
 * les evenements de toute son organisation, mais ne gere que son site.
 */
export function isOwnSite(profile: Profile | null, siteId: string | null): boolean {
  if (!profile) return false;
  if (!siteId) return false;
  return profile.site_id === siteId;
}

/** Un referentiel est-il modifiable par cet utilisateur ? */
export function canManageSite(profile: Profile | null, siteId: string | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'site_director') return isOwnSite(profile, siteId);
  if (profile.role === 'hse_officer' || profile.role === 'supervisor') {
    return isOwnSite(profile, siteId);
  }
  return false;
}

/** Un document de consigne ne peut etre valide que par un HSE ou un directeur. */
export function canValidateDocuments(profile: Profile | null): boolean {
  return hasRole(profile, ['hse_officer', 'site_director']);
}

/**
 * L'administrateur ne valide une action corrective que s'il est aussi HSE sur le site.
 *
 * `public.can_verify_action` : role HSE ou direction, site de rattachement ou
 * meme organisation, et jamais sur sa propre action.
 */
export function canVerifyAction(profile: Profile | null, siteId: string | null, ownerId: string | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return false;
  if (!VERIFIER_ROLES.includes(profile.role)) return false;
  if (!canAccessSite(profile, siteId)) return false;
  return ownerId !== profile.id;
}
