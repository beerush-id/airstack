# Checkbox Specification

A checkbox is a two-state or tri-state toggle widget that represents a binary choice (checked/unchecked) or a
multi-state selection (checked/unchecked/mixed).

- **Role**: `checkbox`
- **WAI-ARIA Role**: `checkbox`

---

## The Three Semantic Layers

| Context             | HTML Semantic                                                                                                                                                     | WAI-ARIA Semantic                                                                                                                                                                                 | Aria Package Semantic Contract                                                                                                         |
|:--------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------|
| **Native Checkbox** | Native `<input type="checkbox">`. Participates in native form submission (`name`, `value`, `checked`, `required`). Supports native `.indeterminate` IDL property. | Implicit `role="checkbox"`. Attribute omitted.                                                                                                                                                    | Syncs native `.checked`, `.indeterminate`, `.disabled`, and `.required` properties. Emits no role and no redundant checked ARIA state. |
| **Custom Checkbox** | Non-native element (`<div>`, `<span>`). No native form participation or keyboard behavior.                                                                        | `role="checkbox"`, `aria-checked` (`"true"` \| `"false"` \| `"mixed"`), `aria-required`; `tabindex="0"` when enabled, `tabindex` removed when `disabled`; `aria-disabled="true"` when `disabled`. | Polyfills Space key toggling, manages `this.checked` projection, and compiles ARIA attributes.                                         |

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
  /** Checked state; the single tri-state prop (default: false) */
  checked?: boolean | 'indeterminate';
  /** Whether the checkbox is disabled from user interaction */
  disabled?: boolean;
  /** Whether a checked state is required for form validation */
  required?: boolean;
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

1. **Tri-State (`checked`)**:
  - One prop carries all three states: `true`, `false`, `'indeterminate'` (default `false`). There is no separate
    `indeterminate` prop, so `{ checked: true, indeterminate: true }` is not constructible and mixed precedence is not a
    question.
  - Activation flips `checked`: from `false` or `'indeterminate'` commits `true`; from `true` commits `false`.

2. **Activation & Guarding**:
  - Activation flows from pointer `click` and `Space` keyup. `Enter` commits nothing.
  - `Space` keydown prevents viewport scrolling; activation verifies `!event.defaultPrevented` on the initiating event.
  - `disabled` blocks activation and state commits.

3. **State Projection (`checked`)**:
  - **Inside Group** (`this.group.multiple === true`): Derives from array inclusion
    `Boolean(this.group.value?.includes(this.props.value))`. Checked state is derived from membership rather than a
    separately writable member flag; group members carry binary choices only, not indeterminate.
  - **Standalone**: Derives from `this.props.checked ?? false`.
  - **Member activation**: adds its value when unchecked, removes it when checked. Adding a value does not create
    duplicates; unrelated selected values are preserved. Intra-group ordering of the array is not a contract.
  - **Group default**: `value` is `[]`; per `spec.md` Locked Rule 5, `[]` and `undefined` both mean unselected.

4. **Keyboard Polyfill (`!native`)**:
  - `Space`: Toggles checked state.

5. **Native Host Reflection**:
  - Native `checked` property reflects `checked === true`; `.indeterminate` reflects `checked === 'indeterminate'`;
    `disabled` and `required` sync native properties.
  - No `role="checkbox"` is emitted, and no ARIA mirror (`aria-required`, `aria-checked`, `aria-invalid`) is emitted on
    the native branch.

6. **Events**:
  - Native host: `click`, `input`, `change` are browser-dispatched; the controller does not re-dispatch them.
  - Custom host:
    - `click` — synthesized on `Space` keyup when `!event.defaultPrevented` as
      `MouseEvent('click', { bubbles: true, cancelable: true })`.
    - `input` / `change` — dispatched after `checked` commits as `CustomEvent<boolean | 'indeterminate'>` with
      `bubbles: true`, `detail: checked`.
