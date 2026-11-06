import { formatDateTime, formatRelative } from '../lib/format';

export interface TimelineEntry {
  id: string;
  title: string;
  detail?: string;
  at: string;
  icon?: string;
}

export interface TimelineProps {
  entries: TimelineEntry[];
}

/**
 * Chronologie (section 13.3) : ligne verticale, evenements en anglais, date
 * relative avec date absolue dans l attribut `title`.
 */
export function Timeline({ entries }: TimelineProps) {
  return (
    <div className="timeline">
      {entries.map((entry) => (
        <div className="tl-item" key={entry.id}>
          <span className="dot" aria-hidden="true">
            {entry.icon ?? '•'}
          </span>
          <div className="tl-content">
            <p className="tl-title">{entry.title}</p>
            {entry.detail ? <p className="tl-detail">{entry.detail}</p> : null}
            <p className="tl-detail" title={formatDateTime(entry.at)}>
              {formatRelative(entry.at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
