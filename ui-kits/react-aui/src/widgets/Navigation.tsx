import { aria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { For, Slot, setup } from '@airlib/react';
import type { ComponentProps, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import type { LinkEntry } from '../utils/common.js';
import { Link } from './Link.js';

export type NavigationSlots = {
  link: (entry: LinkEntry) => ReactNode;
};

export type NavigationProps = Omit<ComponentProps<'nav'>, 'className' | 'color'> &
  Omit<ComponentStyles, 'variant'> & {
    label?: string;
    labelledby?: string;
    links?: LinkEntry[];
    children?: ReactNode;
  };

const NAVIGATION_ROLE = 'navigation';

register('navigation', { size: SIZES.MD, color: COLORS.PRIMARY });

/**
 * Named landmark holding one tab stop across its links.
 * Arrows travel vertically and wrap; activation stays with the links.
 * With `links` it renders one link row per entry; the `link` slot refines
 * each row's content.
 */
export const Navigation = setup<NavigationProps, NavigationSlots>((props, slots) => {
  const nav = aria(NAVIGATION_ROLE, props);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.NAVIGATION], props, auiConfig.navigation);

  return () => (
    <nav ref={nav.ref} {...nav.restProps([...OMIT_KEYS, 'labelledby', 'links'])} className={className()}>
      {props.links ? (
        <For each={() => props.links!}>
          {(entry) => (
            <Link href={entry.href} current={entry.current} disabled={entry.disabled}>
              <Slot for={() => slots.link?.(entry)}>{entry.label}</Slot>
            </Link>
          )}
        </For>
      ) : (
        props.children
      )}
    </nav>
  );
}, 'Navigation');
