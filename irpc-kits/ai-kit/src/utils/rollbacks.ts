import type { RollbackFn } from '../types/index.js';

/**
 * Executes registered rollback handlers in reverse (LIFO) order upon error or abort.
 * Ensures all handlers execute even if an individual rollback fails, aggregating
 * rollback failures as diagnostics without masking the original cause.
 * @param rollbacks Registry of teardown handlers registered by drivers.
 * @param error Optional error or abort reason that triggered the teardown.
 */
export async function runRollbacks(rollbacks: Set<RollbackFn>, error?: Error): Promise<void> {
  const list = Array.from(rollbacks).reverse();
  const rollbackErrors: unknown[] = [];

  for (const rollback of list) {
    try {
      await rollback(error);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
  }

  if (rollbackErrors.length > 0) {
    // Aggregate rollback warnings without swallowing original cause
    console.warn('[AIAdapter] Rollback execution warnings:', rollbackErrors);
  }
}
