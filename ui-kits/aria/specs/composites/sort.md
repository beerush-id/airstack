# Sort Specification

The single-criterion sort coordinator unit. Sortable headers expose the active key and direction while data comparison,
fetching, and row ordering remain caller-owned; this unit does not sort data.

- **Entity**: `sort`
- **WAI-ARIA Semantic**: `aria-sort="ascending" | "descending"` on active headers

### Composite Parts (Entity Tree)

- **`Sort`**: Ambient coordinator (hosts `value: { key, direction } | null`, `disabled`).
- **`SortHeader`**: Header member identifying sortable column or row (`key: string`, `axis: 'column' | 'row'`).
- **`SortTrigger`**: Trigger button nested inside header (following Button contract).

---

## The Three Semantic Layers

| Part / Role       | HTML Semantic                                                   | WAI-ARIA Semantic                                                                                                              | Aria Package Semantic Contract                                  |
|:------------------|:----------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------|
| **`Sort`**        | Preserves native table or container semantics.                  | None.                                                                                                                          | Ambient coordinator. Props: `SortProps`.                        |
| **`SortHeader`**  | Native `<th>` (`scope="col"` / `scope="row"`) or custom header. | `role="columnheader"` / `role="rowheader"` (custom hosts only); `aria-sort="ascending" \| "descending"` on active header only. | Header identifier: `this.props.key`. Derives active sort state. |
| **`SortTrigger`** | Native `<button type="button">` or custom element.              | Follows Button contract. Never emits `aria-sort` on trigger itself.                                                            | Action trigger cycling sort state.                              |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SortProps`

```ts
export interface SortCriterion {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface SortProps {
  /** Active sort criterion */
  value?: SortCriterion | null;
  disabled?: boolean;
}
```

#### `SortHeaderProps`

```ts
export interface SortHeaderProps {
  /** Sort criterion key */
  key: string;
  /** Header axis (default: 'column') */
  axis?: 'column' | 'row';
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Sort: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'sort',
  props?: SortProps
): SortAria<E>;

// SortHeader: Table column/row header
export function aria<E extends BaseElement = HTMLTableCellElement>(
  role: 'sort-header',
  props: SortHeaderProps
): SortHeaderAria<E>;

// SortTrigger: Trigger button inside header
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'sort-trigger',
  props?: AriaProps
): SortTriggerAria<E>;
```

---

## State & Lifecycle Rules

1. **Three-State Cycling** (activation is on the **trigger**, not the header — `docs/sort.md:27-29,33`; headers receive
   no controller tab stop, every enabled trigger is normally tabbable and there is no roving focus):
  - Inactive header's trigger activated &rarr; `{ key, direction: 'ascending' }`.
  - Ascending header's trigger &rarr; `{ key, direction: 'descending' }`.
  - Descending header's trigger &rarr; `null` (unsorted). One activation = one transition; a native click and a key
    gesture must not double-fire (`:32`).

2. **Attribute Reflection**:
  - Only the active header emits `aria-sort="ascending"` or `aria-sort="descending"`.
  - Inactive headers remove `aria-sort` (never emit `aria-sort="none"` — `docs/sort.md:62`).
  - Triggers never emit `aria-sort` (`:72`).
  - On a native `<th>`, `scope` reflects `axis` (`col`/`row`, `:56`); custom headers get `role="columnheader"`/
    `role="rowheader"` by `axis` (`:59`). `axis` is written once and projected to whichever mechanism the host uses.

3. **Events**:
  - `change` — Dispatched on container after sort commits as
    `CustomEvent<SortCriterion | null>('change', { bubbles: true, detail: group.value })`. A notification, not a veto.
