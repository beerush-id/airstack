# Radio Specification

A radio is a checkable input in a group of mutually exclusive options, where selecting one radio button deselects any previously selected button in the same group.

- **Role**: `radio`
- **WAI-ARIA Role**: `radio`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Radio** | Native `<input type="radio">`. Participates in native form submission (`name`, `value`, `checked`). Mutually exclusive selection handled by native `name` attribute. | Implicit `role="radio"`. Attribute omitted. | Syncs native `.checked` property. Forwards change events to group. |
| **Custom Radio** | Non-native element (`<div>`, `<span>`). No native form participation or keyboard behavior. | `role="radio"`, `aria-checked` (`"true"` \| `"false"`), roving `tabindex` (`0` if active, `-1` if inactive). | Group choice member (`this.props.value`). Polyfills Space key activation, manages active focus, and compiles ARIA attributes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `RadioOptions`
```ts
export interface RadioOptions {
  /** Whether bound to native <input type="radio"> (default: true) */
  native?: boolean;
}
```

#### `RadioProps<T extends Primitive = Primitive>`
```ts
export interface RadioProps<T extends Primitive = Primitive> {
  /** Choice candidate value matching parent group value */
  value?: T;
  /** Native HTML form field name pass-through */
  name?: string;
  /** Explicit checked state when standalone */
  checked?: boolean;
  /** Disabled state */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Radio: Mutually exclusive choice member (standalone, or radiogroup member with `value`)
export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'radio',
  props?: RadioProps<T>,
  options?: RadioOptions
): RadioAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`checked`)**:
   - **Inside Group**: Evaluates `this.group.value === this.props.value`.
   - **Standalone**: Evaluates `Boolean(this.props.checked)`.
   - **Setter**: Mutates `this.group.value = this.props.value` (if inside group) or `this.props.checked = Boolean(val)` (if standalone).

2. **Activation**:
   - Radio buttons are never toggleable: clicking or pressing Space on an already selected radio never deselects it, even when `!this.group.required`. The group may still start empty.
   - Keyboard navigation within a `radiogroup` moves selection automatically when `manual === false` (default); with `manual: true`, arrows move focus only and `Space` selects.
