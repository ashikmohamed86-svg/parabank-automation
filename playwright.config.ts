import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import monocartConfig from './src/support/monocart-config';

/**
 * Base URL of the application under test.
 * Override with the BASE_URL environment variable if ParaBank is hosted elsewhere.
 */
const baseURL = process.env.BASE_URL ?? 'https://parabank.parasoft.com/parabank/';

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
  metadata: {
    'Application under test': 'ParaBank - Parasoft Online Banking Demo',
    'URL': 'https://parabank.parasoft.com/parabank/',
    'Owner': 'Ashik Mohamed',
    'Test framework': 'Playwright + playwright-bdd (Gherkin) + TypeScript',
    'Browsers': 'Chromium (Desktop Chrome viewport)',
    'For non-technical readers': 'Open REPORT-SUMMARY.md alongside this report for a 30-second plain-English overview.',
  },
  // The ParaBank demo is a single shared environment that returns 5xx under
  // concurrent registrations/logins, so the suite runs serially.
  // Increase WORKERS via env var when pointing at a private/dedicated host:
  //   WORKERS=4 npm test
  fullyParallel: !!process.env.WORKERS,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 1,
  forbidOnly: !!process.env.CI,
  // Retry transient ParaBank 5xx hiccups locally and on CI.
  // Bumped to 2 locally to absorb the higher 5xx rate when running in parallel.
  retries: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['monocart-reporter', monocartConfig],
  ],
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'on',
    video: 'on',
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
