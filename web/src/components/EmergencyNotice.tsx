import { t } from '../lib/i18n/en';

/**
 * Bandeau d'urgence (section 13.3) : pleine largeur, fond critique, texte
 * blanc, non fermable. Il rappelle que l'application ne remplace pas les
 * procedures d'urgence du site (CR07).
 */
export function EmergencyNotice() {
  return (
    <div className="emergency-notice" role="alert">
      <span aria-hidden="true">⚠</span>
      <span>{t('emergency.banner')}</span>
    </div>
  );
}
