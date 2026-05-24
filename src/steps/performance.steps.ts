import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { PERFORMANCE_BUDGET_MS, timed } from '../support/performance';
import { logPerformance } from '../support/logger';

/**
 * Step definitions for `features/performance.feature`.
 *
 * Each scenario measures the wall-clock time of a key ParaBank page load or
 * action, logs it to test-results/performance.log, and asserts it against a
 * generous "soft" budget suited to the shared, JPA-backed demo environment.
 */
const { When, Then } = createBdd(test);

When(
  'the customer opens the home page and the load time is measured',
  async ({ homePage, scenarioContext }) => {
    const { durationMs } = await timed(() => homePage.open());
    scenarioContext.measuredMs = durationMs;
    scenarioContext.measuredLabel = 'Home page load';
  },
);

When(
  'the customer opens the registration page and the load time is measured',
  async ({ registrationPage, scenarioContext }) => {
    const { durationMs } = await timed(() => registrationPage.open());
    scenarioContext.measuredMs = durationMs;
    scenarioContext.measuredLabel = 'Registration page load';
  },
);

When(
  'the customer registers a new account and the response time is measured',
  async ({ registrationPage, customer, scenarioContext }) => {
    const { durationMs } = await timed(async () => {
      await registrationPage.register(customer);
      await expect(registrationPage.successMessage).toContainText(
        'Your account was created successfully',
      );
    });
    scenarioContext.measuredMs = durationMs;
    scenarioContext.measuredLabel = 'Account registration';
  },
);

When(
  'the customer signs in and the response time is measured',
  async ({ homePage, accountOverviewPage, customer, scenarioContext }) => {
    const { durationMs } = await timed(async () => {
      await homePage.login(customer.username, customer.password);
      await accountOverviewPage.waitUntilLoaded();
    });
    scenarioContext.measuredMs = durationMs;
    scenarioContext.measuredLabel = 'Login';
  },
);

When(
  'the customer reloads the Accounts Overview page and the load time is measured',
  async ({ accountOverviewPage, scenarioContext }) => {
    const { durationMs } = await timed(async () => {
      await accountOverviewPage.open();
      await accountOverviewPage.waitUntilLoaded();
    });
    scenarioContext.measuredMs = durationMs;
    scenarioContext.measuredLabel = 'Accounts Overview load';
  },
);

Then('the measured time is within the page-load budget', async ({ scenarioContext }) => {
  logPerformance(scenarioContext.measuredLabel, scenarioContext.measuredMs, PERFORMANCE_BUDGET_MS.pageLoad);
  expect(scenarioContext.measuredMs).toBeLessThanOrEqual(PERFORMANCE_BUDGET_MS.pageLoad);
});

Then('the measured time is within the registration budget', async ({ scenarioContext }) => {
  logPerformance(
    scenarioContext.measuredLabel,
    scenarioContext.measuredMs,
    PERFORMANCE_BUDGET_MS.registration,
  );
  expect(scenarioContext.measuredMs).toBeLessThanOrEqual(PERFORMANCE_BUDGET_MS.registration);
});

Then('the measured time is within the login budget', async ({ scenarioContext }) => {
  logPerformance(scenarioContext.measuredLabel, scenarioContext.measuredMs, PERFORMANCE_BUDGET_MS.login);
  expect(scenarioContext.measuredMs).toBeLessThanOrEqual(PERFORMANCE_BUDGET_MS.login);
});
