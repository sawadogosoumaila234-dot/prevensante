/** Coquille de l'application : en-tête, barre latérale, navigation mobile. */

import type { ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

interface Entree {
  href: string;
  emoji: string;
  libelle: string;
  court?: string;
  compteur?: number;
}

const NAVIGATION: Entree[] = [
  { href: '/', emoji: '🏠', libelle: 'Tableau de bord', court: 'Accueil' },
  { href: '/signaler', emoji: '⚠️', libelle: 'Nouveau signalement' },
  { href: '/signalements', emoji: '📋', libelle: 'Signalements', court: 'Signalements', compteur: 24 },
  { href: '/actions', emoji: '✅', libelle: 'Actions correctives', court: 'Actions', compteur: 3 },
  { href: '/pilotage', emoji: '📊', libelle: 'Pilotage & rapports', court: 'Pilotage' },
  { href: '/assistant', emoji: '🤖', libelle: 'Assistant IA' },
  { href: '/notifications', emoji: '🔔', libelle: 'Notifications', compteur: 3 },
  { href: '/sites', emoji: '🏢', libelle: 'Sites & zones' },
  { href: '/profil', emoji: '👤', libelle: 'Profil & réglages', court: 'Profil' },
];

const NAV_BAS = NAVIGATION.filter((n) => n.court);

export function Coquille({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <>
      <header className="header">
        <Link className="brand" to="/">
          <span className="logo">⚕</span>
          <span>PrevEnSanté</span>
        </Link>
        <span className="spacer" />
        <div className="header-search">🔍 Rechercher un signalement, un site, une consigne…</div>
        <Link className="icon-btn" to="/notifications" title="Notifications" aria-label="Notifications">
          🔔
          <span className="badge-dot" />
        </Link>
        <div className="user-chip">
          <span className="avatar">SO</span>
          <span>
            <span className="who">Soumaïla O.</span>
            <span className="role">Responsable HSE</span>
          </span>
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar" aria-label="Navigation principale">
          <Link className="side-cta" to="/signaler">
            ⚠️ Signaler un danger
          </Link>
          <div className="side-label">Pilotage</div>
          {NAVIGATION.map((n) => (
            <NavLink
              key={n.href}
              to={n.href}
              end={n.href === '/'}
              className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
            >
              <span className="em">{n.emoji}</span>
              {n.libelle}
              {n.compteur !== undefined && <span className="count">{n.compteur}</span>}
            </NavLink>
          ))}
          <div className="side-label">Application</div>
          <a className="side-link" href="/showcase.html">
            <span className="em">🎨</span>Page de présentation
          </a>
          <a className="side-link" href="/prototype.html">
            <span className="em">📱</span>Prototype mobile
          </a>
        </nav>

        <main className="main">
          <div className="wrap">{children}</div>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navigation mobile">
        {NAV_BAS.map((n) => (
          <NavLink
            key={n.href}
            to={n.href}
            end={n.href === '/'}
            className={() => (pathname === n.href ? 'active' : '')}
          >
            <span className="em">{n.emoji}</span>
            {n.court}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
