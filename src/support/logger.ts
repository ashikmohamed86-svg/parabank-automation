import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_DIR = resolve(process.cwd(), 'test-results');

/**
 * Writes a timestamped line to the console and appends it to a log file
 * under test-results/ as a durable execution artifact.
 */
function write(fileName: string, message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  // eslint-disable-next-line no-console
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(resolve(LOG_DIR, fileName), `${line}\n`);
  } catch {
    // File logging is best-effort - it must never fail a test.
  }
}

/** Logs the post-login account balance to console and test-results/balance.log. */
export function logBalance(message: string): void {
  write('balance.log', message);
}

/** Logs a measured response time against its budget to test-results/performance.log. */
export function logPerformance(label: string, durationMs: number, budgetMs: number): void {
  const verdict = durationMs <= budgetMs ? 'WITHIN budget' : 'OVER budget';
  write('performance.log', `${label}: ${durationMs} ms (budget ${budgetMs} ms) - ${verdict}`);
}

/** Logs a security observation to console and test-results/security.log. */
export function logSecurity(message: string): void {
  write('security.log', `[SECURITY] ${message}`);
}
