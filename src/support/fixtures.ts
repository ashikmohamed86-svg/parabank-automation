import { test as base } from 'playwright-bdd';
import { HomePage } from '../pages/HomePage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { AccountOverviewPage } from '../pages/AccountOverviewPage';
import { RestrictedAreaPage } from '../pages/RestrictedAreaPage';
import { createCustomer, type Customer } from './customer-factory';

/**
 * Per-scenario scratchpad. Lets steps share small pieces of state within a
 * single scenario - e.g. capturing two error messages to compare them, or
 * carrying a measured duration from a When step to a Then step.
 */
export interface ScenarioContext {
  /** Text values captured by steps (e.g. login error messages). */
  messages: string[];
  /** Boolean outcomes captured by steps (e.g. per-attempt rejections). */
  flags: boolean[];
  /** The most recent measured duration in milliseconds. */
  measuredMs: number;
  /** A human-readable label describing what {@link measuredMs} timed. */
  measuredLabel: string;
}

/**
 * Custom test fixtures.
 *
 * Each Page Object, a freshly generated {@link Customer}, and a per-scenario
 * {@link ScenarioContext} are exposed as fixtures, so step definitions
 * receive ready-to-use, isolated instances for every scenario. This is the
 * bridge between BDD and the POM layer.
 */
export type TestFixtures = {
  homePage: HomePage;
  registrationPage: RegistrationPage;
  accountOverviewPage: AccountOverviewPage;
  restrictedAreaPage: RestrictedAreaPage;
  /** A unique customer, regenerated for every scenario. */
  customer: Customer;
  /** A fresh scratchpad for sharing state between steps of one scenario. */
  scenarioContext: ScenarioContext;
};

export const test = base.extend<TestFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  registrationPage: async ({ page }, use) => {
    await use(new RegistrationPage(page));
  },
  accountOverviewPage: async ({ page }, use) => {
    await use(new AccountOverviewPage(page));
  },
  restrictedAreaPage: async ({ page }, use) => {
    await use(new RestrictedAreaPage(page));
  },
  customer: async ({}, use) => {
    await use(createCustomer());
  },
  scenarioContext: async ({}, use) => {
    await use({ messages: [], flags: [], measuredMs: 0, measuredLabel: '' });
  },
});

export { expect } from '@playwright/test';
