# Text-Input Specification

A text-input is the single-line or multiline text field an author holds for entering and editing text across native `<input>`, `<textarea>`, and custom textboxes.

- **Entity**: `text-input`
- **WAI-ARIA Role**: `searchbox` (when `kind: 'search'` on custom host), `textbox` (on custom host), none on native `<input>`/`<textarea>`.

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native `<input>` / `<textarea>`** | Native input or textarea. Handles text entry, selection, native form participation, `disabled`, `readonly`, `required`. | No role compiled (native). `aria-invalid` when invalid. | Form input controller managing live value synchronization and native event forwarding. |
| **Custom Textbox** | Custom element (`<div>`). | `role="searchbox"` (when `kind="search"`), `role="textbox"` (default), `aria-multiline="true"` (when multiline), `tabindex="0"`, `aria-readonly`, `aria-disabled`, `aria-required`. | Polyfills editing, tab stop, and dispatches synthetic `input` and `change` events. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TextInputOptions`
```ts
export interface TextInputOptions {
  /** Whether bound to native <input> or <textarea> (default: true) */
  native?: boolean;
}
```

#### `TextInputProps`
```ts
export interface TextInputProps {
  /** Live text value */
  value?: string;
  /** Text input kind */
  kind?: 'text' | 'password' | 'search' | 'email' | 'tel' | 'url';
  /** Multiline flag */
  multiline?: boolean;
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
// Text-Input: Text input controller
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'text-input',
  props?: TextInputProps,
  options?: TextInputOptions
): TextInputAria<E>;
```

---

## State & Lifecycle Rules

1. **Host-Aware Role Emission**:
   - Native `<input>` and `<textarea>` emit no role.
   - Non-input hosts emit `role="searchbox"` when `kind: 'search'`, otherwise `role="textbox"`.
   - `multiline: true` compiles `aria-multiline="true"` on custom hosts.
2. **Events**:
   - Native elements: browser `input` and `change` pass through.
   - Custom hosts: dispatches `CustomEvent<string>('input', { bubbles: true, detail: value })` on edit, and `CustomEvent<string>('change', { bubbles: true, detail: value })` on blur with diff.
