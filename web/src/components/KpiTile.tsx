export interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: string;
  source?: string;
  tone?: 'default' | 'late' | 'warning' | 'success' | 'info';
}

/**
 * Tuile KPI (section 13.3) : valeur grande, libelle, variation, source.
 */
export function KpiTile({ label, value, delta, source, tone = 'default' }: KpiTileProps) {
  return (
    <div className={`kpi${tone !== 'default' ? ` ${tone}` : ''}`}>
      <span className="kpi-bar" aria-hidden="true" />
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {delta ? <p className="kpi-delta">{delta}</p> : null}
      {source ? <p className="kpi-source">{source}</p> : null}
    </div>
  );
}
