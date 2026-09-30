# Reorder Specification

The within-collection reorder coordinator unit. Pointer and keyboard interactions preview a new order of existing items
before committing it; file drops, cross-collection transfer, sorting comparators, and styling controls are outside this
unit.

- **Entity**: `reorder`
- **WAI-ARIA Role**: Preserves underlying collection role (`list`, `table`, `tree`), `role="status"` on announcer

### Composite Parts (Entity Tree)

- **`Reorder`**: Container coordinator (hosts `value`, `preview`, `active`, `orientation`, `disabled`, `label`).
- **`ReorderItem`**: Individual item wrapper (`value: string`, `label?: string`).
- **`ReorderHandle`**: Drag and keyboard handle within item (following Button contract).
- **`ReorderStatus`**: Accessible live region announcer (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                                               | WAI-ARIA Semantic                                                | Aria Package Semantic Contract                                                       |
|:--------------------|:------------------------------------------------------------|:-----------------------------------------------------------------|:-------------------------------------------------------------------------------------|
| **`Reorder`**       | Preserves container semantics (`<ul>`, `<table>`, `<div>`). | Preserves collection role. `aria-disabled="true"` when disabled. | Coordinator. Hosts `value: string[]`, `preview: string[]`, `active: string \| null`. |
| **`ReorderItem`**   | Preserves item semantics (`<li>`, `<tr>`).                  | Preserves item role (`listitem` in list context).                | Item identifier: `this.props.value`.                                                 |
| **`ReorderHandle`** | Native `<button type="button">` or custom host.             | Follows Button contract. Accessible name: `Move [item label]`.   | Initiates pickup, drop, and keyboard movement.                                       |
| **`ReorderStatus`** | Announcement container.                                     | `role="status"`, `aria-live="polite"`, `aria-atomic="true"`.     | Announces pickup, position changes, drop, and cancel.                                |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ReorderProps`

```ts
export interface ReorderProps {
  /** Committed item order */
  value?: string[];
  /** Pending item order */
  preview?: string[];
  /** Active item being dragged */
  active?: string | null;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  label: string;
}
```

#### `ReorderItemProps`

```ts
export interface ReorderItemProps {
  value: string;
  label?: string;
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Reorder: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'reorder',
  props: ReorderProps
): ReorderAria<E>;

// ReorderItem: Item
export function aria<E extends BaseElement = HTMLElement>(
  role: 'reorder-item',
  props: ReorderItemProps
): ReorderItemAria<E>;

// ReorderHandle: Drag handle
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'reorder-handle',
  props?: AriaProps
): ReorderHandleAria<E>;

// ReorderStatus: Live announcer
export function aria<E extends BaseElement = HTMLElement>(
  role: 'reorder-status',
  props?: AriaProps
): ReorderStatusAria<E>;
```

---

## State & Lifecycle Rules

1. **Pickup, Movement, and Drop** (`docs/reorder.md:32-47`):
  - Idle handle: `Enter` / `Space` / AT click, or primary-button pointer drag **from the handle**, picks up — copies
    `value` into `preview` and sets `active` (committed `value` unchanged, `:32`). Pointer tracking continues outside
    the handle via capture and stays within this collection (`:34-36`).
  - Movement changes **only `preview`**: vertical `Up`/`Down`, horizontal `Left`/`Right` per layout direction; `Home`/
    `End` to first/last slot; one slot per key, clamped, no notification for an unchanged position (`:38-40`). Unrelated
    keys ignored.
  - **A disabled item is not a wall** (`:31,40`): other items move around it and its resulting position changes; it
    simply cannot initiate.
  - Second `Enter`/`Space`/release at a valid target drops: commit `preview` copy to `value`, **synchronize `preview`**,
    clear `active`, emit `change` (`:45`). An unchanged drop still synchronizes `preview`, clears `active`, and
    announces, but emits no `change` (`:46`).
  - `Escape` cancels; `Tab` cancels **without preventing its default** so focus continues (`:42`). Cancellation restores
    `preview` from committed `value`, clears `active`, emits `cancel` (`:47`). Disabling the group/active item
    mid-gesture, or losing the active item, cancels (`:43`).

2. **Focus** (`docs/reorder.md:52-53`): after keyboard completion/cancellation focus stays on or reconnects to the same
   item's handle (Tab exempt); if that handle is gone, a valid enabled handle, else the container becomes
   programmatically focusable — never Tab back into the collection.

3. **Status announcements** (`docs/reorder.md:78-81`): `ReorderStatus` is a `role="status"` polite live region reporting
   **pickup, each changed preview position, completion, and cancellation** using the **collection label, item label, and
   1-based position/total** (pickup/movement use preview order; completion/cancellation use committed order). A removed
   canceled item is named by captured label with the current total.

4. **Events** (`docs/reorder.md:55-62`): `input` (`detail: preview`) on changed preview position; `change`
   (`detail: value`) on a committed changed drop; `cancel`
   (`CustomEvent<string>{bubbles,cancelable:false,detail:canceledValue}`) after rollback. Post-state notifications, not
   vetoes; native handle clicks are not re-dispatched and one gesture never yields two transitions.
