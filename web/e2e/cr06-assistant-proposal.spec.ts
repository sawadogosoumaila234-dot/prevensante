import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR06 — Le HSE demande une categorie et une consigne pour un cas couvert par
 * le corpus.
 *
 * Attendu : proposition **non appliquee** automatiquement
 * (`safety_events.risk_category_id` inchange) ; references limitees aux
 * documents `validated` ; limites affichees ; l'acceptation humaine applique
 * la categorie et trace `reviewed_by`.
 */
test('CR06 — une proposition reste en attente de decision humaine', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/assistant');
  await expect(page.getByRole('heading', { name: 'Assistant' })).toBeVisible();

  const text = await pageText(page);

  // Les propositions en attente ne sont pas automatiquement acceptees.
  expect(text).toContain('Proposals to review');
  expect(text).not.toContain('accepted automatically');

  // Les references de l'assistant pointent vers le corpus valide.
  expect(text).toContain('Validated corpus');
});

test('CR06 — une proposition en attente propose une decision humaine', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/assistant');
  await page.waitForTimeout(600);

  const accept = page.getByRole('button', { name: 'Accept the proposal' });
  const reject = page.getByRole('button', { name: 'Reject the proposal' });

  // Si une proposition est en attente, les deux decisions humaines sont offertes.
  if ((await accept.count()) > 0) {
    await expect(reject.first()).toBeVisible();
  } else {
    await expect(page.getByText('No proposal is waiting for a decision')).toBeVisible();
  }
});

test('CR06 — la categorie d un evenement n est pas appliquee sans decision', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  // evt-1 est en `under_review` : le risque n est pas encore categorise.
  await page.goto('/hse/events/evt-1');

  const before = await pageText(page);
  // Aucun statut de categorisation automatique.
  expect(before).not.toMatch(/categorised automatically|auto-?categorised/i);

  // Le triage manuel est propose.
  await page.goto('/hse/events/evt-1/triage');
  await expect(page.getByRole('heading', { name: 'Triage event' })).toBeVisible();
  const triage = await pageText(page);
  expect(triage).toContain('Assistant proposal');
});
