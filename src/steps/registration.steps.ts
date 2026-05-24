import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';

/**
 * Step definitions for `features/account-registration.feature`.
 *
 * Steps stay thin: they only orchestrate Page Objects and assert outcomes,
 * keeping all selector/interaction detail inside the POM layer.
 */
const { Given, When, Then } = createBdd(test);

Given('the customer is on the ParaBank registration page', async ({ registrationPage }) => {
  await registrationPage.open();
});

When('the customer registers with valid account details', async ({ registrationPage, customer }) => {
  await registrationPage.register(customer);
});

Then('the account is created successfully', async ({ registrationPage }) => {
  await expect(registrationPage.successMessage).toContainText(
    'Your account was created successfully',
  );
});

Then('the customer is signed in automatically', async ({ registrationPage }) => {
  await expect(registrationPage.logoutLink).toBeVisible();
});

When(
  'the customer submits the registration form without entering any details',
  async ({ registrationPage }) => {
    await registrationPage.submit();
  },
);

Then('validation errors are shown for the mandatory fields', async ({ registrationPage }) => {
  await expect(registrationPage.firstNameError).toBeVisible();
  await expect(registrationPage.firstNameError).toContainText('First name is required');
  await expect(registrationPage.lastNameError).toBeVisible();
  await expect(registrationPage.usernameError).toBeVisible();
  expect(await registrationPage.validationErrors.count()).toBeGreaterThan(0);
});

Given('a customer has already registered an account', async ({ registrationPage, customer }) => {
  await registrationPage.open();
  await registrationPage.register(customer);
  await expect(registrationPage.successMessage).toContainText(
    'Your account was created successfully',
  );
  await registrationPage.logout();
});

When(
  'the customer tries to register again with the same username',
  async ({ registrationPage, customer }) => {
    await registrationPage.open();
    await registrationPage.register(customer);
  },
);

Then('a duplicate username error is shown', async ({ registrationPage }) => {
  await expect(registrationPage.usernameError).toBeVisible();
  await expect(registrationPage.usernameError).toContainText('This username already exists');
});
