const GAP_BEFORE = 'gap-before';
const GAP_AFTER = 'gap-after';

/**
 * A marker for skipped pages in a page run; the two are distinct so each
 * renders with a unique key.
 */
export type PageGap = typeof GAP_BEFORE | typeof GAP_AFTER;

/**
 * The page numbers worth showing: the first, the last, and `siblings` either
 * side of the current page, with a gap marker wherever pages are skipped.
 *
 * @param {number} page - The current page, 1-based.
 * @param {number} total - The number of pages.
 * @param {number} siblings - Pages kept on each side of the current one.
 * @returns {Array<number | PageGap>} The run to render, in order; each gap is unique.
 */
export function pageWindow(page: number, total: number, siblings = 1): Array<number | PageGap> {
  const run: Array<number | PageGap> = [];
  const start = Math.max(2, page - siblings);
  const end = Math.min(total - 1, page + siblings);

  if (total >= 1) run.push(1);
  if (start > 2) run.push(GAP_BEFORE);
  for (let n = start; n <= end; n++) run.push(n);
  if (end < total - 1) run.push(GAP_AFTER);
  if (total > 1) run.push(total);

  return run;
}
