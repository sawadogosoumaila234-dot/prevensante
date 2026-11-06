/**
 * Session applicative.
 *
 * Sans Supabase configure, la session est locale (choix d'un profil de
 * demonstration dans `/login`). Avec Supabase, la session provient de
 * `supabase.auth`. Dans les deux cas, l'interface consomme le meme objet
 * `SessionUser` (profil + role + perimetre de site).
 */

import { demoState } from '../data/demo';
import type { AppRole, Profile } from '../data/types';

const STORAGE_KEY = 'prevensante.session';

export type SessionUser = Omit<Profile, 'email'> & {
  /** L'adresse de connexion est toujours renseignee pour un profil actif. */
  email: string;
  /** Le challenge MFA a-t-il ete valide pour cette session ? */
  mfa_verified: boolean;
};

export interface SessionState {
  user: SessionUser | null;
  mfa_pending: boolean;
  email: string;
  /** Facteur TOTP en cours de validation (mode Supabase). */
  mfa_factor_id: string | null;
  /** Challenge MFA en cours de validation (mode Supabase). */
  mfa_challenge_id: string | null;
}

const SESSION_VIDE: SessionState = {
  user: null,
  mfa_pending: false,
  email: '',
  mfa_factor_id: null,
  mfa_challenge_id: null,
};

export function loadSession(): SessionState {
  if (typeof localStorage === 'undefined') return { ...SESSION_VIDE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...SESSION_VIDE };
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    const state: SessionState = {
      ...SESSION_VIDE,
      ...parsed,
      mfa_factor_id: parsed.mfa_factor_id ?? null,
      mfa_challenge_id: parsed.mfa_challenge_id ?? null,
    };
    if (state.user) {
      const fresh = demoState.profiles.find((p) => p.id === state.user?.id);
      if (fresh) {
        state.user = {
          ...fresh,
          email: fresh.email ?? state.user.email,
          mfa_verified: state.user.mfa_verified,
        };
      }
    }
    return state;
  } catch {
    return { ...SESSION_VIDE };
  }
}

export function saveSession(state: SessionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible : la session reste en memoire */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Roles par espace : sert a dimensionner la navigation. */
export const SPACE_BY_ROLE: Record<AppRole, 'worker' | 'hse' | 'medical' | 'admin'> = {
  worker: 'worker',
  supervisor: 'hse',
  action_owner: 'hse',
  maintenance_lead: 'hse',
  hse_officer: 'hse',
  site_director: 'hse',
  occupational_physician: 'medical',
  admin: 'admin',
};
