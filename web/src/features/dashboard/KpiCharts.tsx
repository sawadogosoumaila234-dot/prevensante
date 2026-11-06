interface BarDatum {
  label: string;
  value: number;
}

interface Props {
  title: string;
  data: BarDatum[];
  unit?: string;
}

/**
 * Graphique KPI en SVG (sans dependance externe).
 *
 * Ce module est charge dynamiquement (`React.lazy`) : il ne fait pas partie
 * du bundle initial, conformement au budget de performance (section 11.5).
 */
export default function KpiCharts({ title, data, unit }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <section className="panel" aria-label={title}>
      <h2 style={{ fontSize: 'var(--fs-18)' }}>{title}</h2>
      {data.length === 0 ? (
        <p className="muted">No data to display.</p>
      ) : (
        <svg
          className="chart"
          viewBox={`0 0 ${Math.max(240, data.length * 56)} 160`}
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
          preserveAspectRatio="xMinYMin meet"
        >
          {data.map((datum, index) => {
            const height = Math.round((datum.value / max) * 120);
            const x = index * 56 + 12;
            const y = 140 - height;
            return (
              <g key={datum.label}>
                <rect x={x} y={y} width={32} height={height} rx={4} className="chart-bar" />
                <text x={x + 16} y={154} textAnchor="middle" className="chart-label">
                  {datum.label}
                </text>
                <text x={x + 16} y={Math.max(12, y - 6)} textAnchor="middle" className="chart-value">
                  {datum.value}
                  {unit ?? ''}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
