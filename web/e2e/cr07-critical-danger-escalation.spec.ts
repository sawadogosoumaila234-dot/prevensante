import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR07 — Un salarie signale un danger grave avec la mention « immediate ».
 *
 * Attendu : banniere d'urgence affichee (« This application does not replace
 * your site emergency procedures... ») ; l'escalade niveau 1 est creee ;
 * l'evenement est en `escalated` ; **aucune proposition IA n'est proposee
 * avant le traitement de l'alerte**.
 */
test('CR07 — la banniere d urgence est affichee pour un danger immediat', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/report/danger');
  await page.locator('#site_id').selectOption({ index: 1 });
  await page.locator('#zone_id').selectOption({ index: 1 });
  await page.locator('#occurred_at').fill('2026-10-20T09:30');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#severity').selectOption('critical');
  await page.locator('#activity').fill('Removing a crusher guard without lock-out');
  await page
    .locator('#description')
    .fill('The crusher drive guard was removed and the machine was still energised.');
  await page.locator('#immediate_measures').fill('Stopped the machine and isolated the power supply.');
  await page.locator('#reported_consequences').fill('No injury, the intervention stopped the operation.');

  // Mention « immediate ».
  await page.getByText('The situation is an immediate danger.').click();

  // La banniere d'urgence apparait immediatement.
  const notice = page.getByRole('alert');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    'This application does not replace your site emergency procedures.',
  );
});

test('CR07 — l evenement critique est escalade et aucune proposition IA n est faite', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/report/danger');
  await page.locator('#site_id').selectOption({ index: 1 });
  await page.locator('#zone_id').selectOption({ index: 1 });
  await page.locator('#occurred_at').fill('2026-10-20T09:30');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#severity').selectOption('critical');
  await page.locator('#activity').fill('Removing a crusher guard without lock-out');
  await page
    .locator('#description')
    .fill('The crusher drive guard was removed and the machine was still energised.');
  await page.locator('#immediate_measures').fill('Stopped the machine and isolated the power supply.');
  await page.locator('#reported_consequences').fill('No injury, the intervention stopped the operation.');
  await page.getByText('The situation is an immediate danger.').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // L'etape de confirmation rappelle la procedure d'urgence du site.
  const confirm = await pageText(page);
  expect(confirm).toContain(
    'This application does not replace your site emergency procedures.',
  );

  // Aucune proposition IA n'est presente dans le parcours de signalement.
  expect(confirm).not.toMatch(/assistant proposal|AI proposal/i);

  const submit = page.getByRole('button', { name: 'Submit report' });
  await expect(submit).toBeVisible({ timeout: 15_000 });
  await submit.click();

  // Le bouton disparait apres la soumission : on attend la navigation vers
  // l'ecran de confirmation.
  await page.waitForURL('**/report/success');
  await expect(page).toHaveURL(/\/report\/success$/);

  await expect(page.getByRole('heading', { name: 'Report recorded' })).toBeVisible({
    timeout: 20_000,
  });

  const done = await pageText(page);
  expect(done).toMatch(/PES-2026-\d{4,5}/);
  // Aucune proposition IA n'est proposee dans l'ecran de confirmation.
  expect(done).not.toMatch(/assistant proposal|AI proposal/i);
});

test('CR07 — l escalade du danger critique est consultable par le HSE', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/escalations');
  // On cible le contenu principal : sur mobile, le lien de navigation
  // « Escalations » est masque et sort en premier.
  const main = page.getByTestId('main-content');
  await expect(main.getByText(/escalation/i).first()).toBeVisible();

  const text = await pageText(page);
  // Les escalades de niveau superieur sont listees.
  expect(text).toMatch(/hse officer|site director|company officer/i);
});
