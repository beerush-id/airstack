# Reorder Specification

The within-collection reorder coordinator unit. Pointer and keyboard interactions preview a new order of existing items before committing it; file drops, cross-collection transfer, sorting comparators, and styling controls are outside this unit.

- **Entity**: `reorder`
- **WAI-ARIA Role**: Preserves underlying collection role (`list`, `table`, `tree`), `role="status"` on announcer

### Composite Parts (Entity Tree)
- **`Reorder`**: Container coordinator (hosts `value`, `preview`, `active`, `orientation`, `disabled`, `label`).
- **`ReorderItem`**: Individual item wrapper (`value: string`, `label?: string`).
- **`ReorderHandle`**: Drag and keyboard handle within item (following Button contract).
- **`ReorderStatus`**: Accessible live region announcer (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Reorder`** | Preserves container semantics (`<ul>`, `<table>`, `<div>`). | Preserves collection role. `aria-disabled="true"` when disabled. | Coordinator. Hosts `value: string[]`, `preview: string[]`, `active: string \| null`. |
| **`ReorderItem`** | Preserves item semantics (`<li>`, `<tr>`). | Preserves item role (`listitem` in list context). | Item identifier: `this.props.value`. |
| **`ReorderHandle`** | Native `<button type="button">` or custom host. | Follows Button contract. Accessible name: `Move [item label]`. | Initiates pickup, drop, and keyboard movement. |
| **`ReorderStatus`** | Announcement container. | `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. | Announces pickup, position changes, drop, and cancel. |

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

1. **Pickup, Movement, and Drop**:
   - `Enter` / `Space` / pointer drag on idle handle picks up item, sets `active = item.value`, copies `value` to `preview`.
   - Arrow keys (`Up`/`Down` or `Left`/`Right` with LTR/RTL support) move slot by slot, updating `preview`.
   - Second `Enter` / `Space` / pointer release drops: commits `value = preview`, clears `active`, emits `change`.
   - `Escape` or `Tab` cancels: restores `preview` from `value`, clears `active`, emits `cancel`.
   - ReorderStatus announces progress after each state change.
