import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { For, Slot, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { LinkEntry } from '../utils/common.js';
import { Link } from './Link.js';

export type BreadcrumbSlots = {
  link: (entry: LinkEntry) => ReactNode;
  separator: () => ReactNode;
};

export type BreadcrumbProps = Omit<ComponentProps<'nav'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'variant'> & {
    label?: string;
    links?: LinkEntry[];
    children?: ReactNode;
  };

export type BreadcrumbSeparatorProps = Omit<ComponentProps<'span'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'size' | 'variant' | 'color'> & {
    children?: ReactNode;
  };

const BREADCRUMB_ROLE = 'breadcrumb';
const BREADCRUMB_SEPARATOR_ROLE = 'breadcrumb-separator';

register('breadcrumb', { size: SIZES.MD, color: COLORS.PRIMARY });
register('breadcrumbSeparator', {});

/**
 * Trail of ancestor links holding one tab stop on the current crumb.
 * Arrows travel horizontally and wrap; separators are decorative only.
 * With `links` it renders the trail itself, separators included; the last
 * entry is the current page unless another entry says `current`.
 */
export const Breadcrumb = setup<BreadcrumbProps, BreadcrumbSlots>((props, slots) => {
  const trail = aria(BREADCRUMB_ROLE, props);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.BREADCRUMB], props, auiConfig.breadcrumb);
  const isCurrent = (entry: LinkEntry, index: number) =>
    entry.current ?? (index === props.links!.length - 1 && !props.links!.some((link) => link.current));

  return () => (
    <nav ref={trail.ref} {...trail.restProps([...OMIT_KEYS, 'links'])} className={className()}>
      {props.links ? (
        <For each={() => props.links!.map((entry, index) => ({ entry, index }))}>
          {({ entry, index }) => (
            <>
              {index > 0 && (
                <BreadcrumbSeparator>
                  <Slot for={() => slots.separator?.()}>/</Slot>
                </BreadcrumbSeparator>
              )}
              <Link href={entry.href} current={isCurrent(entry, index)} disabled={entry.disabled}>
                <Slot for={() => slots.link?.(entry)}>{entry.label}</Slot>
              </Link>
            </>
          )}
        </For>
      ) : (
        props.children
      )}
    </nav>
  );
}, 'Breadcrumb');

/**
 * Decorative delimiter between crumbs. Seen, never announced.
 */
export const BreadcrumbSeparator = setup<BreadcrumbSeparatorProps>((props) => {
  const separator = aria(BREADCRUMB_SEPARATOR_ROLE, props);
  const className = () => $families(AUI_CLASS.BREADCRUMB_SEPARATOR, props, auiConfig.breadcrumbSeparator);

  return () => (
    <span ref={separator.ref} {...separator.restProps([...OMIT_KEYS])} className={className()}>
      {props.children ?? '/'}
    </span>
  );
}, 'BreadcrumbSeparator');
