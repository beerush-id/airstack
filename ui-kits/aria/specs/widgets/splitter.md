# Splitter Specification

The two-pane resizing unit. Coordinates pointer and keyboard resizing within declared bounds and exposes the adjustable
pane size to assistive technology. Per `docs/splitter.md`, this is a **three-part unit**, not a single element.

- **Entity**: `splitter`
- **Handle WAI-ARIA Role**: `separator` (compiled output; omitted when the host already supplies it, as `<hr>` does)

### Parts (Entity Tree)

- **`Splitter`**: Container coordinator (hosts ambient size state; no additional role).
- **`SplitterPane`** ×2: Panes with `position: 'first' | 'second'` (exactly one each); ensure their own IDs, preserve
  content semantics and focusable descendants.
- **`SplitterHandle`**: The movable partition — the element that owns the `separator` role, the tab stop, the value
  attributes, and the keyboard/pointer contract.

---

## The Three Semantic Layers

| Part / Host                | HTML Semantic                                           | WAI-ARIA Semantic                                                                                                                                                                                                                                                                          | Aria Package Semantic Contract                                                                             |
|:---------------------------|:--------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------|
| **`Splitter` (container)** | Group wrapper (`<div>`).                                | No additional role; preserves existing semantics.                                                                                                                                                                                                                                          | Hosts `value`/`min`/`max`/`step`/`page`/`orientation`/`disabled`/`label` without retaining pane instances. |
| **`SplitterPane`**         | Region element.                                         | None added.                                                                                                                                                                                                                                                                                | First pane takes `value`% of available space; second takes the remainder.                                  |
| **`SplitterHandle`**       | `<div>`, or `<hr>` where the host supplies `separator`. | `role="separator"` (unless host supplies it), `aria-orientation`, `aria-controls` (first pane id), `aria-label`, `aria-valuemin/max/now/text`; `tabindex="0"` when enabled, excluded from sequential focus when `disabled` (`aria-disabled="true"`, native disabling used when supported). | Interactive range control: pointer drag + keyboard stepping, clamped to `[min, max]`.                      |

---

## Architectural & Behavioral Contracts

### 1. Props Contract (`SplitterProps`, hosted by the container)

```ts
export interface SplitterProps {
  /** First pane's percentage of available space along the resize axis (default: 50) */
  value?: number;
  /** Minimum first-pane percentage, 0–100 (default: 0) */
  min?: number;
  /** Maximum first-pane percentage, min–100 (default: 100) */
  max?: number;
  /** Keyboard increment in percentage points; positive (default: 1) */
  step?: number;
  /** Large keyboard increment in percentage points; positive (default: 10) */
  page?: number;
  /** Handle direction: 'vertical' (side-by-side panes) | 'horizontal' (stacked) (default: 'vertical') */
  orientation?: 'horizontal' | 'vertical';
  /** Resize-blocking flag (default: false) */
  disabled?: boolean;
  /** Accessible handle name identifying the resized pane. Required. */
  label: string;
}
```

> The handle is the element that receives the ARIA range contract. `aria-orientation` reflects the **handle's**
> orientation, not the direction its boundary moves. There is no native-counterpart host for a `splitter`; the handle is a
> focusable `separator`.

### 2. Overload Contracts

```ts
// Splitter: container coordinator
export function aria<E extends BaseElement = HTMLElement>(role: 'splitter', props?: SplitterProps): SplitterAria<E>;
// SplitterPane
export function aria<E extends BaseElement = HTMLElement>(
  role: 'splitter-pane',
  props?: { position: 'first' | 'second' }
): SplitterPaneAria<E>;
// SplitterHandle
export function aria<E extends BaseElement = HTMLElement>(
  role: 'splitter-handle',
  props?: AriaProps
): SplitterHandleAria<E>;
```

---

## State & Lifecycle Rules

1. **Value & Bounds**:
  - `value` is clamped to `[min, max]`. Resizing one pane adjusts the other, preserving total available space. A
    zero-size available area produces no resize update.

2. **Keyboard (handle), axis-dependent** (`docs/splitter.md:30-32`):
  - **Vertical handle** (side-by-side panes): `Left`/`Right` move the boundary by `step` (LTR: Right grows first pane;
    reverses in RTL).
  - **Horizontal handle** (stacked panes): `Up` shrinks, `Down` grows the first pane by `step`.
  - `PageUp` grows by `page`; `PageDown` shrinks by `page`. `Home` commits `min`; `End` commits `max`.
  - Keys for the **unrelated axis** preserve their normal browser behavior. Clamped to bounds; `preventDefault` only
    when the handle consumes the key.

3. **Pointer drag**: primary-pointer drag on the handle updates the percentage from the handle position along the resize
   axis; tracking persists outside the handle until pointer release/cancellation. Pointer resizing is continuous,
   **not** snapped to `step`.

4. **Disabled & Cancellation**:
  - `disabled` blocks pointer and keyboard resizing and excludes the handle from sequential focus without changing the
    current allocation; a mid-drag disable ends tracking at the last committed size.
  - A canceled initiating pointer/keyboard event (`defaultPrevented`) starts no resize and commits no value.

5. **Events** (dispatched on the SplitterHandle):
  - `input` — after each different size commits during interaction,
    `CustomEvent<number>('input', { bubbles: true, detail: value })`.
  - `change` — when a drag ends with a value different from its start, or a keyboard action commits a different value,
    `CustomEvent<number>('change', { bubbles: true, detail: value })`.

6. **Static boundary**: for a value-less, non-focusable divider, see [divider.md](divider.md).
