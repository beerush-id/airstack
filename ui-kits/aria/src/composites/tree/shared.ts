export const ROLE_TREE = 'tree';
export const ROLE_TREE_ITEM = 'treeitem';
export const ROLE_TREE_GROUP = 'group';

export const ENABLED_ITEM_SELECTOR = '[role="treeitem"]:not([aria-disabled="true"]):not(:disabled)';
export const VISIBLE_ITEM_SELECTOR = `${ENABLED_ITEM_SELECTOR}:not([aria-expanded="false"] *)`;
