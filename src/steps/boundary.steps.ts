import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { createBoundaryCustomer, type BoundaryVariant } from '../support/customer-factory';

/**
 * Step definitions for `features/boundary.feature`.
 *
 * Covers boundary-value analysis and input validation for the registration
 * and login forms.
 */
const { When, Then } = createBdd(test);

When(
  'the customer registers with a mismatched password confirmation',
  async ({ registrationPage, customer }) => {
    await registrationPage.fillForm(customer);
    // Overwrite the confirmation field so it differs from the password.
    await registrationPage.confirmPasswordInput.fill('Mismatch@9999');
    await registrationPage.submit();
  },
);

Then('a password confirmation error is shown', async ({ registrationPage }) => {
  await expect(registrationPage.passwordMismatchError).toBeVisible();
  await expect(registrationPage.passwordMismatchError).toContainText('Passwords did not match');
});

When(
  'the customer submits the registration form with only the name fields completed',
  async ({ registrationPage, customer }) => {
    await registrationPage.firstNameInput.fill(customer.firstName);
    await registrationPage.lastNameInput.fill(customer.lastName);
    await registrationPage.submit();
  },
);

Then(
  'validation errors are shown for the remaining mandatory fields',
  async ({ registrationPage }) => {
    await expect(registrationPage.addressError).toBeVisible();
    await expect(registrationPage.addressError).toContainText('required');
    expect(await registrationPage.validationErrors.count()).toBeGreaterThan(0);
  },
);

When(
  'the customer registers using {string} field values',
  async ({ registrationPage }, variant: string) => {
    const boundaryCustomer = createBoundaryCustomer(variant as BoundaryVariant);
    await registrationPage.register(boundaryCustomer);
  },
);

When(
  'the customer signs in with {string}',
  async ({ homePage, customer }, credentials: string) => {
    const emptyUsername = credentials.includes('empty username');
    const emptyPassword = credentials.includes('empty password');
    await homePage.login(
      emptyUsername ? '' : customer.username,
      emptyPassword ? '' : customer.password,
    );
  },
);

Then('login is rejected with an error message', async ({ homePage }) => {
  await expect(homePage.loginError).toBeVisible();
  expect(await homePage.isSignedIn()).toBe(false);
});
