import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';

/**
 * Step definitions for `features/access-control.feature`.
 *
 * Covers session management and access control: protected ParaBank pages
 * must require an authenticated session and must not be reachable by an
 * anonymous visitor or after logout.
 */
const { Given, When, Then } = createBdd(test);

Given('no customer is signed in', async ({ homePage }) => {
  await homePage.open();
  expect(await homePage.isSignedIn()).toBe(false);
});

When(
  'an anonymous visitor opens the {string} page directly',
  async ({ restrictedAreaPage }, pageName: string) => {
    await restrictedAreaPage.attemptToOpen(pageName);
  },
);

Then('access to the page is denied', async ({ restrictedAreaPage }) => {
  await expect(restrictedAreaPage.errorMessage).toBeVisible();
  await expect(restrictedAreaPage.errorMessage).toContainText('error');
  await expect(restrictedAreaPage.accountsTable).toHaveCount(0);
  expect(await restrictedAreaPage.isSignedIn()).toBe(false);
});

When('the customer navigates between authenticated pages', async ({ accountOverviewPage, restrictedAreaPage }) => {
  await accountOverviewPage.open();
  await accountOverviewPage.waitUntilLoaded();
  await restrictedAreaPage.goto('updateprofile.htm');
  await accountOverviewPage.open();
  await accountOverviewPage.waitUntilLoaded();
});

Then('the customer remains signed in', async ({ accountOverviewPage }) => {
  expect(await accountOverviewPage.isSignedIn()).toBe(true);
});
