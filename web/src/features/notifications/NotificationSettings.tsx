import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { listAppSettings } from '../../lib/api';
import { upsertAppSetting } from '../../lib/mutations';

const KEY = 'notifications';

/**
 * Preferences de notification (section `/settings` — « preferences »).
 *
 * Stockees dans `app_settings` (`key`, `value` jsonb).
 */
export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: listAppSettings,
    staleTime: 60_000,
  });
  const [message, setMessage] = useState('');

  const current = (() => {
    const row = settings?.find((s) => s.key === KEY);
    const value = (row?.value ?? {}) as Record<string, unknown>;
    return {
      email_enabled: value.email_enabled !== false,
      sms_enabled: value.sms_enabled !== false,
      in_app_enabled: value.in_app_enabled !== false,
    };
  })();

  const save = useMutation({
    mutationFn: (next: Record<string, boolean>) => upsertAppSetting(KEY, next),
    onSuccess: () => {
      setMessage('The notification preferences have been saved.');
      void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
    onError: () => setMessage('The notification preferences could not be saved.'),
  });

  const toggle = (key: 'email_enabled' | 'sms_enabled' | 'in_app_enabled', label: string, description: string) => (
    <div className="row-between">
      <div>
        <p className="title">{label}</p>
        <p className="small muted">{description}</p>
      </div>
      <Button
        variant={current[key] ? 'secondary' : 'primary'}
        onClick={() => save.mutate({ ...current, [key]: !current[key] })}
      >
        {current[key] ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );

  return (
    <section className="panel" aria-labelledby="notification-preferences-title">
      <h2 id="notification-preferences-title" style={{ fontSize: 'var(--fs-18)' }}>
        Notification preferences
      </h2>
      {message ? <Alert tone="success">{message}</Alert> : null}
      <div className="stack">
        {toggle('in_app_enabled', 'In-app notifications', 'Show notifications inside the application.')}
        {toggle('email_enabled', 'Email notifications', 'Send a copy of every notification by email.')}
        {toggle('sms_enabled', 'SMS notifications', 'Send critical escalations by SMS.')}
      </div>
    </section>
  );
}
