/**
 * Monocart reporter configuration.
 *
 * Owns the plain-English layer of the report so non-technical readers can
 * open it and understand what was tested, what each tag means, and what the
 * overall outcome was.
 *
 * Three pieces live here:
 *   1. `description` - the cover/summary shown at the top of the report.
 *   2. `tags`        - the glossary explaining every @tag used by scenarios.
 *   3. `onEnd`       - writes a standalone REPORT-SUMMARY.md after each run.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDashboard } from './dashboard-generator';

const APP_UNDER_TEST = 'ParaBank - Parasoft Online Banking Demo';
const APP_URL = 'https://parabank.parasoft.com/parabank/';
const OWNER = 'Ashik Mohamed';

const coverContent = `## What this report shows

This is the automated test report for **${APP_UNDER_TEST}** ([${APP_URL}](${APP_URL})).

A robot opens the website, goes through real customer flows (signing up,
logging in, viewing account balance, etc.) and confirms the application
behaves correctly. Each line below is one such check.

### Scope covered

| Area | What is checked |
|------|------------------|
| **Customer registration** | A brand-new customer can sign up successfully; bad data is rejected with clear errors |
| **Customer login** | Valid customers can sign in; invalid ones are blocked |
| **Account balance** | After login, the balance is shown correctly and recorded for audit |
| **Access control** | Anonymous visitors cannot reach pages that belong behind a login |
| **Input validation** | Minimum/maximum/special-character field values behave safely |
| **Security** | Passwords are masked; SQL/HTML injection attempts do not succeed; HTTPS and session cookies are configured correctly |
| **Performance** | Key pages and flows complete within agreed time budgets |

### How to read the rich HTML report

- **Green checkmark** = the check passed (good).
- **Red cross** = the check failed (something needs investigation).
- Click any row to drill into screenshots, video, network calls, and the trace.
- Tags (e.g. \`@smoke\`, \`@security\`) describe *why* a test exists - hover any tag for its meaning.`;

const tags = {
  smoke: { background: '#16a34a', description: 'Critical happy-path checks. If these fail, the application is broken for normal users.' },
  registration: { background: '#2563eb', description: 'Brand-new customer sign-up flow.' },
  login: { background: '#0891b2', description: 'Existing customer sign-in flow.' },
  access: { background: '#ea580c', description: 'Pages that should require a login must stay private to anonymous visitors.' },
  boundary: { background: '#7c3aed', description: 'Edge cases: empty, very short, very long, or special-character input.' },
  security: { background: '#dc2626', description: 'Password masking, injection attempts, HTTPS, session cookie protection.' },
  performance: { background: '#0d9488', description: 'Page loads and key flows complete within agreed time budgets.' },
  positive: { background: '#16a34a', description: 'Verifies the system behaves correctly under normal, valid use.' },
  negative: { background: '#6b7280', description: 'Verifies the system safely rejects invalid or malicious input.' },
  fail: { background: '#f59e0b', description: 'Expected to fail. Documents a known limitation without breaking the build.' },
};

interface ReportData {
  name?: string;
  date?: number;
  duration?: number;
  summary?: Record<string, { value?: number; percent?: string }>;
  trailing?: unknown;
  outputDir?: string;
}

async function onEnd(reportData: ReportData): Promise<void> {
  const s = reportData.summary ?? {};
  const total = s.tests?.value ?? 0;
  const passed = s.passed?.value ?? 0;
  const failed = s.failed?.value ?? 0;
  const flaky = s.flaky?.value ?? 0;
  const skipped = s.skipped?.value ?? 0;
  const durationSec = ((reportData.duration ?? 0) / 1000).toFixed(1);
  const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  const ran = reportData.date ? new Date(reportData.date).toLocaleString() : new Date().toLocaleString();
  const status = failed === 0 ? '**PASS**' : '**FAIL**';

  const body = `# ParaBank Test Run - Executive Summary

**Run at:** ${ran}
**Overall result:** ${status} (${pct}% of checks passed)
**Duration:** ${durationSec} seconds
**Owner:** ${OWNER}

## Numbers at a glance

| Metric | Count |
|--------|-------|
| Total checks | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Flaky (passed after retry) | ${flaky} |
| Skipped | ${skipped} |

## What to do next

${failed === 0
  ? '- All checks passed. No action required from this run.\n- Browse the full HTML report for screenshots, video, and network detail per test.'
  : `- ${failed} check(s) failed. Open the full HTML report and click each red row to see the screenshot, video, and network log.\n- Share the failed-test detail with the responsible team.`}

## Where to find the rich report

Open \`monocart-report/index.html\` in any browser.

---

${coverContent}
`;

  const outDir = reportData.outputDir ?? join(process.cwd(), 'monocart-report');
  writeFileSync(join(outDir, 'REPORT-SUMMARY.md'), body);

  // Custom non-technical-friendly HTML dashboard with charts, filters, search, sort.
  buildDashboard(reportData as Parameters<typeof buildDashboard>[0], outDir);
}

export default {
  name: 'ParaBank Automation Report',
  outputFile: 'monocart-report/index.html',
  attachmentPath: (currentPath: string) => currentPath,
  tags,
  onEnd,
};
