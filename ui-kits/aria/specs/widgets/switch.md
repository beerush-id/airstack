# Switch Specification

A switch is an interactive toggle widget representing a binary on/off state, similar to a physical light switch.

- **Role**: `switch`
- **WAI-ARIA Role**: `switch`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Switch** | Rendered via `<button type="button">` or non-native element. (HTML has no native `<switch>` element). | `role="switch"`, `aria-checked` (`"true"` \| `"false"`), `tabindex="0"`. | Pure ARIA toggle controller (`native: false`). Exposes `this.checked` getter/setter. Polyfills Space/Enter toggle. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SwitchOptions`
```ts
export interface SwitchOptions {
  /** Whether bound to a <button> host (default: false, pure ARIA) */
  native?: boolean;
}
```

#### `SwitchProps<T extends Primitive = Primitive>`
```ts
export interface SwitchProps<T extends Primitive = Primitive> {
  /** Choice candidate value if nested in a selection group */
  value?: T;
  /** Optional form field name pass-through */
  name?: string;
  /** Binary checked state */
  checked?: boolean;
  /** Disabled state */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Switch: Binary on/off toggle (pure ARIA by default)
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'switch',
  props?: SwitchProps<T>,
  options?: SwitchOptions
): SwitchAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`checked`)**:
   - **Getter**: Resolves `Boolean(this.props.checked)`.
   - **Setter**: Mutates `this.props.checked = Boolean(val)`.

2. **Activation**:
   - `Click`, `Space`, or `Enter` (when non-native) toggles `this.checked = !this.checked`.
