import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Customer } from '../support/customer-factory';

/**
 * RegistrationPage - the ParaBank "Sign up for online access" page (`register.htm`).
 *
 * Encapsulates the registration form, the success confirmation, and the
 * inline validation error messages for negative scenarios.
 */
export class RegistrationPage extends BasePage {
  private readonly path = '/register.htm';

  // --- Form fields (ParaBank uses dotted ids, matched via attribute selectors) ---
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly stateInput: Locator;
  readonly zipCodeInput: Locator;
  readonly phoneInput: Locator;
  readonly ssnInput: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly registerButton: Locator;

  // --- Result / feedback elements ---
  readonly panelHeading: Locator;
  readonly successMessage: Locator;
  readonly validationErrors: Locator;
  readonly firstNameError: Locator;
  readonly lastNameError: Locator;
  readonly usernameError: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.locator('[id="customer.firstName"]');
    this.lastNameInput = page.locator('[id="customer.lastName"]');
    this.addressInput = page.locator('[id="customer.address.street"]');
    this.cityInput = page.locator('[id="customer.address.city"]');
    this.stateInput = page.locator('[id="customer.address.state"]');
    this.zipCodeInput = page.locator('[id="customer.address.zipCode"]');
    this.phoneInput = page.locator('[id="customer.phoneNumber"]');
    this.ssnInput = page.locator('[id="customer.ssn"]');
    this.usernameInput = page.locator('[id="customer.username"]');
    this.passwordInput = page.locator('[id="customer.password"]');
    this.confirmPasswordInput = page.locator('[id="repeatedPassword"]');
    this.registerButton = page.getByRole('button', { name: 'Register' });

    this.panelHeading = page.locator('#rightPanel h1.title');
    this.successMessage = page.locator('#rightPanel p').first();
    this.validationErrors = page.locator('span.error');
    this.firstNameError = page.locator('[id="customer.firstName.errors"]');
    this.lastNameError = page.locator('[id="customer.lastName.errors"]');
    this.usernameError = page.locator('[id="customer.username.errors"]');
  }

  /** Opens the ParaBank registration page. */
  async open(): Promise<void> {
    await this.goto(this.path);
    await this.firstNameInput.waitFor({ state: 'visible' });
  }

  /**
   * Fills every field of the registration form. The password is also
   * mirrored into the "Confirm" field.
   * @param customer - The customer data to enter.
   */
  async fillForm(customer: Customer): Promise<void> {
    await this.firstNameInput.fill(customer.firstName);
    await this.lastNameInput.fill(customer.lastName);
    await this.addressInput.fill(customer.address);
    await this.cityInput.fill(customer.city);
    await this.stateInput.fill(customer.state);
    await this.zipCodeInput.fill(customer.zipCode);
    await this.phoneInput.fill(customer.phoneNumber);
    await this.ssnInput.fill(customer.ssn);
    await this.usernameInput.fill(customer.username);
    await this.passwordInput.fill(customer.password);
    await this.confirmPasswordInput.fill(customer.password);
  }

  /** Clicks the "Register" submit button. */
  async submit(): Promise<void> {
    await this.registerButton.click();
  }

  /**
   * Convenience method: fills the whole form and submits it.
   * @param customer - The customer data to register.
   */
  async register(customer: Customer): Promise<void> {
    await this.fillForm(customer);
    await this.submit();
  }
}
