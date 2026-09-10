# Text-Input Specification

A text-input is the text field an author holds for entering and editing plain text.

- **Entity**: `text-input`
- **WAI-ARIA Role**: none (native input; no role compiled)

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`text-input`** | Native `<input type="text">` or `<textarea>`. Handles text entry, selection, native form participation, `disabled`, `readonly`, `required`. | No role compiled (native). `aria-readonly`, `aria-required`, `aria-invalid`, `aria-label`. | Form input controller managing live value synchronization and validity projection. |
| **`search-input`** | Native `<input type="search">`. Native clear button and search semantics. | No role compiled (native). `type="search"`, `aria-label` / `aria-labelledby`. | Same mid controller with `role: 'search-input'` locked by the SearchInput public face (see `search-input`). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TextInputOptions`
```ts
export interface TextInputOptions {
  /** Whether bound to native <input> or <textarea> (default: true) */
  native?: boolean;
  /** Mid-layer flag set by the public TextInput/SearchInput faces, never JSX (default: 'text-input') */
  role?: 'text-input' | 'search-input';
}
```

#### `TextInputProps`
```ts
export interface TextInputProps {
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
// Text-Input: Text input controller (public face with `role: 'text-input'`)
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'text-input',
  props?: TextInputProps,
  options?: TextInputOptions
): TextInputAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`value`)**:
   - Reflects the string value of the input.
   - For native elements, synchronizes with DOM `.value` property.

2. **Readonly & Disabled**:
   - Native elements receive native boolean attributes `readonly` and `disabled`.
   - Custom non-native elements compile `aria-readonly` and `aria-disabled`.
