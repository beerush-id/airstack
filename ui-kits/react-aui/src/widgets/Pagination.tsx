import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type Bindable, For, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowLeft, ArrowRight } from '../icons/index.js';
import { Link } from './Link.js';
import { pageWindow } from './page-window.js';

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

register('pagination', { size: SIZES.MD, color: COLORS.PRIMARY });

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
