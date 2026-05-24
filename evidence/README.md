# Proof of Execution

This folder holds the proof-of-execution artifacts for the ParaBank automation suite.

## How proof is generated

The suite is configured (see `playwright.config.ts`) to capture evidence automatically
on every run:

| Artifact | Location | Description |
|----------|----------|-------------|
| HTML report | `playwright-report/index.html` | Full interactive report: every scenario, step, screenshot and timing. |
| Screenshots | `test-results/**` | A screenshot is captured for **every** test (`screenshot: 'on'`). |
| Video | `test-results/**` | Recorded and retained for any failing test. |
| Trace | `test-results/**` | Playwright trace retained on failure (open with `npx playwright show-trace`). |
| Balance log | `test-results/balance.log` | The post-login account balance, printed and appended here by the suite. |
| Performance log | `test-results/performance.log` | Measured page-load and action response times against their budgets. |
| Security log | `test-results/security.log` | Security observations recorded by the security scenarios. |

## Generating the proof

```bash
npm test            # runs the full BDD suite
npm run report      # opens the HTML report in a browser
```

Then capture a screenshot or screen recording of:

1. The terminal output showing the **33 scenarios** run (32 passing, plus the
   `@fail`-tagged XSS scenario reported as an expected failure).
2. The console line `Post-login balance for "<user>" ... : $<amount>` (also in `test-results/balance.log`).
3. The Playwright HTML report (`npm run report`).

Save those captures into this folder, e.g. `evidence/01-test-run.png`,
`evidence/02-html-report.png`.

## Live-site verification record

During development, every scenario was verified step-by-step against the live
ParaBank site to confirm the locators and assertions are accurate. A representative
run produced:

- Registered customer: `ashik_qa_<unique>` — confirmation message
  *"Your account was created successfully. You are now logged in."*
- Post-login landing page: **Accounts Overview** (`overview.htm`)
- Account created with an opening balance, e.g. account `20559` → balance **$515.50**
- Empty registration form → 10 field-level validation errors
  (*"First name is required."*, etc.)
- Duplicate username → *"This username already exists."*
- Invalid credentials → *"The username and password could not be verified."*

> Note: ParaBank assigns a fresh account number and opening balance to every new
> registration, so the exact account id and amount differ on each run. The suite
> reads and logs whatever balance is displayed rather than asserting a fixed value.
