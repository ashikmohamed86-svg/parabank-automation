import { test as base } from 'playwright-bdd';
import type { ConsoleMessage, Request, Response } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { HomePage } from '../pages/HomePage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { AccountOverviewPage } from '../pages/AccountOverviewPage';
import { RestrictedAreaPage } from '../pages/RestrictedAreaPage';
import { createCustomer, type Customer } from './customer-factory';

/**
 * Per-scenario scratchpad. Lets steps share small pieces of state within a
 * single scenario - e.g. capturing two error messages to compare them, or
 * carrying a measured duration from a When step to a Then step.
 */
export interface ScenarioContext {
  /** Text values captured by steps (e.g. login error messages). */
  messages: string[];
  /** Boolean outcomes captured by steps (e.g. per-attempt rejections). */
  flags: boolean[];
  /** The most recent measured duration in milliseconds. */
  measuredMs: number;
  /** A human-readable label describing what {@link measuredMs} timed. */
  measuredLabel: string;
}

/**
 * Custom test fixtures.
 *
 * Each Page Object, a freshly generated {@link Customer}, and a per-scenario
 * {@link ScenarioContext} are exposed as fixtures, so step definitions
 * receive ready-to-use, isolated instances for every scenario. This is the
 * bridge between BDD and the POM layer.
 */
export type TestFixtures = {
  homePage: HomePage;
  registrationPage: RegistrationPage;
  accountOverviewPage: AccountOverviewPage;
  restrictedAreaPage: RestrictedAreaPage;
  /** A unique customer, regenerated for every scenario. */
  customer: Customer;
  /** A fresh scratchpad for sharing state between steps of one scenario. */
  scenarioContext: ScenarioContext;
  /** Auto-fixture that wires per-test network + console capture. */
  _capture: void;
};

interface ApiCall {
  method: string;
  url: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  startedAt: string;
  durationMs?: number;
  failure?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTruncated?: boolean;
}

/**
 * Resource types we capture full request/response bodies for. ParaBank's
 * meaningful traffic (page loads, register/login form POSTs, the overview
 * fetch) all flow through `document` requests, so this is enough and keeps
 * the per-test overhead tiny.
 */
const CAPTURE_BODY_TYPES = new Set(['document']);
const MAX_BODY_BYTES = 4096;

/** Redact known sensitive values from any captured string. */
function redact(input: string): string {
  return input
    .replace(/((?:customer\.)?password=)[^&\s"]*/gi, '$1***REDACTED***')
    .replace(/((?:customer\.)?ssn=)[^&\s"]*/gi, '$1***REDACTED***')
    .replace(/(repeatedPassword=)[^&\s"]*/gi, '$1***REDACTED***')
    .replace(/jsessionid=[A-Z0-9]+/gi, 'jsessionid=***');
}

function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (/cookie|authorization|jsessionid/i.test(k)) out[k] = '***REDACTED***';
    else out[k] = v;
  }
  return out;
}

function truncate(s: string): { value: string; truncated: boolean } {
  if (s.length <= MAX_BODY_BYTES) return { value: s, truncated: false };
  return { value: s.slice(0, MAX_BODY_BYTES) + '\n…(truncated)', truncated: true };
}

/**
 * Plain-English explanations of every tag used in feature files.
 * Mirrored from monocart-config.ts so the per-test attachment is self-contained.
 */
const TAG_GLOSSARY: Record<string, string> = {
  '@smoke': 'Critical happy-path check.',
  '@registration': 'Brand-new customer sign-up.',
  '@login': 'Existing customer sign-in.',
  '@access': 'Protected pages must stay private to anonymous visitors.',
  '@boundary': 'Edge case input (empty, very long, special characters).',
  '@security': 'Security check (passwords, injection, HTTPS, cookies).',
  '@performance': 'Page-load or flow speed against an agreed budget.',
  '@positive': 'Confirms correct behaviour under normal use.',
  '@negative': 'Confirms the system safely rejects bad or malicious input.',
  '@fail': 'Expected to fail - documents a known limitation.',
};

function renderWhatThisChecks(title: string, tagList: string[], outcome: string, durationMs: number): string {
  const lines: string[] = [];
  lines.push('# What this test checks', '');
  lines.push(`**In plain English:** ${title}.`, '');
  lines.push(`**Outcome:** ${outcome.toUpperCase()}`);
  lines.push(`**Time taken:** ${(durationMs / 1000).toFixed(1)} seconds`, '');
  if (tagList.length) {
    lines.push('## Why this test exists (tags explained)', '');
    for (const tag of tagList) {
      const meaning = TAG_GLOSSARY[tag] ?? '(no description available)';
      lines.push(`- **${tag}** - ${meaning}`);
    }
  }
  return lines.join('\n');
}

function renderMarkdown(calls: ApiCall[], consoleLines: string[]): string {
  const lines: string[] = [];
  lines.push('# Network & Console capture', '');
  lines.push(`**API calls:** ${calls.length}`);
  lines.push(`**Console messages:** ${consoleLines.length}`, '');
  lines.push('## API calls', '');
  lines.push('| # | Method | Status | Type | Duration (ms) | URL |');
  lines.push('|---|--------|--------|------|---------------|-----|');
  calls.forEach((c, i) => {
    const status = c.status ?? (c.failure ? 'FAILED' : '—');
    const dur = c.durationMs?.toFixed(0) ?? '—';
    lines.push(`| ${i + 1} | ${c.method} | ${status} | ${c.resourceType} | ${dur} | \`${c.url}\` |`);
  });
  lines.push('', '## Console', '');
  if (consoleLines.length === 0) lines.push('_(no console output)_');
  else lines.push('```', ...consoleLines, '```');
  return lines.join('\n');
}

export const test = base.extend<TestFixtures>({
  // Per-test HAR recording: extend the resolved contextOptions so video/viewport
  // from playwright.config.ts are preserved.
  contextOptions: async ({ contextOptions }, use, testInfo) => {
    const harPath = join(testInfo.outputDir, 'network.har');
    mkdirSync(dirname(harPath), { recursive: true });
    await use({
      ...contextOptions,
      recordHar: { path: harPath, content: 'embed' },
    });
    try {
      await testInfo.attach('network.har', { path: harPath, contentType: 'application/json' });
    } catch {
      // HAR not produced (e.g. context never used) — ignore.
    }
  },

  // Auto-fixture: captures every request/response and console message on the test's page,
  // then attaches api-calls.json, api-calls.md, and console.log per test.
  _capture: [async ({ page }, use, testInfo) => {
    const calls: ApiCall[] = [];
    const startTimes = new Map<Request, number>();
    const consoleLines: string[] = [];

    const onRequest = (req: Request) => {
      startTimes.set(req, Date.now());
      const call: ApiCall = {
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
        startedAt: new Date().toISOString(),
      };
      if (CAPTURE_BODY_TYPES.has(req.resourceType())) {
        try {
          call.requestHeaders = redactHeaders(req.headers());
          const post = req.postData();
          if (post) call.requestBody = truncate(redact(post)).value;
        } catch {
          // request may have already disposed - ignore
        }
      }
      calls.push(call);
    };
    const onResponse = (res: Response) => {
      const req = res.request();
      const start = startTimes.get(req);
      const call = [...calls].reverse().find(c => c.url === req.url() && c.method === req.method() && c.status === undefined);
      if (!call) return;
      call.status = res.status();
      call.statusText = res.statusText();
      if (start !== undefined) call.durationMs = Date.now() - start;
      if (CAPTURE_BODY_TYPES.has(req.resourceType())) {
        call.responseHeaders = redactHeaders(res.headers());
        // Fire-and-forget body read so the response handler returns immediately
        // and never blocks subsequent page actions.
        res.text().then(text => {
          const { value, truncated } = truncate(redact(text));
          call.responseBody = value;
          if (truncated) call.responseTruncated = true;
        }).catch(() => {
          // body unavailable (e.g. navigation aborted) - leave it unset
        });
      }
    };
    const onRequestFailed = (req: Request) => {
      const call = [...calls].reverse().find(c => c.url === req.url() && c.method === req.method() && c.status === undefined);
      if (call) call.failure = req.failure()?.errorText ?? 'unknown';
    };
    const onConsole = (msg: ConsoleMessage) => {
      consoleLines.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    };

    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfailed', onRequestFailed);
    page.on('console', onConsole);

    await use();

    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('requestfailed', onRequestFailed);
    page.off('console', onConsole);

    await testInfo.attach('api-calls.json', {
      body: JSON.stringify(calls, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('api-calls.md', {
      body: renderMarkdown(calls, consoleLines),
      contentType: 'text/markdown',
    });
    await testInfo.attach('console.log', {
      body: consoleLines.join('\n'),
      contentType: 'text/plain',
    });

    // Plain-English explanation - readable by non-technical stakeholders.
    const tagList = (testInfo.tags ?? []).map(t => t.startsWith('@') ? t : `@${t}`);
    const outcome = testInfo.status ?? 'unknown';
    await testInfo.attach('what-this-checks.md', {
      body: renderWhatThisChecks(testInfo.title, tagList, outcome, testInfo.duration),
      contentType: 'text/markdown',
    });
  }, { auto: true }],

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  registrationPage: async ({ page }, use) => {
    await use(new RegistrationPage(page));
  },
  accountOverviewPage: async ({ page }, use) => {
    await use(new AccountOverviewPage(page));
  },
  restrictedAreaPage: async ({ page }, use) => {
    await use(new RestrictedAreaPage(page));
  },
  customer: async ({}, use) => {
    await use(createCustomer());
  },
  scenarioContext: async ({}, use) => {
    await use({ messages: [], flags: [], measuredMs: 0, measuredLabel: '' });
  },
});

export { expect } from '@playwright/test';
