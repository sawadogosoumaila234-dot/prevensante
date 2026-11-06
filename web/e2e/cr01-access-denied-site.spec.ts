import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR01 — Perimetre de lecture : ce que la RLS autorise.
 *
 * Regle SQL (`supabase/migrations/0011_rls_policies.sql`) :
 *   - `safety_events_select_scoped` : `reporter_id = auth.uid()`
 *     OU `public.can_access_site(site_id)` ;
 *   - `public.can_access_site` : administrateur, site de rattachement, ou role
 *     HSE / direction / medecin du travail dans la **meme organisation**.
 *
 * Jeu de demonstration : `org-1` porte `site-1` et `site-2`, `org-2` porte
 * `site-3`. `evt-6` (PES-2026-00037) est du site 2, `evt-7` (PES-2026-00036)
 * est du site 3 mais a ete declare par `usr-worker`.
 */
test('CR01 — un salarie voit son propre signalement, meme hors de son site', async ({ page }) => {
  await loginAs(page, 'Worker');

  // `evt-7` est du site 3 (organisation `org-2`) : le salarie y accede parce
  // qu'il l'a declare (`reporter_id = auth.uid()`), pas parce que le site
  // est dans son perimetre.
  await page.goto('/my-reports/evt-7');

  const text = await pageText(page);
  expect(text).toContain('PES-2026-00036');
  expect(text).not.toContain('Access denied');
  expect(text).not.toContain('Report not found');
});

test('CR01 — le HSE voit les sites de son organisation', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  // `evt-6` est du site 2, qui appartient a `org-1` comme le HSE : l'evenement
  // est lisible (`can_access_site`).
  await page.goto('/hse/events/evt-6');

  const text = await pageText(page);
  expect(text).toContain('PES-2026-00037');
  expect(text).not.toContain('Access denied');
});

test('CR01 — le HSE n accede pas aux sites d une autre organisation', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  // `evt-7` est du site 3, qui appartient a `org-2` : la RLS renvoie 0 ligne.
  await page.goto('/hse/events/evt-7');

  const text = await pageText(page);
  expect(text).toContain('Access denied');
  expect(text).toContain('You are not allowed to access this site.');
  // Aucune donnee du site 3 dans la reponse.
  expect(text).not.toContain('PES-2026-00036');
});

test('CR01 — la liste des evenements reste dans le perimetre', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/events');
  const list = await pageText(page);

  // Le site 2 est dans l'organisation du HSE : ses evenements sont visibles.
  expect(list).toContain('PES-2026-00037');
  // Le site 3 appartient a une autre organisation : rien ne doit apparaitre.
  expect(list).not.toContain('PES-2026-00036');
  // Le site 1 est visible.
  expect(list).toContain('PES-2026-00042');
});

test('CR01 — un salarie sans acces HSE ne peut pas ouvrir l espace metier', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/hse/events/evt-6');

  const text = await pageText(page);
  expect(text).toContain('Access denied');
  expect(text).not.toContain('PES-2026-00037');
});
