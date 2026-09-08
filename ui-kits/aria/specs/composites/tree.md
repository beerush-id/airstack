# Tree Specification

A tree widget presents a hierarchical list. Any item in the tree may have child items under an expandable branch.

### Composite Parts
- **`Tree`**: WAI-ARIA `tree`
- **`TreeItem`**: WAI-ARIA `treeitem`
- **`TreeGroup`**: WAI-ARIA `group`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`tree`** | Hierarchical list structure (`<ul>` / `<li>`). | `role="tree"`, `aria-label` / `aria-labelledby`, `aria-multiselectable` (`"true"` if multi, `"false"` if single). | Container group controller. Props: `SingleTreeProps` (default) \| `MultipleTreeProps` (`multiple: true`). Manages 2D hierarchical focus navigation. |
| **`tree-item`** | Tree node element (`<li>` or `<div>`). | Compiles `role="treeitem"`, `aria-selected` (`"true"` \| `"false"`), `aria-expanded` (if branch), `id`. | Member identifier: `this.props.name`.<br>- **Single Active**: `this.group.value === this.props.name`.<br>- **Multiple Active**: `this.group.value?.includes(this.props.name)`.<br>Branch expands/collapses nested group. |
| **`group`** | Subtree container (`<ul>` or `<div>`). | `role="group"`, `aria-labelledby` (parent node ID). | Subtree container; passes the parent tree scope through unchanged (no new scope, no overload). Branch expansion state lives on each `TreeItem`'s own props (`expanded`); selection lives on `group.value`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleTreeProps`
```ts
export interface SingleTreeProps {
  multiple?: false;
  /** Optional DOM element identifier */
  id?: string;
  value?: string;
  /** When true, arrows move focus without selecting until Enter/Space (default: true) */
  manual?: boolean;
  required?: boolean;
  disabled?: boolean;
}

export interface MultipleTreeProps {
  multiple: true;
  /** Optional DOM element identifier */
  id?: string;
  value?: string[];
  required?: boolean;
  disabled?: boolean;
}

export type TreeProps =
  | SingleTreeProps
  | MultipleTreeProps;
```

### 2. Overload Contracts

```ts
// Tree: Container group controller (single-only default)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tree',
  props?: SingleTreeProps
): TreeAria<E>;

// Tree: Multiple selection overload
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tree',
  props: MultipleTreeProps
): TreeAria<E>;

// TreeItem: Tree node member
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tree-item',
  props: TreeItemProps
): TreeItemAria<E>;
```

#### `TreeItemProps`
```ts
export interface TreeItemProps {
  name: string;
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
}
```

---

## State & Lifecycle Rules

1. **Active Check**:
   - Single: `this.group.value === this.props.name`
   - Multiple: `this.group.value?.includes(this.props.name)`

2. **Activation & Selection**:
   - Single:
     - If active and `!this.group.required`: Deselects via `delete this.group.value`.
     - If active and `this.group.required`: Idempotent.
     - If inactive: Assigns `this.group.value = this.props.name`.
   - Multiple:
     - Toggles item into/out of array (`this.group.value`).

3. **Keyboard Navigation**:
   - `ArrowDown` / `ArrowUp`: Moves focus to next / previous visible node.
   - `ArrowRight`: Expands a closed branch, or moves focus to the first child of an open branch.
   - `ArrowLeft`: Collapses an open branch, or moves focus to the parent node.
   - `Enter` / `Space`: Selects the focused node.
   - Single defaults to manual (`manual !== false`): focus and selection are separate concerns, so arrows never select. Multiple declares no `manual`.

4. **State Projections**: `selected` reads `this.group.value` membership and writes the same store; `expanded` reads and writes the item's own props. Props is the single source of state.
