import { test as base } from 'playwright-bdd';
import { HomePage } from '../pages/HomePage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { AccountOverviewPage } from '../pages/AccountOverviewPage';
import { createCustomer, type Customer } from './customer-factory';

/**
 * Custom test fixtures.
 *
 * Each Page Object and a freshly generated {@link Customer} are exposed as
 * fixtures, so step definitions receive ready-to-use, isolated instances
 * for every scenario. This is the bridge between BDD and the POM layer.
 */
export type TestFixtures = {
  homePage: HomePage;
  registrationPage: RegistrationPage;
  accountOverviewPage: AccountOverviewPage;
  /** A unique customer, regenerated for every scenario. */
  customer: Customer;
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
  customer: async ({}, use) => {
    await use(createCustomer());
  },
});

export { expect } from '@playwright/test';
