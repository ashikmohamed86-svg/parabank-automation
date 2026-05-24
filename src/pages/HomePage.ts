import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * HomePage - the public ParaBank landing page (`index.htm`).
 *
 * Hosts the "Customer Login" widget and the link to the registration page.
 * A failed sign-in also renders its error message on this page.
 */
export class HomePage extends BasePage {
  private readonly path = 'index.htm';

  readonly customerLoginHeading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly loginError: Locator;

  constructor(page: Page) {
    super(page);
    this.customerLoginHeading = page.getByRole('heading', { name: 'Customer Login' });
    this.usernameInput = page.locator('#loginPanel input[name="username"]');
    this.passwordInput = page.locator('#loginPanel input[name="password"]');
    this.loginButton = page.getByRole('button', { name: 'Log In' });
    this.registerLink = page.locator('#loginPanel').getByRole('link', { name: 'Register' });
    this.loginError = page.locator('#rightPanel p.error');
  }

  /** Opens the ParaBank home page. */
  async open(): Promise<void> {
    await this.goto(this.path);
    await this.customerLoginHeading.waitFor({ state: 'visible' });
  }

  /** Navigates from the home page to the registration page. */
  async goToRegistration(): Promise<void> {
    await this.registerLink.click();
  }

  /**
   * Submits the Customer Login form.
   * @param username - The account username.
   * @param password - The account password.
   */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
