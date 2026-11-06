import { Link } from 'react-router-dom';
import { SeverityBadge, StatusBadge } from './Badges';
import { t } from '../lib/i18n/en';
import { formatRelative } from '../lib/format';
import type { SafetyEvent } from '../data/types';

export interface EventCardProps {
  event: SafetyEvent;
  siteName?: string;
  zoneName?: string;
  to?: string;
}

/**
 * Carte d'evenement (section 13.3) : reference en mono, type, statut,
 * severite, anciennete, site/zone, vignette photo 72 px.
 */
export function EventCard({ event, siteName, zoneName, to }: EventCardProps) {
  const photo = event.photo_paths?.[0];
  const body = (
    <div className="action-card event-card">
      {photo ? (
        <img className="thumb" src={photo} alt="" loading="lazy" decoding="async" width={72} height={72} />
      ) : (
        <div className="thumb" aria-hidden="true" />
      )}
      <div className="body">
        <div className="row-between">
          <span className="mono">{event.reference}</span>
          <span className="small muted">{formatRelative(event.reported_at)}</span>
        </div>
        <p className="desc">{event.description}</p>
        <div className="tags">
          <StatusBadge status={event.status} />
          <SeverityBadge level={event.severity} />
          <span className="chip neutral">{t(`kind.${event.kind}` as 'kind.danger')}</span>
          {siteName ? <span className="chip neutral">{siteName}</span> : null}
          {zoneName ? <span className="chip neutral">{zoneName}</span> : null}
          {event.is_anonymous ? <span className="chip neutral">Anonymous reporter</span> : null}
        </div>
      </div>
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  );
}
