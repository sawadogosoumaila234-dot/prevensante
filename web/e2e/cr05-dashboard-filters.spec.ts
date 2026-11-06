import { test, expect } from '@playwright/test';
import { loginAs, pageText } from './helpers';

/**
 * CR05 — Le HSE filtre le tableau de bord par site, zone, periode et type.
 *
 * Attendu : les compteurs correspondent aux filtres **et** au perimetre RLS ;
 * un salarie ne voit que ses propres evenements ; un filtre de periode vide
 * affiche l'etat vide.
 */
test('CR05 — le tableau de bord affiche les compteurs du perimetre', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse');
  await expect(page.getByText('Events recorded')).toBeVisible();

  const text = await pageText(page);
  expect(text).toContain('Latest events');
  expect(text).toContain('Late corrective actions');
  // Le tableau de bord est filtre par defaut sur le site de rattachement
  // (site 1) : les evenements des autres sites n'y figurent pas.
  expect(text).not.toContain('evt-6');
  expect(text).not.toContain('evt-7');
});

test('CR05 — le filtre de site restreint la liste', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse');
  await expect(page.locator('#dashboard-site')).toBeVisible();

  // Choix du site 1.
  await page.locator('#dashboard-site').selectOption({ index: 1 });
  await page.waitForTimeout(600);

  const after = await pageText(page);
  expect(after.length).toBeGreaterThan(50);
  // Les evenements des autres sites ne sont pas presentes.
  expect(after).not.toContain('PES-2026-00037');
  expect(after).not.toContain('PES-2026-00036');
});

test('CR05 — un filtre sans resultat affiche l etat vide', async ({ page }) => {
  await loginAs(page, 'HSE officer');

  await page.goto('/hse/events');

  // Un type combine a une severite qui ne correspond a aucun evenement
  // (les accidents du perimetre sont `critical` et `high`).
  await page.locator('#filter-kind').selectOption('accident');
  await page.locator('#filter-severity').selectOption('low');
  await page.waitForTimeout(600);

  const text = await pageText(page);
  // L'etat vide est affiche quand aucun evenement ne correspond.
  expect(text).toMatch(/no safety event matches these filters/i);
});

test('CR05 — un salarie ne voit que ses propres evenements', async ({ page }) => {
  await loginAs(page, 'Worker');

  await page.goto('/my-reports');
  const text = await pageText(page);

  // Ses propres evenements, references metier.
  expect(text).toContain('PES-2026-00042');
  // `PES-2026-00036` (site 3) est aussi le sien : un salarie voit toujours
  // ses propres signalements, meme hors de son site.
  expect(text).toContain('PES-2026-00036');
  // Pas les evenements declares par quelqu'un d'autre.
  expect(text).not.toContain('PES-2026-00037');
});
