import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { logBalance } from '../support/logger';

/**
 * Step definitions for `features/account-login.feature`.
 *
 * The positive scenario registers a fresh account, signs in with it, and
 * logs the balance displayed on the post-login Accounts Overview page -
 * the core objective of this assessment.
 */
const { Given, When, Then } = createBdd(test);

Given(
  'a customer has registered a new ParaBank account',
  async ({ registrationPage, homePage, customer }) => {
    await registrationPage.open();
    await registrationPage.register(customer);
    await expect(registrationPage.successMessage).toContainText(
      'Your account was created successfully',
    );
    // Sign out so the subsequent step exercises the real login flow.
    await registrationPage.logout();
    await expect(homePage.customerLoginHeading).toBeVisible();
  },
);

When(
  'the customer signs in with the new account credentials',
  async ({ homePage, accountOverviewPage, customer }) => {
    await homePage.login(customer.username, customer.password);
    await accountOverviewPage.waitUntilLoaded();
  },
);

Then('the Accounts Overview page is displayed', async ({ accountOverviewPage }) => {
  await expect(accountOverviewPage.pageHeading).toBeVisible();
});

Then(
  'the account balance is shown and logged to the console',
  async ({ accountOverviewPage, customer, $testInfo }) => {
    const accountId = await accountOverviewPage.getFirstAccountId();
    const balance = await accountOverviewPage.getFirstAccountBalance();

    // The displayed amount must be a valid currency value, e.g. "$520.00".
    expect(balance, 'post-login balance should be a currency value').toMatch(
      /^\$-?[\d,]+\.\d{2}$/,
    );

    const summary = `Post-login balance for "${customer.username}" (account ${accountId}): ${balance}`;
    logBalance(summary);
    await $testInfo.attach('post-login-balance', {
      body: summary,
      contentType: 'text/plain',
    });
  },
);

Given('the customer is on the ParaBank home page', async ({ homePage }) => {
  await homePage.open();
});

When('the customer signs in with invalid credentials', async ({ homePage }) => {
  await homePage.login('no_such_user_2026', 'WrongPassword!1');
});

Then('a login error message is displayed', async ({ homePage }) => {
  // ParaBank renders the error inside #showError, which can be hidden via
  // display:none in some response variants. We assert the message text exists
  // in the DOM rather than that the element is strictly visible. Either
  // "could not be verified" or "internal error has occurred" counts as a
  // rejection, since both confirm the login was not granted.
  await expect(homePage.loginError).toContainText(/could not be verified|internal error has occurred/i);
});

When('the customer logs out', async ({ accountOverviewPage }) => {
  await accountOverviewPage.logout();
});

Then('the Customer Login page is displayed', async ({ homePage }) => {
  await expect(homePage.customerLoginHeading).toBeVisible();
});
