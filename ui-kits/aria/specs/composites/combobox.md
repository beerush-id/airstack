# Combobox Specification

A combobox is a composite widget made up of an input field and an associated popup (typically a `listbox`) that provides values for the input.

### Composite Parts
- **`Combobox`**: WAI-ARIA `combobox` (input)
- **`Popup`**: WAI-ARIA `listbox` (or `grid` / `tree` / `dialog`)

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`combobox`** | Text input (`<input type="text">`). Handles native typing, selection, and form submission. | `role="combobox"`, `aria-expanded` (`"true"` \| `"false"`), `aria-haspopup="listbox"`, `aria-controls` (popup ID), `aria-autocomplete` (`"none"` \| `"inline"` \| `"list"` \| `"both"`), `aria-activedescendant`. | Input coordinator managing open/closed state, text value, and active virtual focus. |
| **Popup (`listbox`)** | Floating overlay container (`<div>`). | `role="listbox"`, `id` (referenced by combobox `aria-controls`), `aria-label`. | Popup members reuse their own role specs (`option`, etc.). The combobox coordinator substring-filters popup options against the current text value (case-insensitive); selection stays owned by the popup option controllers. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ComboboxOptions`
```ts
export interface ComboboxOptions {
  /** Whether bound to native <input> (default: true) */
  native?: boolean;
}
```

#### `ComboboxProps<T extends Primitive = Primitive>`
```ts
export interface ComboboxProps<T extends Primitive = Primitive> {
  /** Optional DOM element identifier */
  id?: string;
  /** Element ID of the popup element (compiled to aria-controls) */
  popupId?: string;
  /** Input text value */
  value?: string;
  /** Selected option value */
  selected?: T;
  /** Open state of popup */
  open?: boolean;
  /** Autocomplete behavior mode, compiled to aria-autocomplete (default: 'list') */
  autocomplete?: 'none' | 'list' | 'inline' | 'both';
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Combobox: Input coordinator with popup
export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'combobox',
  props?: ComboboxProps<T>,
  options?: ComboboxOptions
): ComboboxAria<E>;
```

---

## State & Lifecycle Rules

1. **Popup Coordination**:
   - `aria-expanded`: Reflects `this.open`.
   - `aria-controls`: Set to popup element ID.
   - `aria-activedescendant`: Contains the ID of the currently highlighted option in the popup without moving DOM focus away from the `<input>`.

2. **Keyboard Interaction**:
   - `ArrowDown` / `ArrowUp`: Opens popup if closed, or changes `aria-activedescendant` to next/previous option.
   - `Enter`: Selects the option currently indicated by `aria-activedescendant` and closes the popup.
   - `Escape`: Closes the popup and clears active descendant.
   - Combobox declares no `manual` prop: arrows move the active descendant only and never commit; focus stays in the `<input>`.

3. **State Projections**: `open`, `value`, and `selected` read and write props directly. Props is the single source of state. `value` represents the input text, and `selected` represents the active option identifier.
