import { useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { OfflineBanner } from '../components/OfflineBanner';
import { t, type TranslationKey } from '../lib/i18n/en';
import { ROLE_LABELS } from '../lib/i18n/labels';
import { SPACE_BY_ROLE } from '../lib/session';
import type { AppRole } from '../data/types';

interface NavEntry {
  to: string;
  /** Cle i18n de la table de la section 11.6. */
  key?: TranslationKey;
  /** Libelle anglais en clair, pour les entrees hors table i18n. */
  label?: string;
  roles: AppRole[];
  group: 'main' | 'hse' | 'admin';
}

const ALL: AppRole[] = [
  'worker',
  'supervisor',
  'hse_officer',
  'maintenance_lead',
  'action_owner',
  'occupational_physician',
  'site_director',
  'admin',
];

const NAV: NavEntry[] = [
  /* Espace salarie */
  { to: '/', key: 'nav.report', roles: ALL, group: 'main' },
  { to: '/my-reports', key: 'nav.myReports', roles: ['worker', 'supervisor', 'action_owner', 'maintenance_lead'], group: 'main' },
  { to: '/instructions', key: 'nav.instructions', roles: ALL, group: 'main' },

  /* Espace metier */
  { to: '/hse', key: 'nav.dashboard', roles: ['hse_officer', 'supervisor', 'site_director'], group: 'hse' },
  { to: '/hse/events', key: 'nav.events', roles: ['hse_officer', 'supervisor', 'site_director'], group: 'hse' },
  { to: '/hse/actions', key: 'nav.actions', roles: ['hse_officer', 'supervisor', 'site_director', 'action_owner', 'maintenance_lead'], group: 'hse' },
  { to: '/hse/escalations', key: 'nav.escalations', roles: ['hse_officer', 'site_director'], group: 'hse' },
  { to: '/hse/recurrences', key: 'nav.recurrences', roles: ['hse_officer', 'site_director'], group: 'hse' },
  { to: '/hse/assistant', key: 'nav.assistant', roles: ['hse_officer'], group: 'hse' },
  { to: '/hse/reports', key: 'nav.reports', roles: ['hse_officer', 'site_director'], group: 'hse' },

  /* Espace medical */
  { to: '/medical', label: 'Medical records', roles: ['occupational_physician'], group: 'hse' },

  /* Transversal */
  { to: '/notifications', key: 'nav.notifications', roles: ALL, group: 'main' },
  { to: '/settings', key: 'nav.settings', roles: ALL, group: 'main' },

  /* Espace admin */
  { to: '/admin', label: 'Dashboard', roles: ['admin'], group: 'admin' },
  { to: '/admin/users', label: 'Accounts', roles: ['admin'], group: 'admin' },
  { to: '/admin/sites', label: 'Sites, zones and equipment', roles: ['admin'], group: 'admin' },
  { to: '/admin/categories', label: 'Risk categories', roles: ['admin'], group: 'admin' },
  { to: '/admin/documents', label: 'Instruction corpus', roles: ['admin'], group: 'admin' },
  { to: '/admin/audit', label: 'Audit log', roles: ['admin'], group: 'admin' },
  { to: '/admin/outbox', label: 'Emails and SMS', roles: ['admin'], group: 'admin' },
  { to: '/admin/settings', label: 'Instance settings', roles: ['admin'], group: 'admin' },
];

const GROUP_LABELS: Record<NavEntry['group'], string> = {
  main: 'Report and follow-up',
  hse: 'Safety management',
  admin: 'Administration',
};

/**
 * Coquille applicative : en-tete, navigation laterale (desktop), navigation
 * basse (mobile), lien d'evitement et bandeau hors-ligne.
 */
export function AppLayout() {
  const { user, signOut } = useSession();
  const location = useLocation();

  const entries = useMemo(
    () => (user ? NAV.filter((entry) => entry.roles.includes(user.role)) : []),
    [user],
  );

  const groups = useMemo(() => {
    const map = new Map<NavEntry['group'], NavEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()];
  }, [entries]);

  const mobileEntries = entries.filter((e) =>
    ['/', '/my-reports', '/instructions', '/notifications'].includes(e.to),
  );

  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  const space = user ? SPACE_BY_ROLE[user.role] : 'worker';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header">
        <Link className="brand" to="/">
          <span className="logo" aria-hidden="true">
            PE
          </span>
          <span>PrevEnSanté</span>
        </Link>
        <span className="spacer" />
        <NavLink className="header-link" to="/notifications">
          <span aria-hidden="true">🔔</span>
          <span className="visually-hidden">{t('nav.notifications')}</span>
        </NavLink>
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span>
            <span className="who">{user?.full_name ?? 'Guest'}</span>
            <span className="role">{user ? ROLE_LABELS[user.role] : ''}</span>
          </span>
        </div>
        <button type="button" className="header-link" onClick={signOut}>
          Sign out
        </button>
      </header>

      <div className="app-body">
        <nav className="app-nav" aria-label="Main navigation">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="nav-group">{GROUP_LABELS[group]}</p>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/' || item.to === '/admin'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span aria-hidden="true">•</span>
                  {item.key ? t(item.key) : item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main className="app-main" id="main-content" data-testid="main-content" data-space={space}>
          <div className="wrap">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {mobileEntries.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span aria-hidden="true">●</span>
            {item.key ? t(item.key) : item.label}
          </NavLink>
        ))}
        <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">🔔</span>
          {t('nav.notifications')}
        </NavLink>
      </nav>

      <OfflineBanner />
      <span className="visually-hidden" aria-live="polite">
        {location.pathname}
      </span>
    </div>
  );
}
