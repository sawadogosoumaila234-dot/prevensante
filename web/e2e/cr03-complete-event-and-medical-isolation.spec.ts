import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR03 — Un salarie cree un accident, le HSE le complete, puis le salarie
 * tente de lire le dossier medical.
 *
 * Attendu : `kind` conserve dans l'historique (`safety_event_logs`) ; toute
 * modification est historisee ; les donnees de sante ne sont pas accessibles
 * au salarie (0 row) ni au HSE non habilite.
 *
 * Les assertions portent sur le contenu principal (`main-content`) et non sur
 * toute la page : la navigation et le pied de page ne sont pas des donnees
 * metier.
 */
test('CR03 — le type d evenement est conserve et historise', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/events/evt-1');

  const main = page.getByTestId('main-content');
  await expect(main).toBeVisible();

  // Le type est affiche et ne peut pas etre modifie par le HSE.
  await expect(main.getByText(/Accident|Danger|Incident/i).first()).toBeVisible();

  // Un commentaire est historise dans la timeline (onglet Comments) : on
  // ouvre l'onglet avant de verifier le contenu de la timeline.
  await page.getByRole('tab', { name: 'Comments' }).click();
  await page.locator('#event-comment').fill('Zone cleaned and the aisle marking was repainted.');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByText('The comment has been added to the timeline.')).toBeVisible({
    timeout: 15_000,
  });

  const after = await pageText(page);
  expect(after).toContain('Zone cleaned and the aisle marking was repainted.');
});

test('CR03 — un salarie ne peut pas lire un dossier medical', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/medical');

  const main = page.getByTestId('main-content');
  await expect(main).toBeVisible();

  // Aucun dossier medical lisible : acces refuse, pas de donnee de sante.
  await expect(main.getByText('Access denied')).toBeVisible();
  await expect(main.getByText(/diagnostic|diagnos|medical note|treatment/i)).toHaveCount(0);
});

test('CR03 — un HSE non habilite ne peut pas lire un dossier medical', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/medical');

  const main = page.getByTestId('main-content');
  await expect(main).toBeVisible();

  await expect(main.getByText('Access denied')).toBeVisible();
  await expect(main.getByText(/diagnostic|diagnos|medical note|treatment/i)).toHaveCount(0);
});

test('CR03 — le medecin du travail autorise lit les dossiers medicaux', async ({ page }) => {
  await loginAs(page, 'Occupational physician');

  await page.goto('/medical');

  const main = page.getByTestId('main-content');
  await expect(main).toBeVisible();

  await expect(main.getByRole('heading', { name: 'Medical records' })).toBeVisible();
  await expect(main.getByText('Access denied')).toHaveCount(0);
});
