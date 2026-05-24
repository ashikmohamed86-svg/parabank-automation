# ParaBank — Sign-Up & Login Automation

End-to-end test automation for the **ParaBank** online banking demo
(<https://parabank.parasoft.com/parabank/index.htm>).

The suite automates creating a new account, signing in with that account, and
logging the balance displayed on the post-login page. It is built with
**Playwright + TypeScript**, structured with **BDD** (Gherkin feature files)
and implemented with the **Page Object Model**.

> Built as the automation assessment for the Software Craftsperson role at Incubyte.

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
├── features/                       # BDD — Gherkin feature files
│   ├── account-registration.feature
│   └── account-login.feature
├── src/
│   ├── pages/                      # POM — one class per page
│   │   ├── BasePage.ts
│   │   ├── HomePage.ts
│   │   ├── RegistrationPage.ts
│   │   └── AccountOverviewPage.ts
│   ├── steps/                      # BDD — Gherkin step definitions
│   │   ├── registration.steps.ts
│   │   └── login.steps.ts
│   └── support/                    # Fixtures & utilities
│       ├── fixtures.ts             # Wires Page Objects into BDD steps
│       ├── customer-factory.ts     # Generates unique test data
│       └── logger.ts               # Logs the post-login balance
├── test-cases/
│   └── ParaBank_Test_Cases.xlsx    # Documented test cases
├── evidence/                       # Proof-of-execution artifacts
├── .github/workflows/playwright.yml# CI pipeline
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
npm test                 # run the full BDD suite (headless)
npm run test:headed      # run with a visible browser
npm run test:smoke       # run only @smoke scenarios
npm run test:registration# run only registration scenarios
npm run test:login       # run only login scenarios
npm run report           # open the HTML report from the last run
npm run typecheck        # TypeScript type-check, no test run
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

## Test scenarios

| ID | Scenario | Type | Feature file |
|----|----------|------|--------------|
| TC-01 | Register a new customer with valid details | Positive | account-registration.feature |
| TC-02 | Registration rejected when mandatory fields are empty | Negative | account-registration.feature |
| TC-03 | Registration rejected for an already registered username | Negative | account-registration.feature |
| TC-04 | Sign in with a new account and view the post-login balance | Positive | account-login.feature |
| TC-05 | Sign in rejected with invalid credentials | Negative | account-login.feature |

Full details are documented in [`test-cases/ParaBank_Test_Cases.xlsx`](test-cases/ParaBank_Test_Cases.xlsx).

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
