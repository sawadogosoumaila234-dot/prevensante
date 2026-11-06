import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { EmergencyNotice } from '../../components/EmergencyNotice';
import { Alert } from '../../components/Alert';
import { copyToClipboard } from '../../lib/format';
import { useState } from 'react';

interface SuccessState {
  reference?: string;
  anonymous?: boolean;
  kind?: string;
}

/**
 * Confirmation d'un signalement (route `/report/success`) : reference
 * copiable, rappel d'urgence et liens de suivi.
 */
export default function ReportSuccess() {
  const location = useLocation();
  const state = (location.state ?? {}) as SuccessState;
  const [copied, setCopied] = useState(false);

  return (
    <>
      <EmergencyNotice />
      <div className="panel">
        <h1 style={{ fontSize: 'var(--fs-22)' }}>Report recorded</h1>
        {state.anonymous ? (
          <Alert tone="info">
            Your report is recorded. Your identity is hidden from the safety team.
          </Alert>
        ) : (
          <p>Your report has been recorded and sent to the safety team.</p>
        )}

        <p style={{ marginTop: 16 }}>
          Reference:{' '}
          <span className="mono" style={{ fontSize: 'var(--fs-18)' }}>
            {state.reference ?? 'PES-2026-00000'}
          </span>{' '}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const ok = await copyToClipboard(state.reference ?? '');
              setCopied(ok);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </p>
        <p aria-live="polite" className="small muted">
          Keep this reference: the safety team uses it to follow up your report.
        </p>

        <div className="btn-row" style={{ marginTop: 24 }}>
          <Button>
            <Link to="/my-reports" style={{ color: 'inherit', textDecoration: 'none' }}>
              Track this report
            </Link>
          </Button>
          <Button variant="secondary">
            <Link to="/report" style={{ color: 'inherit', textDecoration: 'none' }}>
              Report another hazard
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
    </>
  );
}
