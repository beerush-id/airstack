# Checkbox Specification

A checkbox is a two-state or tri-state toggle widget that represents a binary choice (checked/unchecked) or a multi-state selection (checked/unchecked/mixed).

- **Role**: `checkbox`
- **WAI-ARIA Role**: `checkbox`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Checkbox** | Native `<input type="checkbox">`. Participates in native form submission (`name`, `value`, `checked`). Supports native `.indeterminate` IDL property. | Implicit `role="checkbox"`. Attribute omitted. | Syncs native `.checked` and `.indeterminate`. Forwards change events. |
| **Custom Checkbox** | Non-native element (`<div>`, `<span>`). No native form participation or keyboard behavior. | `role="checkbox"`, `aria-checked` (`"true"` \| `"false"` \| `"mixed"`), `tabindex="0"` (or `-1` if disabled). | Polyfills Space key toggling, manages `this.checked` projection, and compiles ARIA attributes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `CheckboxOptions`
```ts
export interface CheckboxOptions {
  /** Whether bound to native <input type="checkbox"> (default: true) */
  native?: boolean;
}
```

#### `CheckboxProps<T extends Primitive = Primitive>`
```ts
export interface CheckboxProps<T extends Primitive = Primitive> {
  /** Choice candidate value when nested inside a multi-selection group */
  value?: T;
  /** Native HTML form field name pass-through */
  name?: string;
  /** Binary or tri-state checked state */
  checked?: boolean | 'mixed';
  /** Disabled state */
  disabled?: boolean;
  /** Required validation indicator */
  required?: boolean;
}
```

### 2. Overload Contract

```ts
// Checkbox: Binary/tri-state toggle (standalone, or multi-group member with `value`)
export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'checkbox',
  props?: CheckboxProps<T>,
  options?: CheckboxOptions
): CheckboxAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`checked`)**:
   - **Inside Group** (`this.group.multiple === true`): Derives from array inclusion `Boolean(this.group.value?.includes(this.props.value))`.
   - **Standalone**: Derives from `this.props.checked ?? false`.
   - **Setter**: Mutates group value (if nested) or `this.props.checked` (if standalone).

2. **Keyboard Polyfill (`!native`)**:
   - `Space`: Toggles checked state.
