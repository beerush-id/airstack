# Tree Specification

The hierarchical selection and disclosure unit. Coordinates depth-aware visible-node navigation, independent per-branch expansion, and single or multiple selection across nested levels.

- **Entity**: `tree`
- **WAI-ARIA Role**: `tree` (container), `treeitem` (node)

### Composite Parts (Entity Tree)

- **`Tree`** (`tree`): Root container coordinator (compiles `role="tree"`, `aria-multiselectable`, `aria-label`, `aria-labelledby`, `aria-disabled`, `aria-required`).
- **`TreeItem`** (`tree-item`): Hierarchical node (`role="treeitem"`, `id`, `aria-selected`, `aria-expanded` on branches only, `aria-disabled`, roving `tabindex`). Publishes ambient `treeItemCtx` for its child group and nested items.
- **`TreeGroup`** (`tree-group`): Branch children container (compiles `role="group"`, `aria-labelledby` paired automatically to its enclosing `TreeItem.id`, and `hidden` when the enclosing `TreeItem` is collapsed).

---

## The Three Semantic Layers

| Part / Role      | HTML Semantic         | WAI-ARIA Semantic                                                                                                                           | Aria Package Semantic Contract                                                                                                                                              |
|:-----------------|:----------------------|:--------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`tree`**       | `<ul>` / `<div>`.     | `role="tree"`, `aria-multiselectable="true" \| "false"`, `aria-label` from `label`, `aria-disabled`, `aria-required` when `required`.       | Selection group coordinator (`SingleTreeProps \| MultipleTreeProps`). Coordinates single/multi selection, `manual` mode, and depth-aware roving focus across visible nodes. |
| **`tree-item`**  | `<li>` / custom node. | `role="treeitem"`, `id` (paired for child group `aria-labelledby`), `aria-selected`, `aria-expanded` **on branches only**, `aria-disabled`. | Identified by `name` (or `value`). Owns per-branch `expanded?: boolean` (`undefined` on leaf nodes, boolean on branches). Publishes `treeItemCtx`.                          |
| **`tree-group`** | `<ul>` / `<div>`.     | `role="group"`, `aria-labelledby` (enclosing `TreeItem.id`), `aria-label` from `label`, `hidden` when parent branch is collapsed.           | Self-discovers enclosing `TreeItem` via `treeItemCtx`. Automatically wires `role="group"`, `aria-labelledby`, and `hidden={!item.expanded}`.                                |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleTreeProps`

```ts
export interface SingleTreeProps<T extends Primitive = string> extends GroupProps<T> {
  id?: string;
  multiple?: false;
  value?: T;
  manual?: boolean;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  labelledby?: string;
  onchange?: AriaEventHandler<TreeChangeEvent<T>>;
}
```

#### `MultipleTreeProps`

```ts
export interface MultipleTreeProps<T extends Primitive = string> extends GroupMultipleProps<T> {
  id?: string;
  multiple: true;
  value?: T[];
  manual?: boolean;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  labelledby?: string;
  onchange?: AriaEventHandler<TreeChangeEvent<T[]>>;
}
```

#### `TreeProps`

```ts
export type TreeProps<T extends Primitive = string> = SingleTreeProps<T> | MultipleTreeProps<T>;
```

#### `TreeItemProps`

```ts
export interface TreeItemProps<T extends Primitive = string> extends AriaProps {
  id?: string;
  /** Semantic node identifier used for selection matching */
  name?: T;
  /** Alias for node selection value when `name` is not provided */
  value?: T;
  /** Branch expansion state; `boolean` marks a branch (`aria-expanded`), `undefined` marks a leaf (omits `aria-expanded`) */
  expanded?: boolean;
  disabled?: boolean;
  label?: string;
  ontoggle?: AriaEventHandler<TreeItemToggleEvent>;
}
```

#### `TreeGroupProps`

```ts
export interface TreeGroupProps extends AriaProps {
  id?: string;
  label?: string;
  labelledby?: string;
}
```

### 2. Overload Contracts

```ts
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = string>(
  role: 'tree',
  props?: TreeProps<T>
): TreeAria<E, TreeProps<T>>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = string>(
  role: 'tree-item',
  props?: TreeItemProps<T>
): TreeItemAria<E, TreeItemProps<T>>;

export function aria<E extends BaseElement = HTMLElement>(
  role: 'tree-group',
  props?: TreeGroupProps
): TreeGroupAria<E, TreeGroupProps>;
```

---

## State & Lifecycle Rules

1. **Branch vs. Leaf Semantics & Automatic Group Pairing**:
   - A `TreeItem` with `expanded !== undefined` (or containing a `TreeGroup` child) is a **branch** and compiles `aria-expanded="true" | "false"`.
   - A `TreeItem` with `expanded === undefined` and no child group is a **leaf** and **omits `aria-expanded`** completely.
   - `TreeGroup` discovers its enclosing `TreeItem` via ambient `treeItemCtx` and automatically compiles `role="group"`, `aria-labelledby={parentItem.id}`, and `hidden={!parentItem.expanded}`.

2. **Depth-Aware Keyboard Navigation**:
   - **Visible Nodes**: Traversal visits `[role="treeitem"]` elements in document order, skipping any node inside a collapsed ancestor (`[role="treeitem"][aria-expanded="false"] [role="treeitem"]`) or disabled node.
   - **`ArrowDown` / `ArrowUp`**: Moves focus to the next / previous visible enabled `treeitem` in document order without wrapping. When `manual === false` (automatic selection mode), moving focus also commits selection.
   - **`Home` / `End`**: Moves focus to the first / last visible enabled `treeitem`.
   - **`ArrowRight`**:
     - On a collapsed branch (`aria-expanded="false"`): expands the branch (`expanded = true`) without moving focus or selecting.
     - On an expanded branch (`aria-expanded="true"`): moves focus to its first visible enabled child `treeitem`.
     - On a leaf node: does nothing.
   - **`ArrowLeft`**:
     - On an expanded branch (`aria-expanded="true"`): collapses the branch (`expanded = false`) without moving focus.
     - On a collapsed branch or leaf node inside a parent `treeitem`: moves focus to the nearest enclosing parent `[role="treeitem"]`.
     - On a top-level collapsed branch or leaf: does nothing.

3. **Selection & Activation**:
   - By default (`manual` defaults to `true`), arrow keys move focus without changing selection. Setting `manual: false` commits selection on vertical focus movement.
   - **`Enter` / `Space` / Click**: Commits selection on the target `treeitem` (without bubbling activation from a child `treeitem` to its parent `treeitem`):
     - **Single-select (`!multiple`)**: selects the node (`tree.value = itemKey`). Re-activating an already-selected node deselects it (`tree.value = undefined`) unless `required: true`.
     - **Multi-select (`multiple: true`)**: toggles `itemKey` in `tree.value` array.

4. **Disabled Lockout**:
   - A disabled `TreeItem` (`aria-disabled="true"`) cannot be selected or expanded/collapsed via keyboard or pointer.
   - When the `Tree` container is `disabled`, all items are disabled and keyboard traversal is inert.

5. **Events**:
   - `change`: Dispatched on `Tree` when selection changes (`CustomEvent` with `detail: tree.value`), invoking `onchange`.
   - `toggle`: Dispatched on `TreeItem` when branch expansion toggles (`CustomEvent<boolean>` with `detail: item.expanded`), invoking `ontoggle`.
