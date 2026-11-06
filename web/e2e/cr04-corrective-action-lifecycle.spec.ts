import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR04 — Le HSE attribue une action, fixe une echeance deja depassee, puis le
 * responsable la soumet et le HSE la cloture.
 *
 * Attendu : `owner_id`, `due_at` et `status` enregistres ; l'action apparait
 * dans `v_overdue_actions` ; la cloture sans passer par `to_verify` est
 * rejetee ; la verification par l'actionnaire lui-meme est rejetee.
 */
test('CR04 — une action hors delai est signalee comme echue', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/actions');

  const text = await pageText(page);
  // La liste porte la reference et l'echeance de chaque action.
  expect(text).toContain('ACT-2026-');
  expect(text).toMatch(/due \d{1,2} [A-Z][a-z]{2} \d{4}/);
  // Une action en retard est signalee comme telle.
  expect(text).toMatch(/Late|late/);
});

test('CR04 — une action non soumise ne peut pas etre cloturee', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  // act-1 est en `in_progress` : la verification est refusee.
  await page.goto('/hse/actions/act-1/verify');

  const text = await pageText(page);
  expect(text).toContain('This action is not eligible for verification');
  expect(text).toContain('Only an action submitted for verification can be verified.');

  // Le bouton de verification est desactive.
  await expect(page.getByRole('button', { name: 'Verify and close' })).toBeDisabled();
});

test('CR04 — le HSE cloture une action soumise pour verification', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  // act-3 est en `to_verify`, proprietaire usr-action-owner (donc pas le HSE).
  await page.goto('/hse/actions/act-3/verify');

  const before = await pageText(page);
  expect(before).toContain('ACT-2026-00005');
  expect(before).not.toContain('This action is not eligible for verification');

  await page.getByRole('button', { name: 'Verify and close' }).click();

  await expect(page.getByText('The action has been verified and closed.')).toBeVisible({
    timeout: 15_000,
  });

  const after = await pageText(page);
  // L'action est desormais cloturee.
  expect(after).toContain('CLOSED');
});

test('CR04 — le proprietaire ne peut pas verifier sa propre action', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  // act-2 est proprietaire du HSE lui-meme : l'auto-verification est refusee.
  await page.goto('/hse/actions/act-2/verify');

  const text = await pageText(page);
  expect(text).toContain('This action is not eligible for verification');
  expect(text).toContain('An action cannot be verified by its own owner.');
  await expect(page.getByRole('button', { name: 'Verify and close' })).toBeDisabled();
});
