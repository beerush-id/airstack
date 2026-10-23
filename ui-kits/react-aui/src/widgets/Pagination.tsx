import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, For, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowLeft, ArrowRight } from '../icons/index.js';
import { Link } from './Link.js';

export type PaginationProps = Omit<ComponentProps<'nav'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'variant'> & {
    label?: string;
    page?: Bindable<number>;
    total?: number;
    siblings?: number;
    href?: (page: number) => string;
    previousLabel?: string;
    nextLabel?: string;
    children?: ReactNode;
  };

const PAGINATION_ROLE = 'pagination';
const GAP_BEFORE = 'gap-before';
const GAP_AFTER = 'gap-after';

type PageGap = typeof GAP_BEFORE | typeof GAP_AFTER;

register('pagination', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * The page numbers worth showing: the first, the last, and `siblings` either
 * side of the current page, with a gap marker wherever pages are skipped.
 *
 * @param {number} page - The current page, 1-based.
 * @param {number} total - The number of pages.
 * @param {number} siblings - Pages kept on each side of the current one.
 * @returns {Array<number | 'gap-before' | 'gap-after'>} The run to render, in order; each gap is unique.
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

/**
 * Named page run holding position and a single tab stop on the current page.
 * Page links commit the position; previous/next guard the bounds.
 * Without children it renders the run itself from `total`: previous and
 * next steppers around the first and last page, `siblings` around the
 * current one, and a gap where pages are skipped. `href` builds each page's
 * address; without it the links only move the position.
 */
export const Pagination = setup<PaginationProps>((props) => {
  const pager = aria(PAGINATION_ROLE, props);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.PAGINATION], props, auiConfig.pagination);
  const stay = (event: { preventDefault: () => void }) => event.preventDefault();
  const step = (by: -1 | 1) => {
    props.page = (props.page ?? 1) + by;
  };

  return () => (
    <nav
      ref={pager.ref}
      {...pager.restProps([...OMIT_KEYS, 'page', 'total', 'siblings', 'href', 'previousLabel', 'nextLabel'])}
      className={className()}
    >
      {props.children ?? (
        <>
          <button
            type="button"
            className={AUI_CLASS.PAGINATION_STEP}
            aria-label={props.previousLabel}
            disabled={(props.page ?? 1) <= 1}
            onClick={() => step(-1)}
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          {renderRun()}
          <button
            type="button"
            className={AUI_CLASS.PAGINATION_STEP}
            aria-label={props.nextLabel}
            disabled={props.total === undefined || (props.page ?? 1) >= props.total}
            onClick={() => step(1)}
          >
            <ArrowRight aria-hidden="true" />
          </button>
        </>
      )}
    </nav>
  );

  function renderRun() {
    return (
        <For each={() => pageWindow(props.page ?? 1, props.total ?? 1, props.siblings)}>
          {(entry) =>
            typeof entry !== 'number' ? (
              <span className={AUI_CLASS.PAGINATION_GAP} aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                href={props.href?.(entry) ?? `#page-${entry}`}
                page={entry}
                current={props.page === entry}
                onClick={props.href ? undefined : stay}
              >
                {entry}
              </Link>
            )
          }
        </For>
    );
  }
}, 'Pagination');
