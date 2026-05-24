import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * AccountOverviewPage - the page shown immediately after a successful sign-in
 * (`overview.htm`).
 *
 * Exposes the "Accounts Overview" table, from which the post-login account
 * balance is read.
 */
export class AccountOverviewPage extends BasePage {
  private readonly path = '/overview.htm';

  readonly pageHeading: Locator;
  readonly accountsTable: Locator;

  /** Data rows of the accounts table (rows that link to an account's activity). */
  private readonly accountRows: Locator;

  constructor(page: Page) {
    super(page);
    this.pageHeading = page.getByRole('heading', { name: 'Accounts Overview' });
    this.accountsTable = page.locator('#accountTable');
    this.accountRows = this.accountsTable
      .locator('tbody tr')
      .filter({ has: page.locator('a[href*="activity.htm"]') });
  }

  /** Navigates directly to the Accounts Overview page. */
  async open(): Promise<void> {
    await this.goto(this.path);
  }

  /** Waits until the Accounts Overview page and its account table are rendered. */
  async waitUntilLoaded(): Promise<void> {
    await expect(this.pageHeading).toBeVisible();
    await expect(this.accountsTable).toBeVisible();
    await expect(this.accountRows.first()).toBeVisible();
  }

  /** Returns the account number shown in the first row of the table. */
  async getFirstAccountId(): Promise<string> {
    const cell = this.accountRows.first().locator('td').nth(0);
    return (await cell.innerText()).trim();
  }

  /**
   * Returns the balance shown in the first row of the table,
   * e.g. `"$520.00"`.
   */
  async getFirstAccountBalance(): Promise<string> {
    const balanceCell = this.accountRows.first().locator('td').nth(1);
    await expect(balanceCell).toBeVisible();
    return (await balanceCell.innerText()).trim();
  }

  /** Returns the number of accounts listed in the overview table. */
  async getAccountCount(): Promise<number> {
    return this.accountRows.count();
  }
}
