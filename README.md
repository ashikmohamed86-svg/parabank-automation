# ParaBank — Sign-Up & Login Automation

End-to-end test automation for the **ParaBank** online banking demo
(<https://parabank.parasoft.com/parabank/index.htm>).

The suite automates creating a new account, signing in with that account, and
logging the balance displayed on the post-login page. It is built with
**Playwright + TypeScript**, structured with **BDD** (Gherkin feature files)
and implemented with the **Page Object Model**.

> Built as the automation assessment for the Software Craftsperson role at Incubyte.

---

## For non-technical readers

**What is this?** A robot that opens the ParaBank online banking website,
performs real customer activities (signing up, logging in, checking the
balance, trying to break in, etc.), and confirms the website behaves
correctly. Each "check" the robot performs is called a **test**.

**Why is it useful?** Every time someone changes the code, the robot can
re-run all checks in a couple of minutes and tell you whether anything
regressed. This is much faster and more reliable than a human re-clicking
the same flows by hand.

**Where do I see the results?**

| File | What it is | How to open |
|------|------------|--------------|
| `monocart-report/index.html` | The full rich report - charts, every test with screenshots, video, network log, plain-English explanation | Double-click in Finder, or run `pbmono` in the terminal |
| `monocart-report/REPORT-SUMMARY.md` | A 30-second executive summary in plain English | Open in any text/markdown viewer |
| `playwright-report/index.html` | The built-in Playwright report (also fine) | `pbreport` |

**Reading a single test in the rich report**

1. Click any test row.
2. **Steps** tab shows what the robot did, step by step, in English.
3. **Attachments** tab shows:
   - `what-this-checks.md` - one-paragraph plain-English explanation of this test
   - `screenshot`, `video`, `trace` - what the robot saw
   - `api-calls.md` / `api-calls.json` - every server call the page made
   - `network.har` - same network data in a format Chrome DevTools can open
   - `console.log` - any developer messages the page emitted

**What do the colored tags mean?**

The report shows tags like `@smoke` or `@security` on each test. Hover any
tag in the report for the meaning, or read the full glossary at the top of
the report's cover page.

---

## Objective

| Goal | How it is met |
|------|---------------|
| Test the sign-up flow | `account-registration.feature` |
| Create an account & sign in | `account-login.feature` |
| Log/print the post-login balance | `login.steps.ts` → `logBalance()` → console + `test-results/balance.log` |
| Structure tests with BDD | Gherkin `.feature` files run via `playwright-bdd` |
| Build scripts with BDD + POM | Step definitions orchestrate Page Objects only |

---

## Tech stack

- **Playwright** (`@playwright/test`) — browser automation & test runner
- **TypeScript** — typed, maintainable test code
- **playwright-bdd** — runs Cucumber/Gherkin `.feature` files on the Playwright runner
- **Page Object Model** — one class per page, encapsulating locators and actions

---

## Project structure

```
parabank-automation/
├── features/                        # BDD — Gherkin feature files
│   ├── account-registration.feature # Functional — registration
│   ├── account-login.feature        # Functional — login & balance
│   ├── boundary.feature             # Boundary & input validation
│   ├── security.feature             # Security testing
│   ├── access-control.feature       # Session & access control
│   └── performance.feature          # Response-time performance
├── src/
│   ├── pages/                       # POM — one class per page
│   │   ├── BasePage.ts
│   │   ├── HomePage.ts
│   │   ├── RegistrationPage.ts
│   │   ├── AccountOverviewPage.ts
│   │   └── RestrictedAreaPage.ts
│   ├── steps/                       # BDD — Gherkin step definitions
│   │   ├── registration.steps.ts
│   │   ├── login.steps.ts
│   │   ├── boundary.steps.ts
│   │   ├── security.steps.ts
│   │   ├── access-control.steps.ts
│   │   └── performance.steps.ts
│   └── support/                     # Fixtures & utilities
│       ├── fixtures.ts              # Wires Page Objects into BDD steps
│       ├── customer-factory.ts      # Generates unique / boundary test data
│       ├── performance.ts           # Timing helper & response-time budgets
│       └── logger.ts                # Balance, performance & security logs
├── test-cases/
│   └── ParaBank_Test_Cases.xlsx     # 33 documented test cases (5 sheets)
├── evidence/                        # Proof-of-execution artifacts
├── .github/workflows/playwright.yml # CI pipeline
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- **Node.js 18+** and npm

## Setup

```bash
npm install                       # install dependencies
npx playwright install chromium   # download the Chromium browser
```

## Running the tests

```bash
npm test                  # run the full BDD suite (33 scenarios, headless)
npm run test:headed        # run with a visible browser
npm run test:smoke         # run only @smoke scenarios
npm run test:registration  # functional registration scenarios
npm run test:login         # functional login scenarios
npm run test:boundary      # boundary & input-validation scenarios
npm run test:security      # security scenarios
npm run test:access        # session & access-control scenarios
npm run test:performance   # performance scenarios
npm run report             # open the HTML report from the last run
npm run typecheck          # TypeScript type-check, no test run
```

`npm test` runs `bddgen` (compiles the `.feature` files into runnable specs)
and then `playwright test`.

---

## How BDD + POM are applied

**BDD** — Behaviour is specified in plain-language Gherkin. Each `.feature`
file describes scenarios in `Given / When / Then` steps; `playwright-bdd`
turns them into executable Playwright tests.

```gherkin
Scenario: Sign in with a newly created account and view the balance
  Given a customer has registered a new ParaBank account
  When the customer signs in with the new account credentials
  Then the Accounts Overview page is displayed
  And the account balance is shown and logged to the console
```

**Page Object Model** — every page is a class under `src/pages/`. Locators and
interactions live there, so step definitions stay thin and readable.

```
Feature file (Gherkin)
        │
        ▼
Step definition  ──uses──▶  Page Object  ──drives──▶  ParaBank page
        │
   custom fixtures (src/support/fixtures.ts) inject ready-to-use Page Objects
```

This keeps the three layers cleanly separated: **what** to test (features),
**how** a step behaves (steps), and **where** elements live (pages).

---

## Test coverage

The suite contains **33 automated scenarios** across five test types:

| Test type | Count | What it covers |
|-----------|-------|----------------|
| Functional | 6 | Core registration, login and the post-login balance |
| Boundary & validation | 8 | Password mismatch, partial forms, min/max length, special characters, missing credentials |
| Security | 9 | Input masking, SQL/HTML injection, HTTPS, HttpOnly cookie, user enumeration, brute-force |
| Access control | 5 | Protected pages blocked when logged out / after logout, session persistence |
| Performance | 5 | Page-load and action response times against soft budgets |

Every scenario is documented as a test case in
[`test-cases/ParaBank_Test_Cases.xlsx`](test-cases/ParaBank_Test_Cases.xlsx) — a
five-sheet workbook (Test Cases, Summary Report, Automation Mapping, Dashboard,
Guidelines).

### Security finding

The security scenario for HTML injection (TC-019) asserts the *secure*
expectation — injected markup should be neutralised. ParaBank renders the
registration first name **unescaped**, a genuine stored-XSS / HTML-injection
exposure. The scenario is tagged `@fail` (expected failure) so the regression
suite stays green while clearly flagging the defect.

---

## Reports & proof of execution

Each run automatically produces:

- **HTML report** — `playwright-report/index.html` (`npm run report` to open)
- **Screenshots** — captured for every test under `test-results/`
- **Video & trace** — retained for any failing test
- **Balance log** — `test-results/balance.log` records the post-login balance

See [`evidence/README.md`](evidence/README.md) for the proof-of-execution guide.

---

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `https://parabank.parasoft.com/parabank` | Application base URL |
| `CI` | _unset_ | When set, enables 1 retry and `forbidOnly` |

```bash
BASE_URL=https://my-parabank-host/parabank npm test
```

---

## Continuous Integration

`.github/workflows/playwright.yml` runs the full suite on every push and pull
request to `main`, and uploads the HTML report as a build artifact.

---

## Pushing to GitHub

This project is a ready local git repository with a full commit history.
To publish it:

1. Create a new **empty** repository on GitHub (no README/.gitignore).
2. Then run:

```bash
git remote add origin https://github.com/<your-username>/parabank-automation.git
git branch -M main
git push -u origin main
```

---

## Notes

- ParaBank is a shared public demo site, so the suite runs **serially** with a
  single worker for stable, isolated state.
- Each run **generates a unique username**, so the suite is fully repeatable.
- ParaBank assigns a fresh account number and opening balance to every new
  registration — the suite reads and logs whatever balance is displayed rather
  than asserting a fixed amount.
