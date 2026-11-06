import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { FormField } from '../../components/FormField';
import { listAppSettings, listOrganizations, listSites } from '../../lib/api';
import { upsertAppSetting } from '../../lib/mutations';

/**
 * Reglages globaux de l'instance (route `/admin/settings`) : nom de
 * l'instance, site pilote, mode email / SMS / IA, chaine d'escalade, seuils
 * de notification. Action `Save`.
 */
export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['app-settings'], queryFn: listAppSettings, staleTime: 60_000 });
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations, staleTime: 60_000 });

  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, string> = {};
    for (const setting of settings) {
      const value = setting.value;
      if (typeof value === 'string') next[setting.key] = value;
      else if (value && typeof value === 'object') {
        const first = Object.values(value as Record<string, unknown>)[0];
        next[setting.key] = typeof first === 'string' ? first : String(first ?? '');
      }
    }
    setForm(next);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(form)) {
        await upsertAppSetting(key, value);
      }
    },
    onSuccess: () => {
      setMessage('The settings have been saved.');
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
    onError: () => setError('The settings could not be saved.'),
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Instance settings</h1>
          <p className="sub">Global configuration of the instance.</p>
        </div>
        <div className="head-actions">
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}

      <section className="panel">
        <div className="form-grid">
          <FormField id="setting-instance-name" label="Instance name">
            <input
              id="setting-instance-name"
              className="input"
              type="text"
              value={form.instance_name ?? ''}
              onChange={(e) => set('instance_name', e.target.value)}
            />
          </FormField>

          <FormField id="setting-pilot-site" label="Pilot site">
            <select
              id="setting-pilot-site"
              className="select"
              value={form.pilot_site_id ?? ''}
              onChange={(e) => set('pilot_site_id', e.target.value)}
            >
              <option value="">Not set</option>
              {(sites ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="setting-organization" label="Organization">
            <select
              id="setting-organization"
              className="select"
              value={form.organization_id ?? ''}
              onChange={(e) => set('organization_id', e.target.value)}
            >
              <option value="">Not set</option>
              {(orgs ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="setting-escalation" label="Escalation chain" helper="Role notified first when an event is escalated.">
            <select
              id="setting-escalation"
              className="select"
              value={form.escalation_chain ?? ''}
              onChange={(e) => set('escalation_chain', e.target.value)}
            >
              <option value="supervisor">Supervisor</option>
              <option value="hse_officer">HSE officer</option>
              <option value="site_director">Site director</option>
            </select>
          </FormField>

          <FormField id="setting-email-mode" label="Email mode">
            <select
              id="setting-email-mode"
              className="select"
              value={form.email_mode ?? 'enabled'}
              onChange={(e) => set('email_mode', e.target.value)}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </FormField>

          <FormField id="setting-sms-mode" label="SMS mode">
            <select
              id="setting-sms-mode"
              className="select"
              value={form.sms_mode ?? 'enabled'}
              onChange={(e) => set('sms_mode', e.target.value)}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </FormField>

          <FormField id="setting-ai-mode" label="AI mode">
            <select
              id="setting-ai-mode"
              className="select"
              value={form.ai_mode ?? 'on'}
              onChange={(e) => set('ai_mode', e.target.value)}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </FormField>

          <FormField id="setting-threshold" label="Notification threshold" helper="Delay in hours before an open event is escalated.">
            <input
              id="setting-threshold"
              className="input"
              type="number"
              min={1}
              value={form.notification_threshold_hours ?? '48'}
              onChange={(e) => set('notification_threshold_hours', e.target.value)}
            />
          </FormField>
        </div>
      </section>
    </>
  );
}
