import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Base URL of the application under test.
 * Override with the BASE_URL environment variable if ParaBank is hosted elsewhere.
 */
const baseURL = process.env.BASE_URL ?? 'https://parabank.parasoft.com/parabank';

/**
 * playwright-bdd wiring: Gherkin feature files are compiled into runnable
 * Playwright specs (in .features-gen/) by the `bddgen` command.
 */
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  // Step definitions plus the fixtures file that exports the custom `test`.
  steps: ['src/steps/**/*.ts', 'src/support/fixtures.ts'],
});

export default defineConfig({
  testDir,
  // ParaBank is a shared public demo environment - run serially for stable, isolated state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
