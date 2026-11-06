/**
 * Portee de lecture cote interface — emulation locale des politiques RLS.
 *
 * En production, la securite est assuree par les politiques RLS de la base
 * (migration `0011_rls_policies.sql`). Sans Supabase configure, le jeu de
 * demonstration doit reproduire la meme restriction de lecture, sinon
 * l'interface laisserait voir des donnees que la base refuserait.
 *
 * Ce module reproduit fidelement les helpers de la migration
 * `0010_rls_helpers.sql` :
 *   - `current_role()`      -> `profiles.role` du profil connecte
 *   - `can_access_site(s)`  -> admin, ou profil du site, ou role HSE/direction/
 *                              medecin du travail dans la meme organisation
 *   - `can_view_medical(e)` -> admin, medecin du travail, ou HSE explicitement
 *                              habilite sur le site de l'evenement
 *
 * Ces fonctions filtrent l'affichage ; elles ne remplacent pas la RLS.
 */

import { demoState } from '../../data/demo';
import { loadSession } from '../session';
import type { AppRole, Profile, SafetyEvent, Site } from '../../data/types';

/**
 * Repertoire des sites, servant a resoudre l'organisation d'un site.
 *
 * En mode demonstration, ce sont les sites du jeu local (`site-1`, `site-2`…).
 * En mode Supabase, ce sont les sites **que la RLS laisse lire a l'utilisateur** :
 * la politique `sites_select_scoped` s'appuie sur `can_access_site`, donc cette
 * liste est exactement la liste des sites accessibles au profil connecte.
 *
 * Ce point est critique : les identifiants de la base (`22222222-2222-4222-…`)
 * ne sont pas ceux du jeu de demonstration (`site-1`). Chercher un site reel
 * dans le jeu local ne le trouve jamais, et toute la regle de perimetre
 * s'effondre : le HSE serait refuse sur les sites de sa propre organisation.
 */
let siteDirectory: Site[] = demoState.sites;

/** Remplace le repertoire des sites (mode Supabase : resultat de la RLS). */
export function setSiteDirectory(sites: Site[]): void {
  siteDirectory = sites;
}

/** Repertoire des sites actuellement utilise pour resoudre l'organisation. */
export function getSiteDirectory(): Site[] {
  return siteDirectory;
}

/** Revient au repertoire du jeu de demonstration (deconnexion, mode demo). */
export function resetSiteDirectory(): void {
  siteDirectory = demoState.sites;
}

/** Roles qui couvrent l'ensemble de leur organisation. */
const ORGANIZATION_WIDE_ROLES: AppRole[] = [
  'hse_officer',
  'site_director',
  'occupational_physician',
];

/** Profil connecte, lu depuis la session applicative. */
export function currentProfile(): Profile | null {
  return loadSession().user;
}

/** `public.current_role()` — role du profil connecte. */
export function currentRole(): AppRole | null {
  return currentProfile()?.role ?? null;
}

/** `public.is_admin()`. */
export function isAdmin(): boolean {
  return currentRole() === 'admin';
}

/**
 * `public.can_access_site(p_site)` — le profil connecte a-t-il acces a ce
 * site ? Un evenement declare hors de ce perimetre doit rester invisible.
 */
export function canAccessSite(profile: Profile | null, siteId: string | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (!siteId) return false;
  if (profile.site_id === siteId) return true;
  const site = siteDirectory.find((s) => s.id === siteId);
  if (!site) return false;
  return (
    profile.organization_id === site.organization_id &&
    ORGANIZATION_WIDE_ROLES.includes(profile.role)
  );
}

/**
 * `public.can_view_medical(p_event)` — le profil connecte peut-il lire le
 * dossier medical rattache a cet evenement ?
 */
export function canViewMedical(profile: Profile | null, event: SafetyEvent | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'occupational_physician') return true;
  if (profile.role === 'hse_officer' && profile.is_medical_authorized) {
    return event ? profile.site_id === event.site_id : true;
  }
  return false;
}

/**
 * Filtre une liste d'evenements selon la portee de lecture : un evenement
 * reste visible si l'utilisateur en est le rapporteur ou s'il a acces a son
 * site (meme regle que `safety_events_select_scoped`).
 */
export function visibleEvents<T extends SafetyEvent>(rows: T[], profile: Profile | null): T[] {
  if (!profile) return [];
  return rows.filter(
    (e) => e.reporter_id === profile.id || canAccessSite(profile, e.site_id),
  );
}

/** Filtre une liste d'actions correctives selon la meme portee. */
export function visibleActions<T extends { event_id: string }>(
  rows: T[],
  profile: Profile | null,
): T[] {
  if (!profile) return [];
  const byId = new Map(demoState.events.map((e) => [e.id, e]));
  return rows.filter((a) => {
    const event = byId.get(a.event_id);
    if (!event) return false;
    return event.reporter_id === profile.id || canAccessSite(profile, event.site_id);
  });
}
