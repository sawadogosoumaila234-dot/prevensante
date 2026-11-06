import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  loadSession,
  saveSession,
  type SessionUser,
} from '../lib/session';
import { demoState } from '../data/demo';
import { supabase } from '../lib/supabase/client';
import { resetSiteDirectory, setSiteDirectory } from '../lib/rls/scope';
import type { Profile, Site } from '../data/types';

interface SessionContextValue {
  user: SessionUser | null;
  mfa_pending: boolean;
  /**
   * Le repertoire des sites accessibles est-il charge ?
   *
   * En mode Supabase, les gardes de perimetre ont besoin de la liste des
   * sites que la RLS laisse lire au profil connecte. Tant qu'elle n'est pas
   * la, elles ne peuvent pas conclure : elles affichent « Loading… » au lieu
   * de refuser un acces a tort.
   */
  sites_ready: boolean;
  signIn: (email: string, password: string) => Promise<'ok' | 'mfa_required' | 'invalid'>;
  completeMfa: (code: string) => Promise<boolean>;
  signOut: () => void;
  /** Change de profil (mode demonstration) pour tester les gardes de role. */
  switchProfile: (profileId: string) => void;
  profiles: Profile[];
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Colonnes du site minimales pour resoudre son organisation. */
const COLONNES_SITES = 'id, organization_id, name, code, sector, address, emergency_contact, is_pilot, is_active, created_at, updated_at';

/**
 * Charge les sites accessibles au profil connecte et les installe comme
 * repertoire de perimetre.
 *
 * La politique `sites_select_scoped` s'appuie sur `can_access_site` : la
 * requete ne renvoie donc que les sites que le profil peut consulter. C'est
 * la source de verite cote client, la RLS restant l'autorisation reelle.
 */
async function chargerRepertoireSites(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from('sites').select(COLONNES_SITES);
  if (error) {
    // En cas d'echec, on ne laisse aucun site : les gardes refuseront plutot
    // que d'accorder un perimetre inventee.
    setSiteDirectory([]);
    return;
  }
  setSiteDirectory((data ?? []) as Site[]);
}

/**
 * Provider de session. Sans Supabase configure, la connexion se fait contre
 * les profils de demonstration ; avec Supabase, la session vient de
 * `supabase.auth`.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => loadSession());
  const [sitesReady, setSitesReady] = useState(!supabase);

  // Session restauree au rechargement : le repertoire des sites doit etre
  // recharge, sinon les gardes de perimetre refuseraient tout acces.
  useEffect(() => {
    if (!supabase || !state.user) return;
    let annule = false;
    void chargerRepertoireSites().then(() => {
      if (!annule) setSitesReady(true);
    });
    return () => {
      annule = true;
    };
  }, [state.user?.id]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<'ok' | 'mfa_required' | 'invalid'> => {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) return 'invalid';
        const { data: profile } = await supabase
          .from('profiles')
          .select(
            'id, full_name, email, phone, role, organization_id, site_id, job_title, is_medical_authorized, is_active, locale, created_at, updated_at',
          )
          .eq('id', data.user.id)
          .maybeSingle();
        if (!profile) return 'invalid';
        const user = { ...profile, email: profile.email ?? email, mfa_verified: false };

        // Le perimetre de sites est charge avant d'ouvrir la session : les
        // gardes de perimetre ne doivent pas conclure sur un repertoire vide.
        await chargerRepertoireSites();
        setSitesReady(true);

        // Un second facteur n'est demande que si le compte a un facteur TOTP
        // verifie dans Supabase Auth. Sinon la session est ouverte : demander
        // un code que personne ne peut produire bloquerait la connexion.
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const factor = factorsData?.totp?.find((f) => f.status === 'verified');

        if (!factor) {
          const next = {
            user: { ...user, mfa_verified: true },
            mfa_pending: false,
            email,
            mfa_factor_id: null,
            mfa_challenge_id: null,
          };
          setState(next);
          saveSession(next);
          return 'ok';
        }

        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: factor.id,
        });
        if (challengeError || !challenge) return 'invalid';
        // `challenge` est une union selon le type de facteur : l'identifiant
        // du challenge est commun a toutes ses variantes.
        const challengeId = (challenge as { id: string }).id;
        const next = {
          user,
          mfa_pending: true,
          email,
          mfa_factor_id: factor.id,
          mfa_challenge_id: challengeId,
        };
        setState(next);
        saveSession(next);
        return 'mfa_required';
      }

      const profile = demoState.profiles.find(
        (p) => (p.email ?? '').toLowerCase() === email.trim().toLowerCase(),
      );
      if (!profile || password.length < 4) return 'invalid';
      const next = {
        user: { ...profile, email: profile.email ?? email, mfa_verified: false },
        mfa_pending: true,
        email: profile.email ?? email,
        mfa_factor_id: null,
        mfa_challenge_id: null,
      };
      setState(next);
      saveSession(next);
      return 'mfa_required';
    },
    [],
  );

  const completeMfa = useCallback(
    async (code: string): Promise<boolean> => {
      const digits = code.replace(/\D/g, '');
      // Le code de demonstration est 123456 ; en mode Supabase, le challenge
      // reel est verifie par la base.
      if (!supabase) {
        if (digits !== '123456') return false;
      } else {
        if (!state.mfa_factor_id || !state.mfa_challenge_id) return false;
        const { error } = await supabase.auth.mfa.verify({
          factorId: state.mfa_factor_id,
          challengeId: state.mfa_challenge_id,
          code: digits,
        });
        if (error) return false;
      }
      const next = {
        user: state.user ? { ...state.user, mfa_verified: true } : null,
        mfa_pending: false,
        email: state.email,
        mfa_factor_id: null,
        mfa_challenge_id: null,
      };
      setState(next);
      saveSession(next);
      return true;
    },
    [state.user, state.email, state.mfa_factor_id, state.mfa_challenge_id],
  );

  const signOut = useCallback(() => {
    clearSession();
    resetSiteDirectory();
    setSitesReady(!supabase);
    if (supabase) void supabase.auth.signOut();
    setState({
      user: null,
      mfa_pending: false,
      email: '',
      mfa_factor_id: null,
      mfa_challenge_id: null,
    });
  }, []);

  const switchProfile = useCallback((profileId: string) => {
    const profile = demoState.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    resetSiteDirectory();
    setSitesReady(true);
    const next = {
      user: { ...profile, email: profile.email ?? '', mfa_verified: true },
      mfa_pending: false,
      email: profile.email ?? '',
      mfa_factor_id: null,
      mfa_challenge_id: null,
    };
    setState(next);
    saveSession(next);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: state.user,
      mfa_pending: state.mfa_pending,
      sites_ready: sitesReady,
      signIn,
      completeMfa,
      signOut,
      switchProfile,
      profiles: demoState.profiles,
    }),
    [state.user, state.mfa_pending, state.email, sitesReady, signIn, completeMfa, signOut, switchProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider.');
  return ctx;
}
