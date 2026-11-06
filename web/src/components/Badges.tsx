import { statusLabel, severityLabel } from '../lib/i18n/labels';
import type { EventStatus, SeverityLevel } from '../data/types';

/**
 * Pastille de severite (section 13.3) : texte + icone, jamais la couleur
 * seule. Le niveau `critical` porte un filet haute visibilite.
 */
export function SeverityBadge({ level }: { level: SeverityLevel }) {
  const icon = level === 'critical' ? '⚠' : level === 'high' ? '▲' : level === 'medium' ? '◆' : '●';
  const label = severityLabel(level);
  return (
    <span className={`badge sev-${level}`}>
      <span className="icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}

const STATUS_ICONS: Record<string, string> = {
  submitted: '◷',
  under_review: '◍',
  triaged: '◈',
  in_progress: '◐',
  awaiting_verification: '⧗',
  closed: '✔',
  rejected: '✖',
  escalated: '⚑',
  to_do: '○',
  to_verify: '⧗',
  cancelled: '⊘',
};

/**
 * Pastille de statut (section 13.3) : une couleur par statut, une icone
 * differenciee et toujours le libelle textuel.
 */
export function StatusBadge({ status }: { status: EventStatus | string }) {
  const icon = STATUS_ICONS[status] ?? '●';
  const label = statusLabel(status);
  return (
    <span className={`badge status-${status}`}>
      <span className="icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}
