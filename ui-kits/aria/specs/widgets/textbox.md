# Textbox Specification

A textbox is an input widget that allows users to enter and edit text.

- **Role**: `textbox`
- **WAI-ARIA Role**: `textbox`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`textbox`** | Native `<input type="text">` or `<textarea>`. Handles text entry, selection, native form participation, `disabled`, `readonly`, `required`. | `role="textbox"` (omitted if native), `aria-readonly`, `aria-required`, `aria-invalid`, `aria-label`. | Form input controller managing live value synchronization and validity projection. |
| **`searchbox`** | Native `<input type="search">`. Native clear button and search semantics. | `role="searchbox"` (omitted if native), `aria-label` / `aria-labelledby`. | Same mid controller with `role: 'searchbox'` locked by the Searchbox public face (see `searchbox`). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TextboxOptions`
```ts
export interface TextboxOptions {
  /** Whether bound to native <input> or <textarea> (default: true) */
  native?: boolean;
  /** Mid-layer flag set by the public Textbox/Searchbox faces, never JSX (default: 'textbox') */
  role?: 'textbox' | 'searchbox';
}
```

#### `TextboxProps`
```ts
export interface TextboxProps {
  /** Live text value */
  value?: string;
  /** Readonly indicator */
  readonly?: boolean;
  /** Disabled indicator */
  disabled?: boolean;
  /** Required validation indicator */
  required?: boolean;
  /** Invalid indicator */
  invalid?: boolean | 'grammar' | 'spelling';
  /** Placeholder hint */
  placeholder?: string;
  /** Accessible label compiled to aria-label */
  label?: string;
}
```

### 2. Overload Contract

```ts
// Textbox: Text input controller (public face with `role: 'textbox'`)
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'textbox',
  props?: TextboxProps,
  options?: TextboxOptions
): TextboxAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`value`)**:
   - Reflects the string value of the input.
   - For native elements, synchronizes with DOM `.value` property.

2. **Readonly & Disabled**:
   - Native elements receive native boolean attributes `readonly` and `disabled`.
   - Custom non-native elements compile `aria-readonly` and `aria-disabled`.
