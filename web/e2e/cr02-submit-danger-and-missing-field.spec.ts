import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR02 — Un salarie soumet un danger complet, puis ressoumet le formulaire
 * en omettant la description.
 *
 * Premier cas : reference unique `PES-2026-xxxxx` + message de confirmation.
 * Second cas : erreur explicite cote client (« A description is required. »)
 * et le signalement n'est pas enregistre.
 */
test('CR02 — un danger complet produit une reference unique', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/report/danger');
  await expect(page.getByRole('heading', { name: 'Report a hazard' })).toBeVisible();

  await page.locator('#site_id').selectOption({ index: 1 });
  await page.locator('#zone_id').selectOption({ index: 1 });
  await page.locator('#occurred_at').fill('2026-10-20T09:30');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#severity').selectOption('medium');
  await page.locator('#activity').fill('Manual handling of sacks on the production line');
  await page
    .locator('#description')
    .fill('A sack fell from the pallet and blocked the marked pedestrian aisle.');
  await page.locator('#immediate_measures').fill('Isolated the aisle and placed a warning sign.');
  await page.locator('#reported_consequences').fill('No injury, the aisle was briefly obstructed.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Submit report' }).click();

  // Le bouton disparait apres la soumission : on attend l'ecran de
  // confirmation, pas une nouvelle lecture du bouton.
  await page.waitForURL('**/report/success');
  await expect(page).toHaveURL(/\/report\/success$/);

  // Confirmation et reference au format PES-2026-xxxxx.
  await expect(page.getByRole('heading', { name: 'Report recorded' })).toBeVisible({
    timeout: 20_000,
  });
  const text = await pageText(page);
  expect(text).toMatch(/PES-2026-\d{4,5}/);
});

test('CR02 — une description manquante est refusee cote client', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/report/danger');
  await page.locator('#site_id').selectOption({ index: 1 });
  await page.locator('#zone_id').selectOption({ index: 1 });
  await page.locator('#occurred_at').fill('2026-10-20T09:30');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#severity').selectOption('medium');
  await page.locator('#activity').fill('Manual handling of sacks on the production line');
  // Description volontairement omise.
  await page.locator('#immediate_measures').fill('Isolated the aisle and placed a warning sign.');
  await page.locator('#reported_consequences').fill('No injury, the aisle was briefly obstructed.');
  await page.getByRole('button', { name: 'Continue' }).click();

  // L'erreur est explicite et le formulaire ne passe pas a l'etape suivante.
  await expect(page.getByText('A description is required.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What' })).toBeVisible();

  // Aucun signalement n'a ete enregistre : l'ecran de confirmation est absent.
  const text = await pageText(page);
  expect(text).not.toMatch(/PES-2026-\d{4,5}/);
  expect(text).not.toContain('Report recorded');
});
