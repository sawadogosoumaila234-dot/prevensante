import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { listNotifications } from '../../lib/api';
import { markNotificationRead } from '../../lib/mutations';
import { formatDateTime } from '../../lib/format';
import { t } from '../../lib/i18n/en';

/** Canal de diffusion deduit du `kind` de la notification (`notifications.kind`). */
const NOTIFICATION_CHANNELS: Record<string, string> = {
  critical_event: 'In application + email',
  new_event: 'In application',
  escalation: 'SMS + email',
  overdue_action: 'Email',
  action_submitted: 'In application + email',
};

/**
 * Centre de notifications (route `/notifications`).
 *
 * Le canal de notification est visible : la source de la notification est
 * affichee pour que l'utilisateur sache s'il doit agir par telephone, par
 * mail ou dans l'application.
 */
export default function NotificationsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => listNotifications(user?.id ?? ''),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = (data ?? []).filter((n) => (filter === 'unread' ? !n.read_at : true));
  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>{t('nav.notifications')}</h1>
          <p className="sub">
            {unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'No unread notification'}
          </p>
        </div>
        <div className="head-actions">
          <Button variant="secondary" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Notification filter">
        <button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </button>
        <button type="button" role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>
          Unread
        </button>
      </div>

      {isError ? (
        <div className="panel" role="alert">
          <p>The notifications could not be loaded.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading…</p>
      ) : notifications.length > 0 ? (
        notifications.map((notification) => (
          <article className={`card notification${notification.read_at ? '' : ' unread'}`} key={notification.id}>
            <div className="row-between">
              <div>
                <p className="title">{notification.title}</p>
                <p className="body">{notification.body}</p>
              </div>
              <span className={`badge ${notification.severity === 'critical' ? 'status-escalated' : 'status-in-progress'}`}>
                <span className="icon" aria-hidden="true">
                  {notification.severity === 'critical' ? '⚑' : 'ℹ'}
                </span>
                {NOTIFICATION_CHANNELS[notification.kind] ?? 'In application'}
              </span>
            </div>
            <div className="row-between" style={{ marginTop: 8 }}>
              <span className="small muted">{formatDateTime(notification.created_at)}</span>
              {!notification.read_at ? (
                <Button variant="ghost" size="sm" onClick={() => markRead.mutate(notification.id)}>
                  Mark as read
                </Button>
              ) : null}
            </div>
          </article>
        ))
      ) : (
        <EmptyState title={t('empty.notifications')} message="You have no notification in this category." />
      )}

      <Alert tone="info">
        Notifications are sent by email, SMS and in-app. The channel of each notification is shown
        above.
      </Alert>
    </>
  );
}
