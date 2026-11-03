import { aria, type TreeItemAria } from '@airlib/aria';
import { AUI_CLASS, COLORS, register, SIZES } from '@airlib/aui/utils';
import { type AnyType, type Bindable, For, renderDynamic, Slot, setup } from '@airlib/react';
import type { MouseEvent, ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';
import { ArrowRight } from '../icons/index.js';
import { createStyleScope } from '../utils/common.js';

export type TreeValue = string | string[];

/** One node of an `items` tree: a branch when it has `children`. */
export type TreeEntry = {
  name: string;
  label?: string;
  disabled?: boolean;
  expanded?: boolean;
  children?: TreeEntry[];
};

export type TreeSlots = {
  /** Content of each row; the node tells whether it's open, so a branch can show it. */
  item: (entry: TreeEntry, item: TreeItemAria) => ReactNode;
};

export type TreeProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  value?: Bindable<TreeValue>;
  multiple?: boolean;
  manual?: boolean;
  required?: boolean;
  disabled?: boolean;
  items?: TreeEntry[];
  children?: ReactNode;
  onchange?: (event: CustomEvent<TreeValue | undefined>) => void;
};

export type TreeItemProps = ComponentStyles & {
  id?: string;
  name?: string;
  value?: string;
  label?: string;
  expanded?: Bindable<boolean>;
  selected?: Bindable<boolean>;
  disabled?: boolean;
  children?: ReactNode | ((item: TreeItemAria) => ReactNode);
  ontoggle?: (event: CustomEvent<boolean>) => void;
};

export type TreeGroupProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  children?: ReactNode;
};

const TREE_ROLE = 'tree';
const TREE_ITEM_ROLE = 'tree-item';
const TREE_GROUP_ROLE = 'tree-group';

const ITEM_OMIT = [...OMIT_KEYS, 'labelledby', 'ontoggle'];

register('tree', {});
register('treeItem', { size: SIZES.SM, color: COLORS.PRIMARY });
register('treeGroup', {});

const treeScope = createStyleScope();

/**
 * Nested hierarchy driven by one roving stop per selected node. Arrows walk
 * only visible nodes across every level, and selection stays coordinated
 * between root items and deeply nested children alike. With `items` it
 * renders every node and branch itself; the `item` slot refines each row.
 */
export const Tree = setup<TreeProps, TreeSlots>((props, slots) => {
  const tree = aria(TREE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TREE, { className: props.className }, auiConfig.tree);

  treeScope.provide(props);

  const renderEntries = (entries: TreeEntry[]): ReactNode => (
    <For each={() => entries}>
      {(entry) => (
        <TreeItem
          name={entry.name}
          label={entry.children ? (entry.label ?? entry.name) : undefined}
          disabled={entry.disabled}
          expanded={entry.children ? (entry.expanded ?? false) : undefined}
        >
          {(item) => (
            <>
              <span>
                <Slot for={() => slots.item?.(entry, item)}>{entry.label ?? entry.name}</Slot>
              </span>
              {entry.children && <TreeGroup>{renderEntries(entry.children)}</TreeGroup>}
            </>
          )}
        </TreeItem>
      )}
    </For>
  );

  return () => (
    <ul ref={tree.ref} {...tree.restProps([...OMIT_KEYS, 'labelledby', 'items'])} className={className()}>
      {props.items ? renderEntries(props.items) : props.children}
    </ul>
  );
}, 'Tree');

/**
 * One node. A leaf selects; a branch — marked by `expanded` or by a nested
 * `TreeGroup` — opens and closes without disturbing its siblings. The row
 * is everything before the nested group; the highlight covers only the row.
 */
export const TreeItem = setup<TreeItemProps>((props) => {
  const styles = treeScope.inherit(props);
  const item = aria(TREE_ITEM_ROLE, props as AnyType);
  const className = () => $families([AUI_CLASS.SCALE, AUI_CLASS.TREE_ITEM], styles, auiConfig.treeItem);

  // The arrow opens and closes a branch. It claims the press during capture, before the row's own
  // listener runs, so pressing it never selects the row too.
  const handleToggle = (event: MouseEvent<HTMLSpanElement>) => {
    if (!item.isBranch) return;
    event.preventDefault();
    if (event.type === 'click') item.toggleExpand();
  };

  return () => (
    <li ref={item.ref} {...item.restProps(ITEM_OMIT)} className={className()}>
      <span
        aria-hidden="true"
        className={AUI_CLASS.TREE_TOGGLE}
        onClickCapture={handleToggle}
        onDoubleClickCapture={handleToggle}
      >
        <ArrowRight />
      </span>
      {renderDynamic(props.children, item)}
    </li>
  );
}, 'TreeItem');

/**
 * The children container of a branch. It pairs with its enclosing item on its
 * own, marks that item as a branch, and hides while the branch is collapsed.
 */
export const TreeGroup = setup<TreeGroupProps>((props) => {
  const group = aria(TREE_GROUP_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TREE_GROUP, props, auiConfig.treeGroup);

  return () => (
    <ul ref={group.ref} {...group.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </ul>
  );
}, 'TreeGroup');
