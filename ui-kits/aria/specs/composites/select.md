# Select Specification

A select presents a popup listbox of options and allows a user to select one or more of them. It consists of a trigger
button and a popup listbox.

- **Entity**: `select`
- **Trigger WAI-ARIA Role**: `combobox`
- **Popup WAI-ARIA Role**: `listbox`

### Composite Parts (Entity Tree)

- **`Select`**: Root orchestrator (publishes ambient props context hosting selection and `open` state).
- **`SelectTrigger`**: Trigger button opening the listbox (compiles `role="combobox"`, `aria-haspopup="listbox"`,
  `aria-expanded`, `aria-controls`). Claims itself as anchor via `this.markActionable()`.
- **`SelectPanel`**: Popup listbox panel inheriting from [Listbox](listbox.md) (compiles `role="listbox"`, creates internal `PopoverAria` proxying `open`, `onopen`, and `onclose` to ambient props).
- **`Option`**: Composed option members (compiles `role="option"`). See [Option](../widgets/option.md).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                                  | WAI-ARIA Semantic                                                                | Aria Package Semantic Contract                                                                                             |
|:--------------------|:-----------------------------------------------|:---------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------|
| **`Select` (Root)** | Non-semantic container (`<div>` or fragment).  | None (role omitted).                                                             | Root orchestrator hosting `value`, `open`, `multiple`, `query`, `disabled`, `required`. Publishes ambient host context.    |
| **`SelectTrigger`** | Native `<button type="button">` or custom.     | `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`.  | Claims anchor via `this.markActionable()`. Toggles popup visibility; opens on arrow down/up.                              |
| **`SelectPanel`**   | Dropdown container (`<div>` or `<ul>`).        | `role="listbox"`.                                                                | Popup panel. Inherits [Listbox](listbox.md), creating an internal Popover proxying `open`, `onopen`, and `onclose`.        |
| **`Option`**        | List item (`<div>` or `<li>`).                 | `role="option"`.                                                                 | Composed from [Option](../widgets/option.md).                                                                              |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleSelectProps`

```ts
export interface SingleSelectProps {
  multiple?: false;
  /** Active option value */
  value?: string | null;
  /** Filter query */
  query?: string;
  /** Popup visibility flag */
  open?: boolean;
  onopen?: () => void;
  onclose?: () => void;
  disabled?: boolean;
  required?: boolean;
}
```

#### `MultipleSelectProps`

```ts
export interface MultipleSelectProps {
  multiple: true;
  /** Array of active option values */
  value?: string[];
  /** Filter query */
  query?: string;
  /** Popup visibility flag */
  open?: boolean;
  onopen?: () => void;
  onclose?: () => void;
  disabled?: boolean;
  required?: boolean;
}
```

#### `SelectProps`

```ts
export type SelectProps = SingleSelectProps | MultipleSelectProps;
```

#### `SelectTriggerProps`

```ts
export interface SelectTriggerProps {
  id?: string;
  disabled?: boolean;
}
```

#### `SelectPanelProps`

```ts
export type SelectPanelProps = ListboxProps;
```

### 2. Overload Contracts

```ts
// Select: Root orchestrator hosting ambient context
export function aria<E extends BaseElement = HTMLElement>(
  role: 'select',
  props?: SelectProps
): SelectAria<E>;

// SelectTrigger: Combobox button
export function aria<E extends BaseElement = HTMLElement>(
  role: 'select-trigger',
  props?: SelectTriggerProps
): SelectTriggerAria<E>;

// SelectPanel: Popup panel inheriting from Listbox
export function aria<E extends BaseElement = HTMLElement>(
  role: 'select-panel',
  props?: SelectPanelProps
): SelectPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Trigger Toggling & Anchoring**:
  - Claims itself as anchor by calling `this.markActionable()`.
  - Pointer `click`, `Enter`, and `Space` toggle `open`.
  - `DownArrow` on closed trigger opens popup.
  - `UpArrow` on closed trigger opens popup.
  - `Escape` closes popup without committing changes; focus restores to trigger.

2. **Composition & Popup Delegation**:
  - The popup is rendered with `SelectPanel` (`aria('select-panel')`), which inherits `ListboxAria` and creates an internal `PopoverAria` instance.
  - Member items are rendered with `Option` (`aria('option')`).
  - `SelectPanel` adopts `select`'s ambient context (`this.properties = ambientProps ?? props`), proxying `open`, `onopen`, and `onclose` to/from the internal popover.
  - Light dismissal (outside click, Escape) and positioning are handled by the internal popover.
  - In single-select mode, committing selection automatically closes the popup; in multi-select mode, it remains open.

3. **Events**:
  - `input`: Forwarded from `SelectPanel` when roving options.
  - `change`: Dispatched on `select` when selection commits with the updated `value`.
  - `open` / `onopen`: Emitted when the popup opens.
  - `close` / `onclose`: Emitted when the popup closes.
