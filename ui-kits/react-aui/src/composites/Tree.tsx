import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, type Bindable, setup } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type TreeValue = string | string[];

export type TreeProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  value?: Bindable<TreeValue>;
  multiple?: boolean;
  manual?: boolean;
  required?: boolean;
  disabled?: boolean;
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
  children?: ReactNode;
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
register('treeItem', {});
register('treeGroup', {});

/**
 * Nested hierarchy driven by one roving stop per selected node. Arrows walk
 * only visible nodes across every level, and selection stays coordinated
 * between root items and deeply nested children alike.
 */
export const Tree = setup<TreeProps>((props) => {
  const tree = aria(TREE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TREE, props, auiConfig.tree);

  return () => (
    <ul ref={tree.ref} {...tree.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </ul>
  );
}, 'Tree');

/**
 * One node. A leaf selects; a branch — marked by `expanded` or by a nested
 * `TreeGroup` — opens and closes without disturbing its siblings.
 */
export const TreeItem = setup<TreeItemProps>((props) => {
  const item = aria(TREE_ITEM_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.TREE_ITEM, props, auiConfig.treeItem);

  return () => (
    <li ref={item.ref} {...item.restProps(ITEM_OMIT)} className={className()}>
      {props.children}
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
