import type { Locator, Page } from '@playwright/test';

/**
 * BasePage - the root of the Page Object Model hierarchy.
 *
 * Holds the Playwright `page` handle and the navigation elements that are
 * shared across every authenticated ParaBank page (the left-hand panel).
 * Every concrete page object extends this class.
 */
export abstract class BasePage {
  protected readonly page: Page;

  /** "Log Out" link in the left panel - only present when signed in. */
  readonly logoutLink: Locator;

  /** "Welcome <name>" greeting in the left panel - only present when signed in. */
  readonly welcomeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logoutLink = page.locator('#leftPanel').getByRole('link', { name: 'Log Out' });
    this.welcomeMessage = page.locator('#leftPanel p.smallText');
  }

  /**
   * Navigates to a path relative to the configured `baseURL`.
   * @param path - Relative path, e.g. `/index.htm`.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /** Returns the current page title. */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /** Returns true when the customer is signed in (the Log Out link is visible). */
  async isSignedIn(): Promise<boolean> {
    return this.logoutLink.isVisible();
  }

  /** Signs the current customer out and returns to the public home page. */
  async logout(): Promise<void> {
    await this.logoutLink.click();
  }
}
