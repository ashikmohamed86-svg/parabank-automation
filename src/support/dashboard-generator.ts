/**
 * Custom HTML dashboard generator.
 *
 * Runs after every test execution (called from monocart-config.ts onEnd).
 * Reads the rich reportData object that monocart-reporter passes in, flattens
 * the suite/case tree into per-test records, and emits a single self-contained
 * dashboard.html in the same folder as the Monocart report.
 *
 * The dashboard targets non-technical readers:
 *   - hero header with big pass/fail headline
 *   - two SVG charts (pass/fail pie + tests-per-category bar)
 *   - toolbar: search, status filter, sort, tag-chip filters
 *   - tests grouped by category as expandable cards
 *
 * The HTML has zero external dependencies (no CDNs) so it can be shared as a
 * single file or opened offline.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Attachment {
  name: string;
  path?: string;
  contentType?: string;
  content?: string;
}

interface RawApiCall {
  method?: string;
  url?: string;
  resourceType?: string;
  status?: number;
  durationMs?: number;
  failure?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTruncated?: boolean;
}

interface ApiCall {
  method: string;
  url: string;
  endpoint: string;
  origin: string;
  resourceType: string;
  status: number | null;
  statusClass: '2xx' | '3xx' | '4xx' | '5xx' | 'error';
  durationMs: number;
  testId: string;
  testTitle: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTruncated?: boolean;
}

interface CaseNode {
  type: 'case';
  id: string;
  title: string;
  status: string;
  ok?: boolean;
  expectedStatus?: string;
  duration?: number;
  tags?: string[];
  location?: string;
  attachments?: Attachment[];
}

interface SuiteNode {
  type: 'suite';
  id: string;
  title: string;
  subs?: TreeNode[];
}

type TreeNode = CaseNode | SuiteNode;

interface FlatTest {
  id: string;
  title: string;
  fullTitle: string;
  /** Display status: passed | failed | flaky | skipped | expected-fail */
  status: string;
  rawStatus: string;
  ok: boolean;
  expectedFail: boolean;
  durationMs: number;
  tags: string[];
  category: string;
  feature: string;
  attachments: { name: string; path?: string; contentType?: string }[];
}

/** Ordered list of "primary" tags - first match in a test's tags wins. */
const CATEGORY_PRIORITY = [
  '@smoke', '@registration', '@login', '@access',
  '@boundary', '@security', '@performance',
];

const CATEGORY_LABELS: Record<string, string> = {
  '@smoke': 'Critical happy-path (Smoke)',
  '@registration': 'Customer Registration',
  '@login': 'Customer Login',
  '@access': 'Access Control',
  '@boundary': 'Input Validation (Boundary)',
  '@security': 'Security',
  '@performance': 'Performance',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  '@smoke': '#16a34a',
  '@registration': '#2563eb',
  '@login': '#0891b2',
  '@access': '#ea580c',
  '@boundary': '#7c3aed',
  '@security': '#dc2626',
  '@performance': '#0d9488',
  other: '#6b7280',
};

function pickCategory(tags: string[]): string {
  for (const c of CATEGORY_PRIORITY) if (tags.includes(c)) return c;
  return 'other';
}

/** Strip query/jsessionid noise to group same logical endpoint together. */
function normalizeEndpoint(url: string): { endpoint: string; origin: string } {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/;jsessionid=[^/?#]+/i, '');
    return { endpoint: path || '/', origin: u.origin };
  } catch {
    return { endpoint: url, origin: '' };
  }
}

function statusClassOf(status: number | null): ApiCall['statusClass'] {
  if (status === null) return 'error';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  return '2xx';
}

/** Pull the inline api-calls.json attachment off a test and turn it into ApiCall[]. */
function extractApiCalls(test: CaseNode): ApiCall[] {
  const att = (test.attachments ?? []).find(a => a.name === 'api-calls.json' && a.content);
  if (!att?.content) return [];
  let parsed: RawApiCall[];
  try {
    parsed = JSON.parse(att.content);
  } catch {
    return [];
  }
  return parsed.map(raw => {
    const url = raw.url ?? '';
    const { endpoint, origin } = normalizeEndpoint(url);
    const status = typeof raw.status === 'number' ? raw.status : null;
    return {
      method: raw.method ?? 'GET',
      url,
      endpoint,
      origin,
      resourceType: raw.resourceType ?? 'other',
      status,
      statusClass: raw.failure ? 'error' : statusClassOf(status),
      durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : 0,
      testId: test.id,
      testTitle: test.title,
      requestHeaders: raw.requestHeaders,
      requestBody: raw.requestBody,
      responseHeaders: raw.responseHeaders,
      responseBody: raw.responseBody,
      responseTruncated: raw.responseTruncated,
    };
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Walk the suite tree, emit a flat list of FlatTest records + extracted API calls. */
function flatten(rows: TreeNode[] | undefined): { tests: FlatTest[]; apiCalls: ApiCall[] } {
  const tests: FlatTest[] = [];
  const apiCalls: ApiCall[] = [];

  function visit(node: TreeNode, path: string[]): void {
    if (node.type === 'case') {
      const tags = node.tags ?? [];
      const feature = path.find(p => /\.feature/i.test(p)) ?? path[0] ?? '';
      const fullTitle = [...path.slice(1), node.title].join(' › ');
      const rawStatus = node.status ?? 'unknown';
      const ok = node.ok ?? rawStatus === 'passed';
      const expectedFail = node.expectedStatus === 'failed';
      let displayStatus: string;
      if (rawStatus === 'skipped') displayStatus = 'skipped';
      else if (expectedFail && ok) displayStatus = 'expected-fail';
      else if (ok) displayStatus = 'passed';
      else displayStatus = 'failed';

      tests.push({
        id: node.id,
        title: node.title,
        fullTitle,
        status: displayStatus,
        rawStatus,
        ok,
        expectedFail,
        durationMs: node.duration ?? 0,
        tags,
        category: pickCategory(tags),
        feature: feature.replace(/^.*[\\/]/, '').replace(/\.spec\.js$/, ''),
        attachments: (node.attachments ?? []).map(a => ({
          name: a.name,
          path: a.path,
          contentType: a.contentType,
        })),
      });
      // Replace the per-call testTitle with the fully-qualified scenario name.
      for (const c of extractApiCalls(node)) {
        apiCalls.push({ ...c, testTitle: fullTitle });
      }
      return;
    }
    if (Array.isArray(node.subs)) {
      for (const child of node.subs) visit(child, [...path, node.title]);
    }
  }

  for (const row of rows ?? []) visit(row, []);
  return { tests, apiCalls };
}

/** Generate an SVG donut chart for status breakdown. */
function donutSvg(passed: number, failed: number, flaky: number, skipped: number): string {
  const total = passed + failed + flaky + skipped || 1;
  const r = 70;
  const cx = 90;
  const cy = 90;
  const segments = [
    { value: passed, color: '#16a34a' },
    { value: failed, color: '#dc2626' },
    { value: flaky, color: '#f59e0b' },
    { value: skipped, color: '#9ca3af' },
  ].filter(s => s.value > 0);

  let acc = -Math.PI / 2;
  const arcs = segments.map(seg => {
    const angle = (seg.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(acc);
    const y1 = cy + r * Math.sin(acc);
    const x2 = cx + r * Math.cos(acc + angle);
    const y2 = cy + r * Math.sin(acc + angle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    acc += angle;
    return `<path d="${path}" fill="${seg.color}"/>`;
  }).join('');

  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  return `
<svg viewBox="0 0 180 180" width="180" height="180" aria-label="Pass/fail breakdown">
  ${arcs}
  <circle cx="${cx}" cy="${cy}" r="46" fill="#ffffff"/>
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="26" font-weight="700" fill="#0f172a">${pct}%</text>
  <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="#64748b">passed</text>
</svg>`;
}

/** Bar chart: tests per category. */
function barSvg(counts: Map<string, number>): string {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  const barH = 24;
  const gap = 8;
  const labelW = 200;
  const chartW = 280;
  const totalH = entries.length * (barH + gap);
  const rows = entries.map((entry, i) => {
    const [cat, n] = entry;
    const y = i * (barH + gap);
    const w = (n / max) * chartW;
    const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other;
    const label = CATEGORY_LABELS[cat] ?? cat;
    return `
  <text x="0" y="${y + barH * 0.7}" font-size="12" fill="#334155">${escapeHtml(label)}</text>
  <rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${barH}" fill="${color}" rx="3"/>
  <text x="${labelW + w + 6}" y="${y + barH * 0.7}" font-size="12" font-weight="600" fill="#0f172a">${n}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${labelW + chartW + 50} ${totalH}" width="100%" preserveAspectRatio="xMinYMin meet">${rows}</svg>`;
}

interface ReportData {
  name?: string;
  date?: number;
  duration?: number;
  rows?: TreeNode[];
  summary?: Record<string, { value?: number }>;
  metadata?: Record<string, string>;
}

export function buildDashboard(reportData: ReportData, outDir: string): void {
  const { tests, apiCalls } = flatten(reportData.rows);
  const s = reportData.summary ?? {};
  const total = s.tests?.value ?? tests.length;
  const passed = s.passed?.value ?? tests.filter(t => t.status === 'passed').length;
  const failed = s.failed?.value ?? tests.filter(t => t.status === 'failed').length;
  const flaky = s.flaky?.value ?? tests.filter(t => t.status === 'flaky').length;
  const skipped = s.skipped?.value ?? tests.filter(t => t.status === 'skipped').length;
  const durationSec = ((reportData.duration ?? 0) / 1000).toFixed(1);
  const ran = reportData.date ? new Date(reportData.date).toLocaleString() : new Date().toLocaleString();
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const overall = failed === 0 ? 'PASS' : 'FAIL';

  // Per-category counts (for bar chart + section ordering)
  const categoryCounts = new Map<string, number>();
  for (const t of tests) categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);

  // All unique tags (for filter chips)
  const allTags = [...new Set(tests.flatMap(t => t.tags))].sort();

  // ---- API aggregates ----
  const apiTotal = apiCalls.length;
  const apiByClass: Record<ApiCall['statusClass'], number> = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, error: 0 };
  const apiByMethod = new Map<string, number>();
  const endpointStats = new Map<string, { count: number; totalMs: number; statuses: Set<number | null> }>();
  let apiTotalMs = 0;
  for (const c of apiCalls) {
    apiByClass[c.statusClass]++;
    apiByMethod.set(c.method, (apiByMethod.get(c.method) ?? 0) + 1);
    apiTotalMs += c.durationMs;
    const key = `${c.method} ${c.origin}${c.endpoint}`;
    const stat = endpointStats.get(key) ?? { count: 0, totalMs: 0, statuses: new Set<number | null>() };
    stat.count++;
    stat.totalMs += c.durationMs;
    stat.statuses.add(c.status);
    endpointStats.set(key, stat);
  }
  const apiAvgMs = apiTotal > 0 ? Math.round(apiTotalMs / apiTotal) : 0;
  const apiErrorCount = apiByClass['4xx'] + apiByClass['5xx'] + apiByClass.error;
  const uniqueEndpoints = endpointStats.size;
  const slowestEndpoints = [...endpointStats.entries()]
    .map(([key, st]) => ({ key, count: st.count, avgMs: Math.round(st.totalMs / st.count), statuses: [...st.statuses] }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  const metadata = reportData.metadata ?? {};
  const metaRows = Object.entries(metadata)
    .filter(([k]) => k !== 'actualWorkers')
    .map(([k, v]) => `<div class="meta-row"><span class="meta-k">${escapeHtml(k)}</span><span class="meta-v">${escapeHtml(String(v))}</span></div>`)
    .join('');

  // Data payload for the page's JS
  const dataPayload = {
    tests,
    apiCalls,
    categoryLabels: CATEGORY_LABELS,
    categoryColors: CATEGORY_COLORS,
    categoryOrder: [...CATEGORY_PRIORITY, 'other'],
    allTags,
  };

  // SVG mini-chart: status-class bar (2xx/3xx/4xx/5xx/error)
  const statusClassColors: Record<string, string> = {
    '2xx': '#16a34a', '3xx': '#0ea5e9', '4xx': '#f59e0b', '5xx': '#dc2626', error: '#7c3aed',
  };
  const statusBarSvg = (() => {
    const order: ApiCall['statusClass'][] = ['2xx', '3xx', '4xx', '5xx', 'error'];
    const entries = order.map(k => ({ k, n: apiByClass[k] })).filter(e => e.n > 0);
    const max = Math.max(1, ...entries.map(e => e.n));
    const barH = 22, gap = 8, labelW = 70, chartW = 280;
    const totalH = entries.length * (barH + gap);
    const rows = entries.map((e, i) => {
      const y = i * (barH + gap);
      const w = (e.n / max) * chartW;
      const color = statusClassColors[e.k];
      return `
  <text x="0" y="${y + barH * 0.7}" font-size="12" fill="#334155">${e.k}</text>
  <rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${barH}" fill="${color}" rx="3"/>
  <text x="${labelW + w + 6}" y="${y + barH * 0.7}" font-size="12" font-weight="600" fill="#0f172a">${e.n}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${labelW + chartW + 50} ${totalH}" width="100%" preserveAspectRatio="xMinYMin meet">${rows}</svg>`;
  })();

  // Slowest endpoints list (server-side rendered, top 10)
  const slowestRows = slowestEndpoints.map(e => {
    const [method, ...rest] = e.key.split(' ');
    const url = rest.join(' ');
    const statusBadges = e.statuses.map(st => {
      const cls = statusClassOf(st);
      const color = statusClassColors[cls];
      return `<span class="status-pill" style="background:${color}">${st ?? 'ERR'}</span>`;
    }).join(' ');
    return `<tr>
      <td><span class="method-pill m-${method}">${escapeHtml(method)}</span></td>
      <td class="url-cell"><code>${escapeHtml(url)}</code></td>
      <td>${statusBadges}</td>
      <td style="text-align:right">${e.count}</td>
      <td style="text-align:right"><strong>${e.avgMs}</strong>&nbsp;ms</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ParaBank Test Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #f1f5f9; }
  header.hero { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #f1f5f9; padding: 32px 40px; }
  header.hero h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; }
  header.hero .sub { color: #cbd5e1; font-size: 14px; }
  .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; margin-left: 12px; }
  .pill.pass { background: #16a34a; color: #fff; }
  .pill.fail { background: #dc2626; color: #fff; }
  .container { max-width: 1280px; margin: 0 auto; padding: 24px 40px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-top: -32px; margin-bottom: 24px; }
  .tile { background: #fff; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(15,23,42,0.08); }
  .tile .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .tile .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
  .tile.pass .value { color: #16a34a; }
  .tile.fail .value { color: #dc2626; }
  .tile.flaky .value { color: #f59e0b; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(15,23,42,0.08); }
  .card h2 { margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #475569; }
  .chart-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .legend { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .legend span.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 8px; vertical-align: middle; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 13px; }
  .meta-row { display: contents; }
  .meta-k { color: #64748b; }
  .meta-v { color: #0f172a; }
  .toolbar { background: #fff; padding: 16px 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(15,23,42,0.08); margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .toolbar input[type=search], .toolbar select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: #fff; }
  .toolbar input[type=search] { flex: 1 1 240px; min-width: 220px; }
  .tag-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .chip { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; cursor: pointer; user-select: none; background: #e2e8f0; color: #475569; border: 1px solid transparent; }
  .chip.active { background: #1e293b; color: #fff; }
  .chip.cat { color: #fff; }
  .section { background: #fff; border-radius: 10px; padding: 12px 20px; box-shadow: 0 1px 3px rgba(15,23,42,0.08); margin-bottom: 12px; }
  .section h3 { margin: 8px 0; font-size: 15px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .section h3 .dot { width: 10px; height: 10px; border-radius: 50%; }
  .section h3 .count { background: #e2e8f0; color: #475569; font-size: 12px; padding: 2px 8px; border-radius: 999px; }
  .section.collapsed .test { display: none; }
  .section.collapsed h3 .caret::before { content: '▶'; }
  .section h3 .caret::before { content: '▼'; }
  .section h3 .caret { font-size: 10px; color: #94a3b8; }
  .test { border-top: 1px solid #f1f5f9; }
  .test:first-of-type { border-top: none; }
  .test-head { display: grid; grid-template-columns: 16px 24px 1fr auto; align-items: center; gap: 12px; padding: 10px 4px; cursor: pointer; user-select: none; }
  .test-head:hover { background: #f8fafc; }
  .test-head .caret { font-size: 10px; color: #94a3b8; transition: transform 0.15s; }
  .test.open .test-head .caret { transform: rotate(90deg); }
  .test-head .icon { font-size: 16px; }
  .test-head .icon.pass { color: #16a34a; }
  .test-head .icon.fail { color: #dc2626; }
  .test-head .icon.flaky { color: #f59e0b; }
  .test-head .icon.skipped { color: #9ca3af; }
  .test-head .icon.expected-fail { color: #2563eb; }
  .test-head .name { font-size: 14px; font-weight: 500; color: #0f172a; }
  .test-head .dur { font-size: 13px; color: #475569; font-variant-numeric: tabular-nums; }
  .test-body { display: none; padding: 4px 4px 14px 56px; }
  .test.open .test-body { display: block; }
  .test-body .sub { font-size: 12px; color: #64748b; margin-bottom: 6px; }
  .test-body .tags { margin-bottom: 8px; }
  .test-body .tags .chip { font-size: 11px; padding: 2px 8px; cursor: default; }
  details.attach { margin-top: 8px; }
  details.attach summary { cursor: pointer; font-size: 12px; color: #2563eb; }
  details.attach ul { margin: 6px 0 0; padding-left: 18px; font-size: 12px; }
  details.attach li a { color: #2563eb; text-decoration: none; }
  details.attach li a:hover { text-decoration: underline; }
  details.apicalls { margin-top: 6px; }
  details.apicalls summary { cursor: pointer; font-size: 12px; color: #0891b2; font-weight: 500; }
  table.inline-api { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
  table.inline-api th, table.inline-api td { padding: 4px 8px; border-top: 1px solid #f1f5f9; text-align: left; }
  table.inline-api th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  table.inline-api code { font-family: ui-monospace, monospace; font-size: 11px; color: #334155; word-break: break-all; }
  table.inline-api .m-pill { display: inline-block; padding: 1px 6px; border-radius: 3px; color: #fff; font-size: 10px; font-weight: 700; min-width: 38px; text-align: center; }
  table.inline-api .s-pill { display: inline-block; padding: 0 6px; border-radius: 999px; color: #fff; font-size: 10px; font-weight: 600; min-width: 30px; text-align: center; }
  table.inline-api tr.api-row { cursor: pointer; }
  table.inline-api tr.api-row:hover { background: #f8fafc; }
  table.inline-api tr.api-row td:first-child::before { content: '▸'; color: #cbd5e1; margin-right: 4px; font-size: 10px; }
  table.inline-api tr.api-row.open td:first-child::before { content: '▾'; color: #475569; }
  table.inline-api tr.api-detail { display: none; }
  table.inline-api tr.api-detail.open { display: table-row; }
  .api-detail-box { background: #0f172a; color: #e2e8f0; padding: 10px 14px; margin: 4px 0; border-radius: 6px; font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 280px; overflow: auto; }
  .api-detail-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; font-weight: 600; margin: 8px 0 4px; }
  .api-detail-empty { color: #94a3b8; font-style: italic; font-size: 11px; padding: 4px 0; }
  .empty { text-align: center; color: #64748b; padding: 40px; font-size: 14px; }
  footer { text-align: center; color: #94a3b8; font-size: 12px; padding: 24px; }
  /* API tracker */
  .api-section { margin-top: 24px; }
  .api-summary { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  @media (max-width: 900px) { .api-summary { grid-template-columns: 1fr; } }
  table.api { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.api th, table.api td { padding: 8px 10px; border-top: 1px solid #f1f5f9; text-align: left; vertical-align: top; }
  table.api th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; user-select: none; }
  table.api th.sortable::after { content: ' ⇅'; color: #cbd5e1; font-size: 10px; }
  table.api th.sort-asc::after { content: ' ▲'; color: #1e293b; }
  table.api th.sort-desc::after { content: ' ▼'; color: #1e293b; }
  table.api code { font-family: ui-monospace, monospace; font-size: 12px; color: #475569; word-break: break-all; }
  .url-cell { max-width: 480px; }
  .method-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; color: #fff; min-width: 44px; text-align: center; }
  .method-pill.m-GET { background: #16a34a; }
  .method-pill.m-POST { background: #2563eb; }
  .method-pill.m-PUT { background: #f59e0b; }
  .method-pill.m-DELETE { background: #dc2626; }
  .method-pill.m-PATCH { background: #7c3aed; }
  .method-pill.m-HEAD, .method-pill.m-OPTIONS { background: #64748b; }
  .status-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; color: #fff; font-size: 11px; font-weight: 600; }
  .api-row-test { font-size: 11px; color: #64748b; margin-top: 2px; }
</style>
</head>
<body>

<header class="hero">
  <h1>ParaBank Test Dashboard <span class="pill ${overall === 'PASS' ? 'pass' : 'fail'}">${overall} · ${pct}%</span></h1>
  <div class="sub">Last run ${escapeHtml(ran)} · ${total} tests · ${durationSec}s</div>
</header>

<div class="container">

  <div class="tiles">
    <div class="tile"><div class="label">Total</div><div class="value">${total}</div></div>
    <div class="tile pass"><div class="label">Passed</div><div class="value">${passed}</div></div>
    <div class="tile fail"><div class="label">Failed</div><div class="value">${failed}</div></div>
    <div class="tile flaky"><div class="label">Flaky</div><div class="value">${flaky}</div></div>
    <div class="tile"><div class="label">Skipped</div><div class="value">${skipped}</div></div>
    <div class="tile"><div class="label">Duration</div><div class="value">${durationSec}<small style="font-size:14px;color:#64748b">s</small></div></div>
  </div>

  <div class="row">
    <section class="card">
      <h2>Pass / fail breakdown</h2>
      <div class="chart-wrap">
        ${donutSvg(passed, failed, flaky, skipped)}
        <div class="legend">
          <div><span class="swatch" style="background:#16a34a"></span>Passed (${passed})</div>
          <div><span class="swatch" style="background:#dc2626"></span>Failed (${failed})</div>
          <div><span class="swatch" style="background:#f59e0b"></span>Flaky (${flaky})</div>
          <div><span class="swatch" style="background:#9ca3af"></span>Skipped (${skipped})</div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Tests per category</h2>
      ${barSvg(categoryCounts)}
    </section>
  </div>

  <section class="card" style="margin-bottom:16px;">
    <h2>Run details</h2>
    <div class="meta">${metaRows}</div>
  </section>

  <div class="toolbar">
    <input id="search" type="search" placeholder="Search tests by name or location…" autocomplete="off">
    <select id="status">
      <option value="all">All statuses</option>
      <option value="passed">Passed only</option>
      <option value="failed">Failed only</option>
      <option value="expected-fail">Expected fail only</option>
      <option value="flaky">Flaky only</option>
      <option value="skipped">Skipped only</option>
    </select>
    <select id="sort">
      <option value="default">Default order</option>
      <option value="name-asc">Name (A → Z)</option>
      <option value="name-desc">Name (Z → A)</option>
      <option value="dur-desc">Slowest first</option>
      <option value="dur-asc">Fastest first</option>
      <option value="status">Status (fail first)</option>
    </select>
    <button id="reset" class="chip">Reset filters</button>
    <div style="flex-basis: 100%; height: 0;"></div>
    <div class="tag-chips" id="tag-chips"></div>
  </div>

  <main id="results"></main>

  <section class="card api-section">
    <h2>🌐 API Activity (${apiTotal} calls captured across all tests)</h2>

    <div class="tiles" style="margin-top:8px;margin-bottom:16px;">
      <div class="tile"><div class="label">Total API calls</div><div class="value">${apiTotal}</div></div>
      <div class="tile ${apiErrorCount > 0 ? 'fail' : ''}"><div class="label">4xx / 5xx / errors</div><div class="value">${apiErrorCount}</div></div>
      <div class="tile"><div class="label">Unique endpoints</div><div class="value">${uniqueEndpoints}</div></div>
      <div class="tile"><div class="label">Avg duration</div><div class="value">${apiAvgMs}<small style="font-size:14px;color:#64748b">&nbsp;ms</small></div></div>
    </div>

    <div class="api-summary">
      <div>
        <h2 style="margin-top:0">Slowest endpoints</h2>
        ${slowestRows ? `<table class="api"><thead><tr><th>Method</th><th>Endpoint</th><th>Statuses seen</th><th style="text-align:right">Calls</th><th style="text-align:right">Avg time</th></tr></thead><tbody>${slowestRows}</tbody></table>` : '<div class="empty">No API calls recorded.</div>'}
      </div>
      <div>
        <h2 style="margin-top:0">By status class</h2>
        ${statusBarSvg || '<div class="empty">—</div>'}
      </div>
      <div>
        <h2 style="margin-top:0">By method</h2>
        ${[...apiByMethod.entries()].map(([m, n]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span class="method-pill m-${escapeHtml(m)}">${escapeHtml(m)}</span><strong>${n}</strong></div>`).join('') || '<div class="empty">—</div>'}
      </div>
    </div>

    <div style="font-size:12px;color:#64748b;margin-top:12px">
      Per-test API calls are listed inside each test card above — open any test row's "🌐 N API calls" panel.
    </div>
  </section>

  <footer>ParaBank Automation · custom dashboard generated by <code>dashboard-generator.ts</code></footer>
</div>

<script>
const DATA = ${JSON.stringify(dataPayload).replace(/</g, '\\u003c')};

const state = { search: '', status: 'all', sort: 'default', tags: new Set() };

const STATUS_ICON = { passed: '✓', failed: '✘', flaky: '⚠', skipped: '○', 'expected-fail': '🛡' };
const STATUS_RANK = { failed: 0, flaky: 1, skipped: 2, 'expected-fail': 3, passed: 4 };
const STATUS_CLASS_COLOR = { '2xx': '#16a34a', '3xx': '#0ea5e9', '4xx': '#f59e0b', '5xx': '#dc2626', 'error': '#7c3aed' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderChips() {
  const wrap = document.getElementById('tag-chips');
  wrap.innerHTML = DATA.allTags.map(t => {
    const active = state.tags.has(t) ? ' active' : '';
    return '<span class="chip tag' + active + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</span>';
  }).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.onclick = () => {
      const t = c.dataset.tag;
      if (state.tags.has(t)) state.tags.delete(t); else state.tags.add(t);
      render();
    };
  });
}

function applyFilters() {
  const q = state.search.toLowerCase();
  let list = DATA.tests.filter(t => {
    if (state.status !== 'all' && t.status !== state.status) return false;
    if (state.tags.size > 0 && ![...state.tags].every(tag => t.tags.includes(tag))) return false;
    if (q && !(t.fullTitle.toLowerCase().includes(q) || t.feature.toLowerCase().includes(q) || t.tags.join(' ').toLowerCase().includes(q))) return false;
    return true;
  });

  switch (state.sort) {
    case 'name-asc': list.sort((a, b) => a.fullTitle.localeCompare(b.fullTitle)); break;
    case 'name-desc': list.sort((a, b) => b.fullTitle.localeCompare(a.fullTitle)); break;
    case 'dur-desc': list.sort((a, b) => b.durationMs - a.durationMs); break;
    case 'dur-asc': list.sort((a, b) => a.durationMs - b.durationMs); break;
    case 'status': list.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)); break;
  }
  return list;
}

function render() {
  const filtered = applyFilters();
  const root = document.getElementById('results');
  if (filtered.length === 0) {
    root.innerHTML = '<div class="empty">No tests match the current filters.</div>';
    return;
  }
  const byCat = new Map();
  for (const t of filtered) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category).push(t);
  }
  const ordered = DATA.categoryOrder.filter(c => byCat.has(c));
  root.innerHTML = ordered.map(cat => {
    const tests = byCat.get(cat);
    const label = DATA.categoryLabels[cat] || cat;
    const color = DATA.categoryColors[cat] || '#6b7280';
    const rows = tests.map((t, idx) => {
      const icon = STATUS_ICON[t.status] || '?';
      const tagChips = t.tags.map(tg => '<span class="chip tag">' + escapeHtml(tg) + '</span>').join(' ');
      const attaches = t.attachments.filter(a => a.path);
      const attHtml = attaches.length === 0 ? '' : (
        '<details class="attach"><summary>' + attaches.length + ' attachment' + (attaches.length === 1 ? '' : 's') + '</summary><ul>' +
        attaches.map(a => '<li><a href="' + escapeHtml(a.path) + '" target="_blank">' + escapeHtml(a.name) + '</a></li>').join('') +
        '</ul></details>'
      );

      // Per-test API calls inline (with click-to-expand detail rows)
      const testCalls = DATA.apiCalls.filter(c => c.testId === t.id);
      let apiHtml = '';
      if (testCalls.length > 0) {
        const errCount = testCalls.filter(c => c.statusClass === '4xx' || c.statusClass === '5xx' || c.statusClass === 'error').length;
        const summary = testCalls.length + ' API call' + (testCalls.length === 1 ? '' : 's') + (errCount > 0 ? ' (' + errCount + ' error/4xx/5xx)' : '');
        const rowsHtml = testCalls.map((c, ci) => {
          const color = STATUS_CLASS_COLOR[c.statusClass];
          const statusLabel = c.status ?? 'ERR';
          const hasDetail = c.requestHeaders || c.requestBody || c.responseHeaders || c.responseBody;
          const rowId = 'api-' + idx + '-' + ci;
          const main = (
            '<tr class="api-row' + (hasDetail ? '' : ' no-detail') + '" data-target="' + rowId + '">' +
            '<td><span class="m-pill m-' + escapeHtml(c.method) + '">' + escapeHtml(c.method) + '</span></td>' +
            '<td><span class="s-pill" style="background:' + color + '">' + statusLabel + '</span></td>' +
            '<td><code>' + escapeHtml(c.endpoint) + '</code></td>' +
            '<td style="text-align:right;white-space:nowrap">' + Math.round(c.durationMs) + ' ms</td>' +
            '</tr>'
          );
          if (!hasDetail) return main;
          const reqHeaders = c.requestHeaders ? Object.entries(c.requestHeaders).map(([k, v]) => k + ': ' + v).join('\\n') : '';
          const resHeaders = c.responseHeaders ? Object.entries(c.responseHeaders).map(([k, v]) => k + ': ' + v).join('\\n') : '';
          const reqBody = c.requestBody || '';
          const resBody = (c.responseBody || '') + (c.responseTruncated ? '' : '');
          const detail = (
            '<tr class="api-detail" id="' + rowId + '"><td colspan="4">' +
              '<div class="api-detail-label">▸ Request URL</div>' +
              '<div class="api-detail-box">' + escapeHtml(c.method + ' ' + c.url) + '</div>' +
              '<div class="api-detail-label">▸ Request headers</div>' +
              (reqHeaders ? '<div class="api-detail-box">' + escapeHtml(reqHeaders) + '</div>' : '<div class="api-detail-empty">(none captured)</div>') +
              '<div class="api-detail-label">▸ Request body</div>' +
              (reqBody ? '<div class="api-detail-box">' + escapeHtml(reqBody) + '</div>' : '<div class="api-detail-empty">(empty)</div>') +
              '<div class="api-detail-label">◂ Response status</div>' +
              '<div class="api-detail-box">' + escapeHtml(String(c.status ?? 'ERR')) + '</div>' +
              '<div class="api-detail-label">◂ Response headers</div>' +
              (resHeaders ? '<div class="api-detail-box">' + escapeHtml(resHeaders) + '</div>' : '<div class="api-detail-empty">(none captured)</div>') +
              '<div class="api-detail-label">◂ Response body' + (c.responseTruncated ? ' (truncated)' : '') + '</div>' +
              (resBody ? '<div class="api-detail-box">' + escapeHtml(resBody) + '</div>' : '<div class="api-detail-empty">(empty)</div>') +
            '</td></tr>'
          );
          return main + detail;
        }).join('');
        apiHtml = (
          '<details class="apicalls"><summary>🌐 ' + summary + ' — click any row for request/response</summary>' +
          '<table class="inline-api"><thead><tr><th>Method</th><th>Status</th><th>Endpoint</th><th style="text-align:right">Time</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody></table></details>'
        );
      }

      return (
        '<div class="test" data-test-idx="' + idx + '">' +
        '<div class="test-head">' +
          '<span class="caret">▸</span>' +
          '<div class="icon ' + t.status + '">' + icon + '</div>' +
          '<div class="name">' + escapeHtml(t.fullTitle) + '</div>' +
          '<div class="dur">' + (t.durationMs / 1000).toFixed(2) + 's</div>' +
        '</div>' +
        '<div class="test-body">' +
          '<div class="sub">' + escapeHtml(t.feature) + '</div>' +
          '<div class="tags">' + tagChips + '</div>' +
          attHtml +
          apiHtml +
        '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<section class="section" data-cat="' + cat + '">' +
      '<h3 onclick="this.parentElement.classList.toggle(\\'collapsed\\')">' +
        '<span class="caret"></span>' +
        '<span class="dot" style="background:' + color + '"></span>' +
        escapeHtml(label) +
        '<span class="count">' + tests.length + '</span>' +
      '</h3>' +
      rows +
      '</section>'
    );
  }).join('');
}

// Delegated click handlers for collapse-first test cards + click-to-expand API rows.
document.addEventListener('click', e => {
  const head = e.target.closest('.test-head');
  if (head) {
    head.parentElement.classList.toggle('open');
    return;
  }
  const apiRow = e.target.closest('tr.api-row');
  if (apiRow && !apiRow.classList.contains('no-detail')) {
    const id = apiRow.dataset.target;
    const detail = document.getElementById(id);
    if (detail) {
      apiRow.classList.toggle('open');
      detail.classList.toggle('open');
    }
  }
});

document.getElementById('search').addEventListener('input', e => { state.search = e.target.value; render(); });
document.getElementById('status').addEventListener('change', e => { state.status = e.target.value; render(); });
document.getElementById('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
document.getElementById('reset').addEventListener('click', () => {
  state.search = ''; state.status = 'all'; state.sort = 'default'; state.tags.clear();
  document.getElementById('search').value = '';
  document.getElementById('status').value = 'all';
  document.getElementById('sort').value = 'default';
  renderChips(); render();
});

renderChips();
render();

</script>

</body>
</html>`;

  writeFileSync(join(outDir, 'dashboard.html'), html);
}
