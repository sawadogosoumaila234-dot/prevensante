import type { ReactNode } from 'react';

export interface FilterBarProps {
  children: ReactNode;
  /** Filtres actifs, affiches en pastilles. */
  activeFilters?: { key: string; label: string; onRemove: () => void }[];
  onClearAll?: () => void;
  ariaLabel?: string;
}

/**
 * Barre de filtres (section 13.3) : filtres actifs en chips et action
 * « Clear all ».
 */
export function FilterBar({ children, activeFilters = [], onClearAll, ariaLabel = 'Filters' }: FilterBarProps) {
  const hasActive = activeFilters.length > 0;
  return (
    <div>
      <div className="filter-bar" role="search" aria-label={ariaLabel}>
        {children}
      </div>
      {hasActive ? (
        <div className="filter-chips">
          {activeFilters.map((f) => (
            <span className="filter-chip" key={f.key}>
              {f.label}
              <button type="button" onClick={f.onRemove} aria-label={`Remove filter ${f.label}`}>
                ×
              </button>
            </span>
          ))}
          {onClearAll ? (
            <button type="button" className="btn ghost sm" onClick={onClearAll}>
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
