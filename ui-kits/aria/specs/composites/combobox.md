# Combobox Specification

The filterable text choice unit. Pairs direct text editing with a dynamic filtered popup listbox and keyboard selection
(`docs/combobox.md`).

### Composite Parts (Entity Tree)

- **`Combobox`**: Root orchestrator (publishes ambient props context hosting selection, filter query, and `open` state).
- **`ComboboxInput`**: Text input (compiles `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`). Claims itself as anchor via `this.markActionable()`.
- **`ComboboxPanel`**: Popup listbox panel inheriting from [Listbox](listbox.md) (compiles `role="listbox"`, creates internal `PopoverAria` proxying `open`, `onopen`, and `onclose` to ambient props).
- **`Option`**: Composed option members (compiles `role="option"`). See [Option](../widgets/option.md).

---

## The Three Semantic Layers

| Part / Role          | HTML Semantic                                 | WAI-ARIA Semantic                                                                                   | Aria Package Semantic Contract                                                                                                |
|:---------------------|:----------------------------------------------|:----------------------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------|
| **`Combobox` (Root)**| Non-semantic container (`<div>` or fragment). | None (role omitted).                                                                                | Root orchestrator hosting `value`, `query`, `open`, `multiple`, `disabled`, `required`. Publishes ambient host context.       |
| **`ComboboxInput`**  | Native `<input>` or custom.                   | `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` (popup id).         | Claims anchor via `this.markActionable()`. Text input driving filter query and popup expansion.                                |
| **`ComboboxPanel`**  | Overlay container (`<div>` or `<ul>`).        | `role="listbox"`.                                                                                   | Popup panel. Inherits [Listbox](listbox.md), creating an internal Popover proxying `open`, `onopen`, and `onclose`.           |
| **`Option`**         | List item (`<li>` or `<div>`).                | `role="option"`.                                                                                    | Composed from [Option](../widgets/option.md).                                                                                 |

---

## Architectural & Behavioral Contracts

### 1. Props Contracts

#### `SingleComboboxProps`

```ts
export interface SingleComboboxProps {
  multiple?: false;
  id?: string;
  /** Filter query string (default: "") — distinct from selected value */
  query?: string;
  /** Selected option value (default: null) */
  value?: string | null;
  /** Popup visibility (default: false) */
  open?: boolean;
  onopen?: () => void;
  onclose?: () => void;
  disabled?: boolean;
  required?: boolean;
}
```

#### `MultipleComboboxProps`

```ts
export interface MultipleComboboxProps {
  multiple: true;
  id?: string;
  /** Filter query string (default: "") — distinct from selected value */
  query?: string;
  /** Selected option values */
  value?: string[];
  /** Popup visibility (default: false) */
  open?: boolean;
  onopen?: () => void;
  onclose?: () => void;
  disabled?: boolean;
  required?: boolean;
}
```

#### `ComboboxProps`

```ts
export type ComboboxProps = SingleComboboxProps | MultipleComboboxProps;
```

#### `ComboboxInputProps`

```ts
export interface ComboboxInputProps {
  id?: string;
  disabled?: boolean;
}
```

#### `ComboboxPanelProps`

```ts
export type ComboboxPanelProps = ListboxProps;
```

> `aria-autocomplete` is fixed to `"list"`. `query` (filter string) and `value` (selected option) are distinct
> reactive inputs.

### 2. Overload Contracts

```ts
// Combobox: Root orchestrator hosting ambient context
export function aria<E extends BaseElement = HTMLElement>(
  role: 'combobox',
  props?: ComboboxProps
): ComboboxAria<E>;

// ComboboxInput: Text input element compiling role="combobox"
export function aria<E extends BaseElement = HTMLElement>(
  role: 'combobox-input',
  props?: ComboboxInputProps
): ComboboxInputAria<E>;

// ComboboxPanel: Popup panel inheriting from Listbox
export function aria<E extends BaseElement = HTMLElement>(
  role: 'combobox-panel',
  props?: ComboboxPanelProps
): ComboboxPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Popup Coordination & Anchoring**:
  - `Combobox` orchestrates ambient host state (`value`, `query`, `open`, `disabled`).
  - `ComboboxInput` claims itself as anchor by calling `this.markActionable()`.
  - `ComboboxInput` reflects `aria-expanded` from `open` and points `aria-controls` to the popup id.
  - Typing in the input updates `query` and opens the popup.

2. **Composition & Popup Delegation**:
  - The popup is rendered with `ComboboxPanel` (`aria('combobox-panel')`), which inherits `ListboxAria` and creates an internal `PopoverAria` instance.
  - Member items are rendered with `Option` (`aria('option')`).
  - `ComboboxPanel` adopts `combobox`'s ambient context (`this.properties = ambientProps ?? props`), proxying `open`, `onopen`, and `onclose` to/from the internal popover.
  - Light dismissal (outside click, Escape) and positioning are handled by the internal popover.
  - Option filtering is driven by `query`, filtering visible options without conflating internal typeahead.
  - `Escape` closes the popup; if closed with uncommitted edits, reverts `query`.

3. **Events**:
  - `input`: Dispatched when `query` updates from typing, and forwarded from `ComboboxPanel` when roving options.
  - `change`: Dispatched on `combobox` when selection commits with updated `value`.
  - `open` / `onopen`: Emitted when the popup opens.
  - `close` / `onclose`: Emitted when the popup closes.
