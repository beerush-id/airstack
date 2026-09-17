/**
 * Pagination cursor codec over a numeric entry offset.
 *
 * Concern: one opaque, driver-agnostic token so callers can page a listing
 * without seeing whether the backend counts index rows or storage objects.
 */

/**
 * Decodes a base64 pagination cursor into a numeric entry offset.
 *
 * @param cursor - Base64 encoded cursor string.
 * @returns Numeric offset, defaulting to 0 when absent or invalid.
 */
export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const parsed = parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Encodes a numeric entry offset into a base64 pagination cursor.
 *
 * @param offset - Numeric offset.
 * @returns Base64 cursor string.
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64');
}
