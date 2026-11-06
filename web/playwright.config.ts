import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright de PrevEnSanté.
 *
 * La suite E2E couvre les 7 criteres de reception CR01-CR07 de la
 * specification, en viewport mobile (Pixel 5) et bureau (1280x800).
 *
 * Les tests s'executent contre le build de production (`vite preview`) :
 * c'est la cible de la recette, pas le serveur de developpement.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4182',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Africa/Ouagadougou',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4182 --strictPort',
    url: 'http://localhost:4182',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
