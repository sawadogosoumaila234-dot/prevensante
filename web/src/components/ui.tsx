/** Composants d'interface réutilisables — design system PrevEnSanté. */

import type { ReactNode } from 'react';
import { LIBELLE_CATEGORIE, LIBELLE_STATUT, VARIANTE_STATUT } from '../lib/format';

/* ── CARTES ──────────────────────────────────────────── */

export function Card({
  titre,
  sousTitre,
  actions,
  children,
  className = '',
}: {
  titre?: string;
  sousTitre?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(titre || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          {titre && <h3 style={{ margin: 0 }}>{titre}</h3>}
          {actions}
        </div>
      )}
      {sousTitre && <div className="card-sub">{sousTitre}</div>}
      {children}
    </section>
  );
}

/* ── KPI ──────────────────────────────────────────────── */

export function Stat({
  variante = 'total',
  label,
  valeur,
  tendance,
  trendClass,
}: {
  variante?: 'total' | 'open' | 'late' | 'closed' | 'ai' | 'info';
  label: string;
  valeur: ReactNode;
  tendance?: ReactNode;
  trendClass?: 'up' | 'down';
}) {
  return (
    <div className={`stat ${variante}`}>
      <div className="bar" />
      <div className="label">{label}</div>
      <div className="value">{valeur}</div>
      {tendance && <div className={`trend ${trendClass ?? ''}`}>{tendance}</div>}
    </div>
  );
}

/* ── ÉTAT ─────────────────────────────────────────────── */

export function Chip({ variante, children }: { variante: string; children: ReactNode }) {
  return <span className={`chip ${variante}`}>{children}</span>;
}

export function Alert({
  variante = 'info',
  emoji,
  titre,
  children,
}: {
  variante?: 'danger' | 'info' | 'warn' | 'ok' | 'purple';
  emoji: string;
  titre?: string;
  children: ReactNode;
}) {
  return (
    <div className={`alert ${variante}`}>
      <span className="em">{emoji}</span>
      <div>
        {titre && <b>{titre}</b>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ emoji = '📭', children }: { emoji?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="em">{emoji}</span>
      {children}
    </div>
  );
}

/* ── FILTRES ──────────────────────────────────────────── */

export interface FiltreOption {
  cle: string;
  libelle: string;
}

export function Filtres({
  options,
  valeur,
  onChange,
}: {
  options: FiltreOption[];
  valeur: string;
  onChange: (cle: string) => void;
}) {
  return (
    <div className="filters">
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          className={`filter ${valeur === o.cle ? 'active' : ''}`}
          onClick={() => onChange(o.cle)}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

export function Segments<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: { cle: T; libelle: string }[];
  valeur: T;
  onChange: (cle: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          className={valeur === o.cle ? 'active' : ''}
          onClick={() => onChange(o.cle)}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/* ── GRAPHIQUES ───────────────────────────────────────── */

export function Barres({
  donnees,
}: {
  donnees: { label: string; valeur: number; couleur?: string }[];
}) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  return (
    <div className="bars">
      {donnees.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="lb">{d.label}</span>
          <span className="track">
            <i
              style={{
                width: `${((d.valeur / max) * 100).toFixed(1)}%`,
                background: d.couleur ?? undefined,
              }}
            />
          </span>
          <span className="vv">{d.valeur}</span>
        </div>
      ))}
    </div>
  );
}

export function Histogramme({
  donnees,
  suffixe = '',
}: {
  donnees: { mois: string; valeur: number }[];
  suffixe?: string;
}) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  return (
    <div className="chart">
      {donnees.map((d) => (
        <div className="col" key={d.mois}>
          <div className="b" style={{ height: `${((d.valeur / max) * 100).toFixed(1)}%` }} title={`${d.valeur}${suffixe}`} />
          <div className="x">{d.mois}</div>
        </div>
      ))}
    </div>
  );
}

/* ── LISTES ───────────────────────────────────────────── */

export function ListeItem({
  emoji,
  titre,
  detail,
  droite,
}: {
  emoji: string;
  titre: ReactNode;
  detail?: ReactNode;
  droite?: ReactNode;
}) {
  return (
    <div className="list-item">
      <span className="em">{emoji}</span>
      <div className="t">
        {titre}
        {detail && <div className="d">{detail}</div>}
      </div>
      {droite}
    </div>
  );
}

export function Interrupteur({
  actif,
  onChange,
  titre,
  detail,
}: {
  actif: boolean;
  onChange: (valeur: boolean) => void;
  titre: string;
  detail?: string;
}) {
  return (
    <div className="switch-row">
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{titre}</div>
        {detail && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{detail}</div>}
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={actif}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={titre}
        />
        <span className="track" />
        <span className="thumb" />
      </label>
    </div>
  );
}

/* ── CHAMP DE FORMULAIRE ───────────────────────────────── */

export function Champ({
  label,
  requis,
  hint,
  children,
}: {
  label: string;
  requis?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label} {requis && <span className="req">*</span>}
      </label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* ── PIÈCE JOINTE DE SIGNALEMENT ───────────────────────── */

export function SignalementItem({
  type,
  titre,
  reference,
  meta,
  description,
  tags,
}: {
  type: 'danger' | 'incident' | 'accident';
  titre: string;
  reference?: string;
  meta?: string;
  description?: string;
  tags?: ReactNode;
}) {
  const emoji = type === 'danger' ? '⚠️' : type === 'incident' ? '⚡' : '🚑';
  return (
    <div className="item">
      <div className={`ic ${type}`}>{emoji}</div>
      <div className="body">
        <div className="row1">
          <span className="title">{titre}</span>
          {reference && <span className="id">{reference}</span>}
        </div>
        {meta && <div className="meta">{meta}</div>}
        {description && <div className="desc">{description}</div>}
        {tags && <div className="tags">{tags}</div>}
      </div>
    </div>
  );
}

export function ActionCard({
  titre,
  statut,
  statutLibelle,
  enRetard,
  responsable,
  echeance,
  site,
  reference,
  avancement,
}: {
  titre: string;
  statut: string;
  statutLibelle?: string;
  enRetard?: boolean;
  responsable: string;
  echeance: string;
  site: string;
  reference: string;
  avancement: number;
}) {
  return (
    <div className={`action-card${enRetard ? ' late' : ''}`}>
      <div className="top">
        <span className="t">{titre}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip variante={VARIANTE_STATUT[statut] ?? 'todo'}>{statutLibelle ?? LIBELLE_STATUT[statut] ?? statut}</Chip>
          {enRetard && <Chip variante="late">En retard</Chip>}
        </span>
      </div>
      <div className="who">
        <span>👤 {responsable}</span>
        <span>📅 {echeance}</span>
        <span>🏢 {site}</span>
        <span>🔗 {reference}</span>
      </div>
      <div className="progress">
        <div className="fill" style={{ width: `${avancement}%` }} />
      </div>
    </div>
  );
}

/** Étiquette de catégorie de risque. */
export function ChipCategorie({ categorie }: { categorie: string | null }) {
  if (!categorie) return null;
  return <Chip variante="cat">{LIBELLE_CATEGORIE[categorie] ?? categorie}</Chip>;
}