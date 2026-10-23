import { AUI_CLASS, branded, COLORS, register, SIZES } from '@airlib/aui/utils';
import { Show, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig } from '../config.js';
import { Avatar } from './Avatar.js';
import { listScope } from './context.js';

export type ListProps = Omit<AuiProps<'ul'>, 'variant'> & {
  /** Names the list for screen readers, e.g. "Unread mail". */
  label?: string;
  children?: ReactNode;
};

export type ListItemProps = Omit<AuiProps<'li'>, 'title' | 'variant'> & {
  /** What the row is: a sender, an event, a file name. */
  title: string;
  /** One supporting line under it: a subject, a place, a size. */
  description?: string;
  /** What sits at its end: a time, a date, a count. */
  meta?: string;
  /** A picture leading the row; without one, nothing leads it. Its initials come from `title`. */
  image?: string;
  /** What else the row holds, after its text: badges, chips, a button. */
  children?: ReactNode;
};

const CLASS = {
  LIST: branded('list'),
  ITEM: branded('list-item'),
  LEAD: branded('list-item-lead'),
  TEXT: branded('list-item-text'),
  TITLE: branded('list-item-title'),
  DESCRIPTION: branded('list-item-description'),
  META: branded('list-item-meta'),
  END: branded('list-item-end'),
};

const LIST_OMIT: Array<keyof ListProps> = ['label', 'children', 'className', 'size', 'color'];
const ITEM_OMIT: Array<keyof ListItemProps> = ['title', 'description', 'meta', 'image', 'children', 'className', 'size', 'color'];

register('list', { size: SIZES.MD, color: COLORS.SECONDARY });

/**
 * Rows of the same kind — an inbox, an agenda, a file list, a set of tasks —
 * each a `ListItem`, drawn as segments of one run. `size` and `color` reach
 * every row without its own.
 */
export const List = setup<ListProps>((props) => {
  const className = () => $families([CLASS.LIST, AUI_CLASS.SCALE], props, auiConfig.list);

  listScope.provide(props);

  return () => (
    <ul {...props.$omit(LIST_OMIT)} aria-label={props.label} className={className()}>
      {props.children}
    </ul>
  );
}, 'List');

/**
 * One row of a list: a title and its supporting line, an optional picture
 * leading it, and what belongs at its end — a time, a count — with anything
 * else it holds after the text. Its own `color` tints this segment alone.
 */
export const ListItem = setup<ListItemProps>((props) => {
  const styles = listScope.inherit(props);
  const className = () => $families([CLASS.ITEM, AUI_CLASS.SCALE], styles);

  return () => (
    <li {...props.$omit(ITEM_OMIT)} className={className()}>
      <Show when={() => props.image}>
        {(src) => <Avatar src={src} alt={props.title} size={styles.size} className={CLASS.LEAD} />}
      </Show>
      <div className={CLASS.TEXT}>
        <span className={CLASS.TITLE}>{props.title}</span>
        <Show when={() => props.description}>
          {(description) => <span className={CLASS.DESCRIPTION}>{description}</span>}
        </Show>
      </div>
      <Show when={() => props.meta || props.children}>
        {() => (
          <div className={CLASS.END}>
            <Show when={() => props.meta}>{(meta) => <span className={CLASS.META}>{meta}</span>}</Show>
            {props.children}
          </div>
        )}
      </Show>
    </li>
  );
}, 'ListItem');
