# Checkbox Specification

A checkbox is a two-state or tri-state toggle widget that represents a binary choice (checked/unchecked) or a multi-state selection (checked/unchecked/mixed).

- **Role**: `checkbox`
- **WAI-ARIA Role**: `checkbox`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Checkbox** | Native `<input type="checkbox">`. Participates in native form submission (`name`, `value`, `checked`, `required`). Supports native `.indeterminate` IDL property. | Implicit `role="checkbox"`. Attribute omitted. Projects `aria-invalid` on validation failure. | Syncs native `.checked`, `.indeterminate`, and `.required`. Forwards change events and projects validity states. |
| **Custom Checkbox** | Non-native element (`<div>`, `<span>`). No native form participation or keyboard behavior. | `role="checkbox"`, `aria-checked` (`"true"` \| `"false"` \| `"mixed"`), `aria-required`, `aria-invalid`, `tabindex="0"` (or `-1` if disabled). | Polyfills Space key toggling, manages `this.checked` projection, and compiles ARIA attributes. |

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

#### `CheckboxProps<T extends AnyType = AnyType>`
```ts
export interface CheckboxProps<T extends AnyType = AnyType> {
  /** Whether the checkbox is in a checked state */
  checked?: boolean;
  /** Whether the checkbox is in a tri-state indeterminate/mixed condition */
  indeterminate?: boolean;
  /** Whether the checkbox is disabled from user interaction */
  disabled?: boolean;
  /** Whether a checked state is required for form validation */
  required?: boolean;
  /** Invalid indicator compiled to aria-invalid */
  invalid?: boolean | 'grammar' | 'spelling';
  /** Semantic identity key or field name on the parent group or form */
  name?: string;
  /** Choice candidate value when nested inside a multi-selection group */
  value?: T;
}
```

### 2. Overload Contract

```ts
// Checkbox: Binary/tri-state toggle (standalone, or multi-group member with `value`)
export function aria<E extends BaseElement = HTMLInputElement, T extends AnyType = AnyType>(
  role: 'checkbox',
  props?: CheckboxProps<T>,
  options?: CheckboxOptions
): CheckboxAria<E, CheckboxProps<T>>;
```

---

## State & Lifecycle Rules

1. **State Projection (`checked`)**:
   - **Inside Group** (`this.group.multiple === true`): Derives from array inclusion `Boolean(this.group.value?.includes(this.props.value))`.
   - **Standalone**: Derives from `this.props.checked ?? false`.
   - **Setter**: Mutates group value (if nested) or `this.props.checked` (if standalone).

2. **Keyboard Polyfill (`!native`)**:
   - `Space`: Toggles checked state.
