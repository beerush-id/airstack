# FilePicker Specification

The file-picker activation unit. Provides unified system file-picker triggering, media type filtering, and cancel
detection across native buttons and custom elements.

- **Entity**: `file-picker`
- **WAI-ARIA Role**: `button`

### Parts

- **`FilePicker`**: Button element bridging to an internal, hidden native `<input type="file">`.

---

## The Three Semantic Layers

| Context            | HTML Semantic                    | WAI-ARIA Semantic                                 | Aria Package Semantic Contract                                                                             |
|:-------------------|:---------------------------------|:--------------------------------------------------|:-----------------------------------------------------------------------------------------------------------|
| **Native Button**  | Native `<button type="button">`. | Implicit `role="button"`. Explicit role omitted.  | Bridges to hidden file input on click/Enter/Space. Dispatches `change` with selected `File[]` or `cancel`. |
| **Custom Element** | Non-semantic element (`<div>`).  | `role="button"`, `tabindex="0"`, `aria-disabled`. | Polyfills button mechanics and bridges to hidden file input.                                               |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `FilePickerProps`

```ts
export interface FilePickerProps {
  /** Accepted file types string */
  accept?: string;
  /** Multi-file selection flag */
  multiple?: boolean;
  /** Media capture source for mobile devices */
  capture?: 'user' | 'environment';
  disabled?: boolean;
}
```

#### `FilePickerOptions`

```ts
export interface FilePickerOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// FilePicker
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'file-picker',
  props?: FilePickerProps,
  options?: FilePickerOptions
): FilePickerAria<E>;
```

---

## State & Lifecycle Rules

1. **Triggering**:
  - Activation opens the system file picker when not disabled and `!event.defaultPrevented`.
2. **Events** (both dispatched **on the FilePicker element**, `docs/file-picker.md:24-25`):
  - `change`: after files are confirmed, `CustomEvent<File[]>('change', { bubbles: true, detail: files })`.
  - `cancel`: on picker dismissal without selection, `CustomEvent<void>('cancel', { bubbles: false })`.
3. **Disabled**: `disabled` blocks the picker from opening; a canceled initiating event (`defaultPrevented`) opens
   nothing.
