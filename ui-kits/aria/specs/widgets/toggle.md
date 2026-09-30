# Toggle Specification

A toggle is a two-state button that can be either off (not pressed) or on (pressed).

- **Role**: `toggle`
- **WAI-ARIA Role**: `button`

---

## The Three Semantic Layers

| Context                  | HTML Semantic                                                                          | WAI-ARIA Semantic                                                                                                                                                              | Aria Package Semantic Contract                                              |
|:-------------------------|:---------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------|
| **Native Toggle Button** | Native `<button type="button">`. Handles Space/Enter activation and native `disabled`. | No `role` (implicit). `aria-pressed` (`"true"` \| `"false"`); `disabled` reflects `disabled`; no `tabindex` emitted.                                                           | Two-state toggle widget. Exposes reactive `this.pressed` getter and setter. |
| **Custom Toggle Button** | Non-semantic element (`<div>`, `<span>`).                                              | `role="button"`, `aria-pressed` (`"true"` \| `"false"`); `tabindex="0"` when enabled, `tabindex` **removed** when `disabled` (not `-1`); `aria-disabled="true"` when disabled. | Polyfills Space/Enter key toggling and compiles ARIA attributes.            |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ToggleOptions`

```ts
export interface ToggleOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `ToggleProps<T extends Primitive = Primitive>`

```ts
export interface ToggleProps<T extends Primitive = Primitive> {
  /** Member value token when nested inside a toggle group */
  value?: T;
  /** Explicit toggle pressed state when standalone */
  pressed?: boolean;
  /** Disabled state */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Toggle: Two-state button (standalone, or group member with `value`)
export function aria<E extends BaseElement = HTMLButtonElement, T extends Primitive = Primitive>(
  role: 'toggle',
  props?: ToggleProps<T>,
  options?: ToggleOptions
): ToggleAria<E>;
```

---

## State & Lifecycle Rules

1. **HTML Type Attribute**:
  - When `native: true`, compiles `type="button"` onto native `<button>` elements to prevent implicit form submission.

2. **State Projection (`pressed`)**:
  - **Inside Group**: Evaluates active state against the enclosing group controller:
    - `single` (`!this.group.multiple`): `this.group.value === this.props.value`.
    - `multiple` (`this.group.multiple === true`): `Boolean(this.group.value?.includes(this.props.value))`.
  - **Standalone**: Evaluates `Boolean(this.props.pressed)`.
  - **Setter**: Mutates group state (if nested) or `this.props.pressed = Boolean(val)` (if standalone).

3. **Activation** (`docs/toggle-group.md:20,29,30`):
  - **Inside Group**: mutates the ambient `group.value` directly — single-select: activating an inactive item sets
    `group.value = item.value`; activating the active item deselects it (`group.value = null`); activating an
    already-selected item on a `radiogroup`-style single group is idempotent per role. Multiple: toggles membership in
    `group.value`. There is **no `required` input on a toggle group** (`docs/toggle-group.md:11-13` lists only `value`,
    `multiple`, `disabled`), so `required` never gates member deselection.
  - **Standalone**: Toggles `this.pressed = !this.pressed`.
  - A canceled trigger event (`defaultPrevented`) commits nothing; `disabled` blocks activation and state changes.

4. **Keyboard Polyfill (`!native`)**:
  - `Space`: Prevents scroll and toggles state on keyup.
  - `Enter`: Toggles state on keydown.

5. **Events** (`docs/toggle.md:22-28`):
  - `change` — after `pressed` commits, `CustomEvent<boolean>('change', { bubbles: true, detail: pressed })`, dispatched
    on both host types.
  - Native host: `click` is browser-dispatched, not re-dispatched. Custom host: `click` synthesized on Enter-down /
    Space-up when `!event.defaultPrevented` as a bubbling, cancelable `MouseEvent`.
