/**
 * Performance budgets for the ParaBank deep-testing suite.
 *
 * ParaBank is a shared public demo backed by a JPA/Hibernate persistence
 * layer, so database-bound operations (registration, login) are noticeably
 * slower than static page loads. The budgets below are deliberately
 * generous "soft" thresholds: they catch genuine regressions without
 * failing on the demo environment's normal variability.
 */
export const PERFORMANCE_BUDGET_MS = {
  /** Loading a page (navigation + render). */
  pageLoad: 15_000,
  /** Submitting the registration form (JPA insert). */
  registration: 30_000,
  /** Authenticating and loading the post-login page (JPA reads). */
  login: 30_000,
} as const;

/**
 * Runs an asynchronous action and measures how long it took.
 *
 * @param action - The async operation to time.
 * @returns The action's result and its duration in milliseconds.
 */
export async function timed<T>(
  action: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const startedAt = Date.now();
  const result = await action();
  return { result, durationMs: Date.now() - startedAt };
}
