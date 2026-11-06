import { useOnline } from '../lib/hooks';

export const OFFLINE_MESSAGE =
  'You are offline. You can review saved data, but new reports need a connection.';

/**
 * Bandeau hors-ligne (section 13.3) : fixe en bas, non bloquant.
 * Aucune soumission n'est garantie hors-ligne.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span aria-hidden="true">⚠</span>
      <span>{OFFLINE_MESSAGE}</span>
    </div>
  );
}
