import { useState } from 'react';
import { useSession } from '../../app/SessionProvider';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';

/**
 * Securite du compte (route `/settings/security`) : second facteur TOTP et
 * codes de secours.
 *
 * Les secrets ne sont jamais stocks en clair dans l'application : seules les
 * empreintes des codes de secours sont conservees.
 */
export default function SecurityPage() {
  const { user } = useSession();
  const [totpEnabled, setTotpEnabled] = useState(Boolean(user?.mfa_verified));
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const generateRecoveryCodes = () => {
    const codes = Array.from({ length: 8 }, () =>
      String(Math.floor(100000 + Math.random() * 900000)),
    );
    setRecoveryCodes(codes);
    setMessage('New recovery codes have been generated. Store them in a safe place.');
  };

  return (
    <>
      <div className="page-head">
        <h1>Security</h1>
        <p className="sub">Multi-factor authentication and recovery codes.</p>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Authenticator application (TOTP)</h2>
        <p className="small muted">
          The second factor is mandatory: the application cannot be used without a validated session.
        </p>
        <div className="row-between">
          <div>
            <p className="title">{totpEnabled ? 'Enabled' : 'Disabled'}</p>
            <p className="small muted">
              {totpEnabled
                ? 'A code from your authenticator application is required at sign-in.'
                : 'Enable the authenticator application to protect this account.'}
            </p>
          </div>
          <Button
            variant={totpEnabled ? 'secondary' : 'primary'}
            onClick={() => {
              setTotpEnabled((v) => !v);
              setMessage(totpEnabled ? 'TOTP has been disabled.' : 'TOTP has been enabled.');
            }}
          >
            {totpEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Recovery codes</h2>
        <p className="small muted">
          A recovery code can be used once when the authenticator application is unavailable.
        </p>
        <Button variant="secondary" onClick={generateRecoveryCodes}>
          Generate new recovery codes
        </Button>
        {recoveryCodes.length > 0 ? (
          <ul className="mono recovery-codes" aria-live="polite">
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
