import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * RestrictedAreaPage - models ParaBank pages that require an authenticated
 * session. Used by the access-control scenarios to confirm that protected
 * banking pages cannot be reached by an anonymous visitor.
 *
 * When ParaBank receives a request for a protected page without a valid
 * session it serves an error page ("An internal error has occurred...")
 * instead of the protected content.
 */
export class RestrictedAreaPage extends BasePage {
  /** Display name -> path for the ParaBank pages that require authentication. */
  static readonly PROTECTED_PATHS: Record<string, string> = {
    'Accounts Overview': '/overview.htm',
    'Transfer Funds': '/transfer.htm',
    'Update Contact Info': '/updateprofile.htm',
    'Bill Pay': '/billpay.htm',
  };

  readonly errorMessage: Locator;
  readonly errorHeading: Locator;
  /** Protected content - must NOT be visible to an anonymous visitor. */
  readonly accountsTable: Locator;

  constructor(page: Page) {
    super(page);
    this.errorMessage = page.locator('#rightPanel p.error');
    this.errorHeading = page.locator('#rightPanel h1.title');
    this.accountsTable = page.locator('#accountTable');
  }

  /**
   * Navigates directly to a protected page by its display name.
   * @param pageName - One of the keys of {@link PROTECTED_PATHS}.
   */
  async attemptToOpen(pageName: string): Promise<void> {
    const path = RestrictedAreaPage.PROTECTED_PATHS[pageName];
    if (!path) {
      throw new Error(`Unknown protected page: "${pageName}"`);
    }
    await this.goto(path);
  }
}
