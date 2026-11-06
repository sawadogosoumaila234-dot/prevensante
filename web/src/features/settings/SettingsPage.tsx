import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { listSites } from '../../lib/api';
import { useInstallPrompt } from '../../lib/hooks';
import { ROLE_LABELS } from '../../lib/i18n/labels';
import NotificationSettings from '../notifications/NotificationSettings';

/**
 * Reglages du profil (route `/settings`) : identite, site, preferences de
 * notification et installation de l'application.
 */
export default function SettingsPage() {
  const { user, profiles, switchProfile } = useSession();
  const { canInstall, install } = useInstallPrompt();
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const [message, setMessage] = useState('');

  const site = sites?.find((s) => s.id === user?.site_id);

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p className="sub">Profile, site and notification preferences.</p>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Profile</h2>
        <dl className="dl-grid">
          <dt>Full name</dt>
          <dd>{user?.full_name ?? '—'}</dd>
          <dt>Email</dt>
          <dd>{user?.email ?? '—'}</dd>
          <dt>Role</dt>
          <dd>{user ? ROLE_LABELS[user.role] : '—'}</dd>
          <dt>Job title</dt>
          <dd>{user?.job_title ?? '—'}</dd>
          <dt>Phone</dt>
          <dd>{user?.phone ?? '—'}</dd>
          <dt>Site</dt>
          <dd>{site ? `${site.name} (${site.code ?? site.id})` : 'All sites in scope'}</dd>
          <dt>Medical data access</dt>
          <dd>{user?.is_medical_authorized ? 'Authorised' : 'Not authorised'}</dd>
        </dl>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Application</h2>
        <div className="row-between">
          <div>
            <p className="title">Install app</p>
            <p className="small muted">
              Install PrevEnSanté on this device to open it in standalone mode and keep the shell
              available offline.
            </p>
          </div>
          <Button
            variant={canInstall ? 'primary' : 'secondary'}
            disabled={!canInstall}
            onClick={() => {
              void install().then(() => setMessage('The application has been installed.'));
            }}
          >
            Install app
          </Button>
        </div>
      </section>

      <div style={{ marginTop: 16 }}>
        <NotificationSettings />
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Demonstration profiles</h2>
        <p className="small muted">
          Switch profile to check the role, MFA and site-scope guards. Available in demonstration mode
          only.
        </p>
        {profiles.length > 0 ? (
          <div className="stack">
            {profiles.map((profile) => (
              <div className="row-between" key={profile.id}>
                <div>
                  <p className="title">{profile.full_name}</p>
                  <p className="small muted">
                    {ROLE_LABELS[profile.role]} — {profile.email ?? 'no email'}
                  </p>
                </div>
                <Button
                  variant={profile.id === user?.id ? 'secondary' : 'primary'}
                  onClick={() => {
                    switchProfile(profile.id);
                    setMessage(`The active profile is now ${profile.full_name}.`);
                  }}
                >
                  {profile.id === user?.id ? 'Active' : 'Use this profile'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No profile available" />
        )}
      </section>
    </>
  );
}
