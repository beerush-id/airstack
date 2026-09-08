# Popover Specification

A popover is a disclosure overlay presenting rich content (forms, filters, menus) anchored to a trigger element. It is dismissible via outside interaction or `Escape`, and returns focus to its trigger on close.

- **Role**: `popover`
- **WAI-ARIA Role**: `dialog` (or `menu` for menu popovers; popover is an Aria entity, not a WAI-ARIA token)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Popover Overlay** | Floating container (`<div>`). | Compiled role per content (`dialog` default), `id`. Referenced by host trigger via `aria-haspopup`, `aria-expanded`, `aria-controls`. | Ambient self-discovering overlay (`this.scope`). Wires trigger toggle, light-dismiss, `Escape` handling, and focus restoration. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `PopoverOptions`
```ts
export interface PopoverOptions {
  /** Compiled popup role (default: 'dialog') */
  popupRole?: 'dialog' | 'menu';
}
```

#### `PopoverProps`
```ts
export interface PopoverProps {
  /** Optional DOM element identifier (referenced by host trigger aria-controls) */
  id?: string;
  /** Explicit open state */
  open?: boolean;
  /** Whether interaction outside the popover dismisses it (default: true) */
  lightDismiss?: boolean;
}
```

### 2. Overload Contract

```ts
// Popover: Disclosure overlay anchored to its scope host
export function aria<E extends BaseElement = HTMLElement>(
  role: 'popover',
  props?: PopoverProps,
  options?: PopoverOptions
): PopoverAria<E>;
```

---

## State & Lifecycle Rules

1. **Overlay Linkage**:
   - Discovers trigger controller via ambient scope (`this.scope`); falls back to `this.element.parentElement` when nested in a plain HTML tag (see spec.md §8).
   - Injects `aria-haspopup="dialog"`, `aria-expanded="{open}"`, and `aria-controls="{popover.id}"` onto the host while mounted (via host refiner when scoped, direct DOM mutation on fallback).

2. **Trigger Wiring**:
   - In `attach()`, binds click toggle to the host element.

3. **Dismissal**:
   - Light-dismiss (pointer down outside) closes unless `lightDismiss: false`.
   - `Escape` closes and restores focus to the host trigger.

4. **Focus Management**:
   - On open, captures `document.activeElement`; on close or unmount, restores focus to the host trigger.
   - Does not trap focus (non-modal disclosure).
