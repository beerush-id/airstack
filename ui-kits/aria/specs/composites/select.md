# Select Specification

A select presents a popup listbox of options and allows a user to select one or more of them. It consists of a trigger
button and a popup listbox.

- **Entity**: `select`
- **Trigger WAI-ARIA Role**: `combobox`
- **Popup WAI-ARIA Role**: `listbox`

### Composite Parts (Entity Tree)

- **`Select`**: Root orchestrator (publishes ambient `selectCtx` hosting selection and `open` state).
- **`SelectTrigger`**: Trigger button opening the listbox (compiles `role="combobox"`, `aria-haspopup="listbox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`).
- **`SelectPopup`**: Popup listbox container (compiles `role="listbox"`, `aria-multiselectable` when multiple).
- **`SelectOption`**: Option member (compiles `role="option"`, `aria-selected`, `aria-disabled`).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                                  | WAI-ARIA Semantic                                                                                        | Aria Package Semantic Contract                                                            |
|:--------------------|:-----------------------------------------------|:---------------------------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------|
| **`Select` (Root)** | Logical container (`<div>` or fragment).       | None (role omitted).                                                                                     | Root orchestrator hosting `value`, `open`, `multiple`, `disabled`, `required`.            |
| **`SelectTrigger`** | Native `<button type="button">` or non-button. | `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. | Toggles popup, navigates options via typeahead and arrow keys, displays active selection. |
| **`SelectPopup`**   | Dropdown container (`<div>` or `<ul>`).        | `role="listbox"`, `aria-multiselectable="true"` when multiple.                                           | Houses option list. Hidden when closed.                                                   |
| **`SelectOption`**  | List item (`<div>` or `<li>`).                 | `role="option"`, `aria-selected`, `aria-disabled`.                                                       | Choice candidate: `this.props.value`. Active when matching `select.value`.                |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleSelectProps`

```ts
export interface SingleSelectProps {
  multiple?: false;
  /** Active option value */
  value?: string | null;
  /** Popup visibility flag */
  open?: boolean;
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
  /** Popup visibility flag */
  open?: boolean;
  disabled?: boolean;
  required?: boolean;
}
```

#### `SelectProps`

```ts
export type SelectProps = SingleSelectProps | MultipleSelectProps;
```

#### `SelectTriggerOptions`

```ts
export interface SelectTriggerOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `SelectTriggerProps`

```ts
export interface SelectTriggerProps {
  id?: string;
  disabled?: boolean;
}
```

#### `SelectPopupProps`

```ts
export interface SelectPopupProps {
  id?: string;
}
```

#### `SelectOptionProps`

```ts
export interface SelectOptionProps {
  value: string;
  label?: string;
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Select: Root orchestrator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'select',
  props?: SelectProps
): SelectAria<E>;

// SelectTrigger: Combobox button
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'select-trigger',
  props?: SelectTriggerProps,
  options?: SelectTriggerOptions
): SelectTriggerAria<E>;

// SelectPopup: Listbox popup
export function aria<E extends BaseElement = HTMLElement>(
  role: 'select-popup',
  props?: SelectPopupProps
): SelectPopupAria<E>;

// SelectOption: Option item
export function aria<E extends BaseElement = HTMLElement>(
  role: 'select-option',
  props: SelectOptionProps
): SelectOptionAria<E>;
```

---

## State & Lifecycle Rules

1. **Trigger Toggling**:
  - Pointer `click`, `Enter`, and `Space` toggle `open`.
  - `DownArrow` on closed trigger opens popup and highlights first enabled option.
  - `UpArrow` on closed trigger opens popup and highlights last enabled option.

2. **Open Navigation**:
  - Arrow keys `Up` / `Down` move virtual focus through visible options, updating `aria-activedescendant` on trigger.
  - `Home` / `End` highlight first / last enabled option.
  - Typeahead: printable characters navigate matching option labels with 500ms debounce.
  - `Enter` or `Space` commits selection: closes popup in single-select; keeps open in multi-select.
  - `Escape` closes popup without committing changes.
  - Focus restores to trigger on close.

3. **Events**:
  - Dispatches `CustomEvent<string | null | string[]>('change', { bubbles: true, detail: select.value })` on container.
