# Tree Specification

The hierarchical selection unit. Coordinates visible-node navigation, branch expansion, and **single** selection while
keeping expansion independent from the selected value (`docs/tree.md`).

### Composite Parts

- **`Tree`**: Container (`role="tree"`), one tab stop via `aria-activedescendant`.
- **`TreeItem`**: Node (`role="treeitem"`), `value`/`label` required.
- **`TreeItemGroup`**: A branch's children container (`role="group"`, `hidden` when collapsed), auto-associated with its
  ambient parent item.
- **`TreeItemToggle`**: Explicit expand/collapse button (`role` per Button), excluded from sequential focus (the tree
  owns the keyboard).

---

## The Three Semantic Layers

| Part / Role            | HTML Semantic               | WAI-ARIA Semantic                                                                                                                                                             | Aria Package Semantic Contract                                                                           |
|:-----------------------|:----------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------|
| **`tree`**             | `<ul>` / `<div>`.           | `role="tree"`, `aria-label` from `label`, `aria-activedescendant` (active visible node), `tabindex="0"` (custom; `aria-disabled` + no tab stop when disabled).                | Single selection. Hosts `value: string \| null` and `expanded: string[]`. No member registry.            |
| **`tree-item`**        | `<li>` / node.              | `role="treeitem"`, `aria-label` (node label), `aria-selected` (value match), `aria-expanded` **on branches only**, `aria-disabled`, own `id`. Excluded from sequential focus. | Selected when `tree.value === item.value`. A node with a child group is a branch; without one, a leaf.   |
| **`tree-item-group`**  | `<ul>` under a parent item. | `role="group"`; children nested under the parent in the a11y tree; **`hidden` when collapsed**.                                                                               | Associates with its ambient parent item automatically — the author does not hand-wire `aria-labelledby`. |
| **`tree-item-toggle`** | `<button>` / custom.        | `aria-expanded` (parent branch state), `aria-controls` (child group id), `aria-label` "Expand/Collapse [node]". Button activation; no sequential tab stop.                    | Changes only expansion; never selects.                                                                   |

---

## Architectural & Behavioral Contracts

### 1. Props Contracts

```ts
export interface TreeProps {
  id?: string;
  /** Selected node value; single selection (default: null) */
  value?: string;
  /** Values of expanded branches (default: []) — tree-level, not per-item */
  expanded?: string[];
  disabled?: boolean;
  /** Accessible tree name. Required. */
  label: string;
}

export interface TreeItemProps {
  /** Node identifier, unique within the tree. Required. */
  value: string;
  /** Node name for naming + typeahead, excluding descendant labels. Required. */
  label: string;
  disabled?: boolean;
}
```

> The tree is single-selection (no `multiple`, `required`, or `manual`). Arrows move focus without selecting
> (`docs/tree.md:27`); activation commits (`:32`). `expanded` is a tree-level array (`:12,24`), and item identity is
> `value` (`:18`).

### 2. Overload Contracts

```ts
export function aria<E extends BaseElement = HTMLElement>(role: 'tree', props?: TreeProps): TreeAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'tree-item', props: TreeItemProps): TreeItemAria<E>;
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tree-item-group',
  props?: AriaProps
): TreeItemGroupAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'tree-item-toggle',
  props?: AriaProps
): TreeItemToggleAria<E>;
```

---

## State & Lifecycle Rules

1. **Selection & expansion** (`docs/tree.md:24,32`): a node is selected when `tree.value === item.value`; a branch is
   expanded when its value is in `tree.expanded` — the two are independent. Pointer-on-label, `Enter`, or `Space`commits
   the node value; re-activating the selected node retains selection. `TreeItemToggle` changes expansion only.

2. **Focus model** (`:26-27`): the tree is **one sequential tab stop**; DOM focus stays on the container and the active
   node is exposed via `aria-activedescendant`. On entry the active node = previously-active visible enabled, else
   selected visible enabled, else first visible enabled. Focus entry and navigation never select.

3. **Keyboard** (`:28-32`): `Down`/`Up` move through visible enabled nodes (excluding collapsed descendants), `Home`/
   `End` to first/last visible enabled, clamped, scrolled into view. `Right` expands a collapsed branch, else moves to
   first child (leaf: nothing). `Left` collapses an expanded branch, else moves to nearest visible ancestor. Typeahead:
   case-insensitive **prefix** match, 500ms buffer; `Space` reserved for selection. Collapsing a branch holding the
   active node moves active to the branch (or nearest visible enabled ancestor); a hidden selected descendant stays
   selected.

4. **Disabled** (`:35`): disabled nodes can't be selected or directly expanded and are skipped; a disabled tree blocks
   all interaction and focus entry; canceled initiating interactions commit nothing.

5. **Events** (`:39-41`): `change` on container after a different selection commits
   (`CustomEvent<string | null>{bubbles,detail:value}`); `toggle` on container after the expanded collection changes
   (`CustomEvent<string[]>{bubbles,detail:expanded}`). Moving the active node emits neither.
