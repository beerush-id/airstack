# CodeInput Specification

The segmented code-entry unit. Coordinates character entry, paste and autofill distribution, deletion, and focus across
cells while exposing one reactive code value.

- **Entity**: `code-input`
- **WAI-ARIA Role**: `group` (container), `textbox` (cells on custom hosts)

### Composite Parts (Entity Tree)

- **`CodeInput`**: Container coordinator (compiles `role="group"`, `aria-label`).
- **`CodeInputCell`**: Individual cell member (`index: number`, compiles `tabindex`, `inputmode`, native value
  reflection).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                                   | WAI-ARIA Semantic                                                                           | Aria Package Semantic Contract                                                                           |
|:--------------------|:------------------------------------------------|:--------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------|
| **`CodeInput`**     | Group container (`<div>`).                      | `role="group"`, `aria-label`.                                                               | Hosts `value`, `length`, `kind`, `disabled`, `readonly`, `label`. Coordinates single tab stop.           |
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
  - Only the current cell receives `tabindex="0"`; others `-1`. **Before any cell is focused, the entry position is the
    first unfilled cell, or the last cell when the code is full** (`docs/code-input.md:32`). `Tab` leaves the field
    rather than traversing every cell.
  - `Left` / `Right` move between occupied cells and the first unfilled cell.
  - `Home` focuses cell 0; `End` focuses first unfilled cell or last cell.
  - `Backspace` clears current, or on the first unfilled position removes the preceding character and focuses it;
    `Delete` clears without moving. Removal shifts following characters left so the value stays contiguous (`:30`).

3. **Cell Naming** (`docs/code-input.md:59`): each cell's `aria-label` is derived from the group `label` + position —
   e.g. `"Verification code, character 2 of 6"` — so `CodeInputCellProps` needs only `index`; the name is computed, not
   authored.

4. **Paste / Autofill Distribution** (`docs/code-input.md:28`): paste and autofill distribute accepted characters
   starting from the receiving position, replace existing characters there, and **discard overflow beyond `length`**;
   focus moves to the next unfilled cell or the last when full. The observable result is a committed `value` followed by
   `input`.

5. **Events**:
  - `input` — on container after an edit commits a different code, `detail: value`.
  - `change` — on blur leaving the field when `value` differs from focus-entry, `detail: value`.
  - `complete` — after an edit yields a different value whose length equals `length`, following `input`,
    `detail: value`.
