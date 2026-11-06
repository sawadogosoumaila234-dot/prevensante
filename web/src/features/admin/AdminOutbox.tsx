import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DataTable, type Column } from '../../components/DataTable';
import { listEmailOutbox, listSmsOutbox } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { EmailOutbox } from '../../data/types';

/**
 * Emails et SMS envoyes (route `/admin/outbox`) : destinataire, gabarit,
 * sujet, statut, erreur.
 */
export default function AdminOutbox() {
  const [tab, setTab] = useState<'email' | 'sms'>('email');

  const { data: emails, isLoading } = useQuery({
    queryKey: ['email-outbox'],
    queryFn: listEmailOutbox,
    staleTime: 60_000,
  });
  const { data: sms } = useQuery({ queryKey: ['sms-outbox'], queryFn: listSmsOutbox, staleTime: 60_000 });

  const emailColumns: Column<EmailOutbox>[] = [
    { key: 'to_email', header: 'Recipient', render: (e) => e.to_email },
    { key: 'template', header: 'Template', render: (e) => e.template },
    { key: 'subject', header: 'Subject', render: (e) => e.subject },
    { key: 'status', header: 'Status', render: (e) => e.status },
    { key: 'attempts', header: 'Attempts', render: (e) => e.attempts },
    { key: 'error', header: 'Error', render: (e) => e.last_error ?? '—' },
    { key: 'created_at', header: 'Date', render: (e) => formatDateTime(e.created_at) },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Message outbox</h1>
        <p className="sub">Emails and SMS prepared by the application, with their delivery status.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Outbox channel">
        <button type="button" role="tab" aria-selected={tab === 'email'} onClick={() => setTab('email')}>
          Email
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sms'} onClick={() => setTab('sms')}>
          SMS
        </button>
      </div>

      <section className="panel">
        {tab === 'email' ? (
          isLoading ? (
            <p className="muted">Loading…</p>
          ) : (
            <DataTable
              rows={emails ?? []}
              columns={emailColumns}
              keyOf={(e) => e.id}
              emptyTitle="No email in the outbox"
              total={emails?.length ?? 0}
            />
          )
        ) : (sms ?? []).length > 0 ? (
          <DataTable
            rows={sms ?? []}
            keyOf={(s) => s.id}
            emptyTitle="No SMS in the outbox"
            total={sms?.length ?? 0}
            columns={[
              { key: 'to_phone', header: 'Recipient', render: (s) => s.to_phone },
              { key: 'body', header: 'Message', render: (s) => s.body },
              { key: 'status', header: 'Status', render: (s) => s.status },
              { key: 'attempts', header: 'Attempts', render: (s) => s.attempts },
              { key: 'error', header: 'Error', render: (s) => s.last_error ?? '—' },
              { key: 'created_at', header: 'Date', render: (s) => formatDateTime(s.created_at) },
            ]}
          />
        ) : (
          <EmptyState title="No SMS in the outbox" />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Available actions</h2>
        <div className="btn-row">
          <Button variant="secondary">Resend</Button>
          <Button variant="secondary">Mark as failed</Button>
          <Button variant="secondary">Open payload</Button>
        </div>
      </section>
    </>
  );
}
