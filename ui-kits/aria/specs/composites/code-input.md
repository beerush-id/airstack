# CodeInput Specification

The segmented code-entry unit. Coordinates character entry, paste and autofill distribution, deletion, and focus across cells while exposing one reactive code value.

- **Entity**: `code-input`
- **WAI-ARIA Role**: `group` (container), `textbox` (cells on custom hosts)

### Composite Parts (Entity Tree)
- **`CodeInput`**: Container coordinator (compiles `role="group"`, `aria-label`).
- **`CodeInputCell`**: Individual cell member (`index: number`, compiles `tabindex`, `inputmode`, native value reflection).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`CodeInput`** | Group container (`<div>`). | `role="group"`, `aria-label`. | Hosts `value`, `length`, `kind`, `disabled`, `readonly`, `label`. Coordinates single tab stop. |
| **`CodeInputCell`** | Native `<input type="text">` or custom element. | `role="textbox"` on custom host (omitted on native input), `aria-label`, roving `tabindex`. | Derives character from `value[index]`. Handles selection, backspace shifting, and autofill distribution. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `CodeInputProps`
```ts
export interface CodeInputProps {
  /** Current code string */
  value?: string;
  /** Number of character positions (default: 6) */
  length?: number;
  /** Character set: 'numeric' | 'alphanumeric' (default: 'numeric') */
  kind?: 'numeric' | 'alphanumeric';
  disabled?: boolean;
  readonly?: boolean;
  label?: string;
}
```

#### `CodeInputCellProps`
```ts
export interface CodeInputCellProps {
  /** Zero-based character position index */
  index: number;
}
```

#### `CodeInputCellOptions`
```ts
export interface CodeInputCellOptions {
  /** Whether bound to native <input> (default: true) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// CodeInput: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'code-input',
  props?: CodeInputProps
): CodeInputAria<E>;

// CodeInputCell: Cell member
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'code-input-cell',
  props: CodeInputCellProps,
  options?: CodeInputCellOptions
): CodeInputCellAria<E>;
```

---

## State & Lifecycle Rules

1. **Character Distribution & Contiguous Prefix**:
   - Truncated to `length` and filtered according to `kind`.
   - Autofill and paste distribute characters starting from the targeted cell.
   - First cell receives `autocomplete="one-time-code"`.

2. **Single Tab Stop & Navigation**:
   - Only the active cell receives `tabindex="0"`; others receive `tabindex="-1"`.
   - `Left` / `Right` move between occupied cells and the first unfilled cell.
   - `Home` focuses cell 0; `End` focuses first unfilled cell or last cell.
   - `Backspace` clears current or shifts previous left. `Delete` clears without moving focus.

3. **Events**:
   - `input` — Emitted on container after code edit with `detail: value`.
   - `change` — Emitted on blur with diff with `detail: value`.
   - `complete` — Emitted when value reaches `length` with `detail: value`.
