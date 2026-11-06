import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { listSafetyEvents, listCorrectiveActions } from '../../lib/api';
import { t } from '../../lib/i18n/en';

/**
 * Accueil de l'espace salarie (route `/`) : « Report a hazard », « My
 * reports » et « Safety instructions ».
 */
export default function HomePage() {
  const { user } = useSession();

  const { data: events } = useQuery({
    queryKey: ['my-events', user?.id],
    queryFn: () => listSafetyEvents({ reporter_id: user?.id }, null, 5),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const { data: actions } = useQuery({
    queryKey: ['my-actions', user?.id],
    queryFn: () => listCorrectiveActions({ owner_id: user?.id }, null, 5),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  return (
    <>
      <div className="page-head">
        <h1>Welcome, {user?.full_name?.split(' ')[0] ?? 'there'}</h1>
        <p className="sub">
          Report a hazard, follow up your reports, and read the validated safety instructions for your
          site.
        </p>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>{t('nav.report')}</h3>
          <p className="card-sub">
            Describe what you observed. Photos are compressed on your device before being sent.
          </p>
          <Button>
            <Link to="/report" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('nav.report')}
            </Link>
          </Button>
        </div>
        <div className="card">
          <h3>{t('nav.myReports')}</h3>
          <p className="card-sub">
            {events?.total ?? 0} report(s) and {actions?.total ?? 0} corrective action(s) linked to
            you.
          </p>
          <Button variant="secondary">
            <Link to="/my-reports" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('nav.myReports')}
            </Link>
          </Button>
        </div>
        <div className="card">
          <h3>{t('nav.instructions')}</h3>
          <p className="card-sub">Search the corpus of validated instructions for your sector.</p>
          <Button variant="secondary">
            <Link to="/instructions" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('nav.instructions')}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
