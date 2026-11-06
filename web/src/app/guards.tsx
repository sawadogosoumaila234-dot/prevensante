import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { canAccessSite } from '../lib/rls/scope';
import { t } from '../lib/i18n/en';
import { getSafetyEvent } from '../lib/api';
import type { AppRole } from '../data/types';

/** Ecart affiche quand l'acces est refuse : message + moyen de sortir. */
export function AccessDenied({ message }: { message: string }) {
  return (
    <div className="panel" role="alert">
      <h1 style={{ fontSize: 'var(--fs-22)', marginBottom: 8 }}>Access denied</h1>
      <p>{message}</p>
      <a className="btn secondary" href="/">
        Back to the home page
      </a>
    </div>
  );
}

/** Garde d'authentification : redirige vers `/login` si non connecte. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/**
 * Garde de role : masquage visuel ET blocage de route. Le masquage visuel
 * n'est pas une securite, la RLS l'est.
 */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <AccessDenied message="Your role does not give access to this screen." />;
  }
  return <>{children}</>;
}

/** Garde de challenge MFA : le second facteur est obligatoire. */
export function RequireMfa({ children }: { children: ReactNode }) {
  const { user, mfa_pending } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  if (mfa_pending || !user.mfa_verified) return <Navigate to="/login" replace state={{ mfa: true }} />;
  return <>{children}</>;
}

/**
 * Garde de perimetre de site : un utilisateur non autorise sur un site voit
 * « You are not allowed to access this site. »
 *
 * En mode Supabase, le perimetre vient de la RLS : le repertoire des sites
 * accessibles est charge a la connexion. Tant qu'il n'est pas arrive, la garde
 * ne peut pas conclure — elle affiche « Loading… » au lieu de refuser un acces
 * qui serait parfaitement legitime.
 */
export function RequireSiteScope({ siteId, children }: { siteId: string | null; children: ReactNode }) {
  const { user, sites_ready } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  if (!sites_ready) return <p className="muted">Loading…</p>;
  if (!canAccessSite(user, siteId)) {
    return <AccessDenied message={t('error.notAllowedSite')} />;
  }
  return <>{children}</>;
}

/**
 * Garde de perimetre applique a un evenement : le site de l'evenement doit
 * appartenir au perimetre de l'utilisateur.
 *
 * `getSafetyEvent` applique la meme regle que la politique RLS
 * `safety_events_select_scoped` : un evenement hors perimetre renvoie `null`
 * (0 ligne), exactement comme la base le ferait. Le refus est alors affiche
 * explicitement, conformement au resultat attendu de CR01.
 *
 * La regle SQL est « rapporteur OU acces au site » : on la reproduit a
 * l'identique, pour qu'un signalement declare par l'utilisateur reste
 * consultable meme s'il porte sur un site qui n'est pas le sien.
 */
export function EventScopeGuard({ children }: { children: ReactNode }) {
  const { user, sites_ready } = useSession();
  const { id: eventId } = useParams();
  const { data: event, isLoading } = useQuery({
    queryKey: ['event-scope', eventId],
    queryFn: () => getSafetyEvent(eventId ?? ''),
    enabled: Boolean(eventId),
    staleTime: 60_000,
  });
  if (!user) return <Navigate to="/login" replace />;
  if (isLoading || !sites_ready) return <p className="muted">Loading…</p>;
  // 0 ligne : l'evenement n'existe pas pour ce profil (RLS) ou son site est
  // hors perimetre.
  if (!event) {
    return <AccessDenied message={t('error.notAllowedSite')} />;
  }
  if (event.reporter_id !== user.id && !canAccessSite(user, event.site_id)) {
    return <AccessDenied message={t('error.notAllowedSite')} />;
  }
  return <>{children}</>;
}
