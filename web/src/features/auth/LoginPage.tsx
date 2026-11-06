import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { FormField } from '../../components/FormField';
import { ROLE_LABELS } from '../../lib/i18n/labels';
import { supabaseConfigure } from '../../lib/supabase/client';

/**
 * Connexion + challenge MFA (route `/login`).
 *
 * Le second facteur est obligatoire avant d'entrer dans l'application : la
 * session n'est consideree authentifiee qu'apres validation du code.
 */
export default function LoginPage() {
  const { user, mfa_pending, signIn, completeMfa, profiles, switchProfile } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (user && user.mfa_verified && !mfa_pending) return <Navigate to={from} replace />;

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result === 'invalid') setError('The email address or the password is incorrect.');
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const ok = await completeMfa(code);
    setBusy(false);
    if (!ok) {
      setError('The verification code is incorrect.');
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="row" style={{ marginBottom: 16 }}>
          <span className="logo" aria-hidden="true" style={{ background: 'var(--color-accent)', color: 'var(--text-on-accent)', width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            PE
          </span>
          <div>
            <h1 style={{ fontSize: 'var(--fs-22)' }}>PrevEnSanté</h1>
            <p className="small muted">Workplace risk prevention</p>
          </div>
        </div>

        {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}

        {mfa_pending ? (
          <form onSubmit={submitCode} noValidate>
            <FormField id="code" label="Verification code" required helper="Enter the 6-digit code from your authenticator application.">
              <input
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </FormField>
            <Button type="submit" block loading={busy}>
              Verify
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCredentials} noValidate>
            <FormField id="email" label="Email address" required>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <FormField id="password" label="Password" required>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" block loading={busy}>
              Sign in
            </Button>
          </form>
        )}

        <hr className="divider" />
        {/*
          Les profils de demonstration n'ont de sens que hors Supabase : en
          production, un clic ne doit pas ouvrir une session HSE sans mot de
          passe. Le bloc disparait des que la vraie base est configuree.
        */}
        {supabaseConfigure ? null : (
          <>
            <p className="small muted">
              Demonstration accounts — pick a profile to explore the four spaces. The MFA code is{' '}
              <span className="mono">123456</span>.
            </p>
            <div className="btn-row" style={{ marginTop: 8 }}>
              {profiles.map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    switchProfile(p.id);
                    navigate(from, { replace: true });
                  }}
                >
                  {ROLE_LABELS[p.role]}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
