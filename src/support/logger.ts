import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_DIR = resolve(process.cwd(), 'test-results');
const LOG_FILE = resolve(LOG_DIR, 'balance.log');

/**
 * Logs the post-login account balance.
 *
 * The message is printed to the console (so it appears in the Playwright
 * `list` reporter and the HTML report) and appended to
 * `test-results/balance.log` as a durable execution artifact.
 *
 * @param message - The human-readable balance message to record.
 */
export function logBalance(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;

  // eslint-disable-next-line no-console
  console.log(line);

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // File logging is best-effort - it must never fail a test.
  }
}
