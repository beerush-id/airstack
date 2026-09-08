# Toggle Specification

A toggle is a two-state button that can be either off (not pressed) or on (pressed).

- **Role**: `toggle`
- **WAI-ARIA Role**: `button`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Toggle Button** | Native `<button type="button">`. Handles Space/Enter activation and native `disabled`. | `role="button"` (omitted if native), `aria-pressed` (`"true"` \| `"false"`). | Two-state toggle widget. Exposes reactive `this.pressed` getter and setter. |
| **Custom Toggle Button** | Non-semantic element (`<div>`, `<span>`). | `role="button"`, `aria-pressed` (`"true"` \| `"false"`), `tabindex="0"` (or `-1` if disabled). | Polyfills Space/Enter key toggling and compiles ARIA attributes. |

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

3. **Activation**:
   - **Inside Group**: Delegates mutation to enclosing group rules via `this.props.value`.
   - **Standalone**: Toggles `this.pressed = !this.pressed`.

4. **Keyboard Polyfill (`!native`)**:
   - `Space`: Prevents scroll and toggles state on keyup.
   - `Enter`: Toggles state on keydown.
