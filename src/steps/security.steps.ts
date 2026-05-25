import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures';
import { logSecurity } from '../support/logger';

/**
 * Step definitions for `features/security.feature`.
 *
 * Covers security testing of the registration and login flows: input
 * masking, SQL/HTML injection resistance, transport security, session
 * cookie hardening, user-enumeration resistance and brute-force handling.
 */
const { Given, When, Then } = createBdd(test);

Given('the customer is on the {string} page', async ({ homePage, registrationPage }, pageName: string) => {
  if (pageName === 'registration') {
    await registrationPage.open();
  } else if (pageName === 'home') {
    await homePage.open();
  } else {
    throw new Error(`Unknown page: "${pageName}"`);
  }
});

Then(
  'the {string} field hides the characters that are typed',
  async ({ homePage, registrationPage }, fieldName: string) => {
    const fields = {
      Password: registrationPage.passwordInput,
      'Confirm Password': registrationPage.confirmPasswordInput,
      'Login Password': homePage.passwordInput,
    } as const;
    const field = fields[fieldName as keyof typeof fields];
    if (!field) {
      throw new Error(`Unknown field: "${fieldName}"`);
    }
    await field.fill('Secret@12345');
    await expect(field).toHaveAttribute('type', 'password');
    logSecurity(`The "${fieldName}" field renders as a masked password input.`);
  },
);

When(
  'the customer attempts to sign in with a SQL injection payload',
  async ({ homePage }) => {
    await homePage.login("' OR '1'='1", "' OR '1'='1' --");
  },
);

Then('the customer is not authenticated', async ({ homePage, page }) => {
  await page.waitForLoadState('load').catch(() => {});
  expect(page.url(), 'SQL injection must not reach the authenticated area').not.toContain(
    '/overview.htm',
  );
  expect(await homePage.isSignedIn()).toBe(false);
  logSecurity('SQL injection login payload did not bypass authentication.');
});

When(
  'the customer registers with an HTML injection payload in the first name',
  async ({ registrationPage, customer, page }) => {
    await registrationPage.register({ ...customer, firstName: '<b>QA-XSS</b>' });
    // Wait through any WAF interstitial for the post-registration page to render.
    await page.locator('#leftPanel p.smallText').waitFor({ state: 'visible', timeout: 60_000 });
  },
);

Then(
  'the injected markup is not rendered as live page content',
  async ({ page }) => {
    // Secure expectation: injected markup must be escaped, never become a live element.
    const injectedElement = page
      .locator('#leftPanel p.smallText b')
      .filter({ hasText: 'QA-XSS' });
    logSecurity('Checking whether HTML injected into the first name is neutralised.');
    await expect(injectedElement).toHaveCount(0);
  },
);

Then('the page is served over HTTPS', async ({ page }) => {
  expect(page.url()).toMatch(/^https:\/\//);
  logSecurity(`Application is served over a secure connection: ${new URL(page.url()).protocol}`);
});

Then('the session cookie is flagged HttpOnly', async ({ page }) => {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name.toUpperCase() === 'JSESSIONID');
  expect(sessionCookie, 'a JSESSIONID session cookie should be set after login').toBeTruthy();
  logSecurity(
    `JSESSIONID flags - HttpOnly: ${sessionCookie!.httpOnly}, Secure: ${sessionCookie!.secure}`,
  );
  expect(sessionCookie!.httpOnly, 'the session cookie should be HttpOnly').toBe(true);
});

When(
  'the customer signs in with a valid username and a wrong password',
  async ({ homePage, customer, scenarioContext }) => {
    await homePage.open();
    await homePage.login(customer.username, 'WrongPassword@0000');
    // ParaBank renders the error inside #showError which may be display:none.
    // Wait for the element to be attached, not visible.
    await homePage.loginError.waitFor({ state: 'attached' });
    scenarioContext.messages.push(((await homePage.loginError.textContent()) ?? '').trim());
  },
);

When(
  'the customer signs in with an unknown username and password',
  async ({ homePage, scenarioContext }) => {
    await homePage.open();
    await homePage.login('unknown_user_zz404', 'WrongPassword@0000');
    await homePage.loginError.waitFor({ state: 'attached' });
    scenarioContext.messages.push(((await homePage.loginError.textContent()) ?? '').trim());
  },
);

Then('both login attempts return the same error message', async ({ scenarioContext }) => {
  expect(scenarioContext.messages).toHaveLength(2);
  const [validUserError, unknownUserError] = scenarioContext.messages;
  expect(validUserError.length).toBeGreaterThan(0);
  expect(
    validUserError,
    'login errors must not reveal whether a username exists',
  ).toBe(unknownUserError);
  logSecurity(`Both invalid logins returned the identical message: "${validUserError}".`);
});

When(
  'the customer makes 5 consecutive failed login attempts',
  async ({ homePage, scenarioContext }) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      // One retry per attempt covers the case where ParaBank's demo
      // intermittently fails to render the login form on the first navigation.
      let opened = false;
      for (let tries = 0; tries < 2 && !opened; tries += 1) {
        try {
          await homePage.open();
          opened = true;
        } catch {
          if (tries === 1) throw new Error('Failed to load login page after retry');
        }
      }
      await homePage.login(`brute_user_${attempt}`, `brute_pass_${attempt}`);
      scenarioContext.flags.push(!(await homePage.isSignedIn()));
    }
  },
);

Then('every attempt is rejected', async ({ scenarioContext }) => {
  expect(scenarioContext.flags).toHaveLength(5);
  expect(scenarioContext.flags.every(Boolean), 'all 5 attempts should be rejected').toBe(true);
  logSecurity('All 5 repeated failed login attempts were consistently rejected.');
});
