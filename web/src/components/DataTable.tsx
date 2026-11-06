import type { ReactNode } from 'react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  keyOf: (row: T) => string;
  emptyTitle: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  /** Tri actif : nom de colonne + sens. */
  sort?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
  /** Curseur de pagination ; `null` = pas de page suivante. */
  nextCursor?: string | null;
  total?: number;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  pageIndex?: number;
  exportCsv?: () => void;
  error?: string | null;
}

/**
 * Tableau de donnees (section 13.3) : tri, pagination par curseur, export CSV,
 * etats vide et erreur.
 */
export function DataTable<T>({
  rows,
  columns,
  keyOf,
  emptyTitle,
  emptyMessage,
  emptyAction,
  sort,
  onSort,
  nextCursor,
  total,
  onNextPage,
  onPreviousPage,
  pageIndex = 0,
  exportCsv,
  error,
}: DataTableProps<T>) {
  if (error) {
    return (
      <div className="empty-state" role="alert">
        <span className="empty-icon" aria-hidden="true">
          ⚠
        </span>
        <p className="empty-title">The data could not be loaded</p>
        <p>{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="data">
          <caption className="visually-hidden">
            {total !== undefined ? `${total} rows` : `${rows.length} rows`}
          </caption>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th key={col.key} scope="col" style={col.width ? { width: col.width } : undefined}>
                    {col.sortValue && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        aria-label={`Sort by ${col.header}`}
                      >
                        {col.header}
                        {active ? (sort?.direction === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={keyOf(row)}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span className="small muted">
          {total !== undefined ? `${total} row(s)` : `${rows.length} row(s)`}
        </span>
        <div className="btn-row">
          {exportCsv ? (
            <Button variant="ghost" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={onPreviousPage}
            disabled={!onPreviousPage || pageIndex === 0}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNextPage}
            disabled={!nextCursor || !onNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
