# Combobox Specification

The filterable text choice unit. Pairs direct text editing with a dynamic filtered popup listbox and keyboard selection
(`docs/combobox.md`).

### Composite Parts

- **`Combobox`**: Container coordinator (hosts ambient `text`/`value`/`open`).
- **`ComboboxInput`**: Text input (`role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant`).
- **`ComboboxPopup`**: Popup listbox (`role="listbox"`), composed from the Listbox unit.
- **`ComboboxOption`**: Option member (`role="option"`, `aria-selected`, `aria-disabled`).

---

## The Three Semantic Layers

| Part / Role          | HTML Semantic               | WAI-ARIA Semantic                                                                                                                                                                                                                            | Aria Package Semantic Contract                                                                                              |
|:---------------------|:----------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------|
| **`ComboboxInput`**  | Native `<input>` or custom. | `role="combobox"`, `aria-autocomplete="list"` (fixed by the source), `aria-expanded`, `aria-controls` (popup id), `aria-activedescendant` (highlighted option id); native `disabled` / custom `aria-disabled` + `tabindex`; `aria-required`. | DOM focus stays in the input for all interactions; the popup's highlighted option is published via `aria-activedescendant`. |
| **`ComboboxPopup`**  | Overlay `<div>`.            | `role="listbox"`, `id`.                                                                                                                                                                                                                      | Filtered option set; **hidden when closed** (removed from tab order and a11y tree). Composed from the Listbox unit.         |
| **`ComboboxOption`** | `<div>`/`<li>`.             | `role="option"`, `aria-selected`, `aria-disabled`.                                                                                                                                                                                           | Selection derived from ambient `combobox.value === option.value`.                                                           |

---

## Architectural & Behavioral Contracts

### 1. Props Contracts

#### `ComboboxProps`

```ts
export interface ComboboxProps {
  id?: string;
  /** Filter query string (default: "") — distinct from the selected value */
  text?: string;
  /** Selected option value (default: null) */
  value?: string | null;
  /** Popup visibility (default: false) */
  open?: boolean;
  disabled?: boolean;
  required?: boolean;
}
```

#### `ComboboxOptionProps`

```ts
export interface ComboboxOptionProps {
  /** Option identifier, unique within the Combobox */
  value: string;
  /** Matching / naming / committed-text label (default: text content) */
  label?: string;
  disabled?: boolean;
}
```

> `aria-autocomplete` is fixed to `"list"` (`docs/combobox.md:47,55`); it is not a configurable prop. `text` (query)
> and `value` (selected option) are distinct inputs (`:11-12`). The popup id is derived from the combobox namespace —
> the same deterministic pair-id mechanism as select.

### 2. Overload Contracts

```ts
export function aria<E extends BaseElement = HTMLInputElement>(role: 'combobox', props?: ComboboxProps): ComboboxAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'combobox-input', props?: AriaProps): ComboboxInputAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'combobox-popup', props?: AriaProps): ComboboxPopupAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'combobox-option', props: ComboboxOptionProps): ComboboxOptionAria<E>;
```

---

## State & Lifecycle Rules

1. **Popup Coordination** (`docs/combobox.md:33,48-50`): `aria-expanded` reflects `open`; `aria-controls` → popup id;
   `aria-activedescendant` → highlighted option id (withdrawn when closed); DOM focus stays in the input throughout.

2. **Typing & Filtering** (`docs/combobox.md:27`): typing updates `text` and opens the popup when matching options
   exist; matching is case-insensitive against option `label`s.

3. **Keyboard** (`docs/combobox.md:29-32`):
  - `Down` / `Up` move highlight through visible options without committing. `Home` / `End` → first / last visible.
  - `Enter` commits the highlighted option to `value`, sets `text` to the option label, and closes the popup.
  - `Escape` closes the popup if open; if closed with uncommitted edits, reverts `text` to the committed value's label.

4. **Selection** (`docs/combobox.md:34`): option `selected = combobox.value === option.value`. Disabled options cannot
   be highlighted or selected.

5. **Events** (`docs/combobox.md:38-41`):
  - `input` — native `<input>`: browser-dispatched, not re-dispatched; custom:
    `CustomEvent<string>('input', { bubbles: true, detail: text })` when `text` changes.
  - `change` — on the Combobox container after `value` commits,
    `CustomEvent<string | null>('change', { bubbles: true, detail: value })`.
