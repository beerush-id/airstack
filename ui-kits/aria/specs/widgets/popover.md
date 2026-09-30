# Popover Specification

The non-modal anchored floating panel unit. Coordinates light dismissal and focus management across the native HTML
Popover API and custom elements.

- **Role**: `popover`
- **WAI-ARIA Role**: `dialog` (or `menu` for menu popovers; popover is an Aria entity, not a WAI-ARIA token)

### Parts

- **`Popover`**: Container coordinator hosting ambient `open` and `dismissable` state.
- **`PopoverTrigger`**: Host toggle (self-discovered via `this.scope`).
- **`PopoverPanel`**: Floating panel; hidden when closed.

---

## The Three Semantic Layers

| Context                                | HTML Semantic                                                               | WAI-ARIA Semantic                                                                                                                           | Aria Package Semantic Contract                                               |
|:---------------------------------------|:----------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------|
| **Native Popover API**                 | Panel `popover="auto"` (dismissable) / `"manual"`; trigger `popovertarget`. | Native light dismissal + `ToggleEvent` pass through; the controller listens and does not re-dispatch.                                       | Anchored self-managing overlay following the declared `dismissable` setting. |
| **Custom Trigger (native `<button>`)** | `<button>`.                                                                 | `aria-expanded` reflects `open`; `aria-controls` → panel id; `disabled` reflects `disabled` (no `aria-disabled`).                           | Toggle wiring.                                                               |
| **Custom Trigger (non-button)**        | `<div>`/`<span>`.                                                           | `role="button"`, `aria-expanded`, `aria-controls`; `aria-disabled="true"` when `disabled`; `tabindex="0"` enabled, removed when `disabled`. | Toggle wiring + keyboard.                                                    |
| **Custom Panel**                       | `<div>`.                                                                    | `aria-haspopup` on the trigger reflects `popupRole` (`dialog` \| `menu`), **not** hardcoded; panel is hidden when closed.                   | Light-dismiss, `Escape`, focus-in on open (no trap), focus restore on close. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `PopoverOptions`

```ts
export interface PopoverOptions {
  /** Compiled popup role and the trigger's aria-haspopup value (default: 'dialog') */
  popupRole?: 'dialog' | 'menu';
}
```

#### `PopoverProps`

```ts
export interface PopoverProps {
  /** Optional DOM element identifier (referenced by host trigger aria-controls) */
  id?: string;
  /** Explicit open state (default: false) */
  open?: boolean;
  /** Light-dismissal flag: outside click + Escape dismiss when true (default: true). Source name is `dismissable` (docs/popover.md:12). */
  dismissable?: boolean;
  /** Horizontal placement token, translated to the `--anchor-x` custom property */
  xDir?: 'before' | 'after' | 'left' | 'between' | 'right';
  /** Vertical placement token, translated to the `--anchor-y` custom property */
  yDir?: 'above' | 'below' | 'between';
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
  - Discovers trigger controller via ambient scope (`this.scope`); falls back to `this.element.parentElement` for a
    plain HTML host (see spec.md §8).
  - Injects `aria-haspopup={popupRole}` (not a fixed `"dialog"`), `aria-expanded={open}`, and
    `aria-controls={popover.id}` onto the host while mounted (host refiner when scoped, direct DOM mutation on
    fallback).

2. **Trigger Wiring** (`docs/popover.md:16`): in `attach()`, binds click toggle to the host element; the trigger's
   disabled reflection is per host (`disabled` property on `<button>`, `aria-disabled` + tabindex removal on custom).

3. **Dismissal** (`docs/popover.md:18-19`):
  - `dismissable: true` (default): outside click or `Escape` commits `open = false`.
  - `dismissable: false`: outside clicks and `Escape` do not dismiss; trigger activation and explicit `open` writes can
    still close.

4. **Focus** (`docs/popover.md:17`): on open, focus moves into the panel without trapping; on close, focus returns to
   the trigger.

5. **Events** (`docs/popover.md:21-25`):
  - `toggle` — native Popover API: browser-dispatched `ToggleEvent`, controller listens and does not re-dispatch.
  - `toggle` — custom: dispatched on the **PopoverPanel** after `open` commits as
    `CustomEvent<boolean>('toggle', { bubbles: false, detail: open })`.

6. **Panel visibility** (`docs/popover.md:44`): the panel is `hidden` when closed.

7. **Anchoring & placement (CSS-only):** the controller's geometry job is limited to **generating the pair identifiers** — the anchor `id`s the trigger and panel share (via `anchor-name` in CSS) — and translating `xDir`/`yDir` into the `--anchor-x` / `--anchor-y` custom properties on the panel. There is **no JavaScript positioning**: no coordinate math, no `getBoundingClientRect`, no resize/scroll listener. The browser's native anchor-positioning features (`position-anchor`, `position-area`, `position-try`) resolve the actual box from those custom properties, and the author's stylesheet supplies the swap. `between` places the panel between the pair; concrete offsets are pure CSS, outside the contract.
