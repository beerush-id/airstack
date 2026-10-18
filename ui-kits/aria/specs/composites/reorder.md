# Reorder Specification

The within-collection reorder coordinator unit. Keyboard and pointer interactions preview a new order of existing items before committing it; labels and live announcements remain strictly in user-land via `oninput`, `onchange`, and `oncancel` events.

- **Entity**: `reorder`
- **WAI-ARIA Role**: Preserves underlying collection semantics (`<ul>`, `<ol>`, `<table>`, `<div>`)

### Composite Parts (Entity Tree)

- **`Reorder`** (`reorder`): Container coordinator hosting `value`, `preview`, `active`, `orientation`, `disabled`, `label`, `labelledby`, and lifecycle events (`oninput`, `onchange`, `oncancel`).
- **`ReorderItem`** (`reorder-item`): Individual item wrapper (`value`, `disabled`, `label`). Publishes ambient `reorderItemCtx` for its child handle.
- **`ReorderHandle`** (`reorder-handle`): Interactive handle inside an item (extends `ButtonAria`, defaulting to `native: true`). Initiates pickup, clamped slot movement, drop commit, and cancellation.

---

## The Three Semantic Layers

| Part / Role          | HTML Semantic                                               | WAI-ARIA Semantic                                                            | Aria Package Semantic Contract                                                                                     |
|:---------------------|:------------------------------------------------------------|:-----------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------|
| **`reorder`**        | Preserves container semantics (`<ul>`, `<table>`, `<div>`). | Preserves collection role. `aria-label`, `aria-labelledby`, `aria-disabled`. | Coordinator. Hosts `value: T[]`, `preview: T[]`, `active: T \| null`, `orientation: 'vertical' \| 'horizontal'`.   |
| **`reorder-item`**   | Preserves item semantics (`<li>`, `<tr>`, `<div>`).         | Preserves item role. `aria-label`, `aria-disabled`.                          | Item identifier (`value`). Publishes `reorderItemCtx`.                                                             |
| **`reorder-handle`** | Native `<button type="button">` or custom host.             | Follows `Button` contract (`aria-label` from `label`, `aria-disabled`).      | Discovers enclosing `Reorder` and `ReorderItem`. Initiates pickup, clamped preview movement, drop, and cancel.     |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ReorderProps`

```ts
export interface ReorderProps<T extends Primitive = string> extends AriaProps {
  id?: string;
  /** Committed item order */
  value?: T[];
  /** Pending item order during active reorder */
  preview?: T[];
  /** Active item currently picked up (`null` when idle) */
  active?: T | null;
  /** Movement axis (default: 'vertical') */
  orientation?: Orientation;
  disabled?: boolean;
  label?: string;
  labelledby?: string;
  oninput?: AriaEventHandler<ReorderEvent<T[]>>;
  onchange?: AriaEventHandler<ReorderEvent<T[]>>;
  oncancel?: AriaEventHandler<ReorderCancelEvent<T>>;
}
```

#### `ReorderItemProps`

```ts
export interface ReorderItemProps<T extends Primitive = string> extends AriaProps {
  id?: string;
  value: T;
  label?: string;
  disabled?: boolean;
}
```

#### `ReorderHandleProps` & `ReorderHandleOptions`

```ts
export interface ReorderHandleProps extends ButtonProps {
  id?: string;
  label?: string;
  disabled?: boolean;
}

export type ReorderHandleOptions = ButtonOptions;
```

### 2. Overload Contracts

```ts
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = string>(
  role: 'reorder',
  props?: ReorderProps<T>
): ReorderAria<E, ReorderProps<T>>;

export function aria<E extends BaseElement = HTMLElement, T extends Primitive = string>(
  role: 'reorder-item',
  props: ReorderItemProps<T>
): ReorderItemAria<E, ReorderItemProps<T>>;

export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'reorder-handle',
  props?: ReorderHandleProps,
  options?: ReorderHandleOptions
): ReorderHandleAria<E, ReorderHandleProps>;
```

---

## State & Lifecycle Rules

1. **Pickup, Clamped Movement, and Drop**:
   - **Idle Handle**: Pressing `Enter` or `Space`, clicking, or pressing `pointerdown` (primary button) on an enabled handle picks up its enclosing item — copies `value` into `preview` (`[...value]`) and sets `active = item.value` while keeping committed `value` untouched.
   - **Pointer Dragging**:
     - Holding and dragging the handle (`pointermove`) compares the pointer position (`clientY` for vertical, `clientX` for horizontal) against the visual slot midpoints of the collection's mounted items and moves the active item into the crossed slot in `preview`, dispatching `input` (`detail: preview`).
     - Releasing the pointer (`pointerup`) after dragging drops the item and commits the order if changed.
     - `pointercancel` cancels the active drag and restores `preview = [...value]`.
   - **Movement (Active State)**:
     - Changes **only `preview`**, clamped to `[0, preview.length - 1]`:
       - `orientation === 'vertical'` (default): `ArrowUp` (`-1`), `ArrowDown` (`+1`). Horizontal arrows are ignored.
       - `orientation === 'horizontal'`: `ArrowLeft` (`-1`), `ArrowRight` (`+1`). Vertical arrows are ignored.
       - `Home`: moves active item to index `0`.
       - `End`: moves active item to index `preview.length - 1`.
     - When `preview` order changes, dispatches `input` (`detail: preview`) and invokes `oninput`. Pressing an arrow at a boundary where position cannot change is a no-op and does not emit `input`.
   - **Disabled Items**:
     - A disabled item (`disabled: true` on `ReorderItem` or `ReorderHandle`) cannot initiate pickup, but other active items can move past it in `preview`.
     - When the `Reorder` container is `disabled`, no item can be picked up or moved.
   - **Drop (Commit)**:
     - Pressing `Enter` or `Space` (or clicking / releasing a drag) while `active === item.value` drops the item:
       - If `preview` order differs from `value`, commits `value = [...preview]`, synchronizes `preview = [...value]`, clears `active = null`, and dispatches `change` (`detail: value`), invoking `onchange`.
       - If `preview` order is unchanged from `value`, synchronizes `preview = [...value]` and clears `active = null` without emitting `change`.
   - **Cancellation**:
     - `Escape` cancels (`preventDefault()`): restores `preview = [...value]`, clears `active = null`, and dispatches `cancel` (`detail: canceledValue`), invoking `oncancel`.
     - `Tab` cancels **without preventing default** so focus continues naturally: restores `preview = [...value]`, clears `active = null`, and dispatches `cancel` (`detail: canceledValue`), invoking `oncancel`.
     - `pointercancel` during an active pointer drag cancels and dispatches `cancel` (`detail: canceledValue`), invoking `oncancel`.
