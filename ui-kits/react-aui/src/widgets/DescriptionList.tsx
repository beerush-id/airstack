import { branded, register } from '@airlib/aui/utils';
import { For, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, type AuiProps, auiConfig } from '../config.js';

/** One fact: what it is, and its value. */
export type DescriptionItem = { label: string; value: string };

export type DescriptionListProps = Omit<AuiProps<'dl'>, 'variant'> & {
  /** The facts, in order: "When" and "Tomorrow, 9:00", "Where" and "Room 4". */
  items?: DescriptionItem[];
  /** Lays each label beside its value (default), or above it. */
  layout?: 'inline' | 'stacked';
  children?: ReactNode;
};

const CLASS = {
  LIST: branded('description-list'),
  ITEM: branded('description-item'),
  STACKED: branded('description-list-stacked'),
};

const OMIT: Array<keyof DescriptionListProps> = ['items', 'layout', 'children', 'className', 'size', 'color'];

register('descriptionList', {});

/**
 * Facts about one thing, as labels and their values: a meeting's when, where,
 * and who; a file's size and owner. Give them as `items`.
 */
export const DescriptionList = setup<DescriptionListProps>((props) => {
  const className = () =>
    [$families(CLASS.LIST, props, auiConfig.descriptionList), props.layout === 'stacked' && CLASS.STACKED]
      .filter(Boolean)
      .join(' ');

  return () => (
    <>
      <dl {...props.$omit(OMIT)} className={className()}>
        <For each={() => props.items ?? []}>
          {(item) => (
            <div className={CLASS.ITEM}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          )}
        </For>
      </dl>
      {props.children}
    </>
  );
}, 'DescriptionList');
