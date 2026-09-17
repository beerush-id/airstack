# Listbox Specification

The inline option-selection unit. Coordinates single or multiple selection, active-option navigation, and typeahead without requiring a trigger or open state.

- **Entity**: `listbox`
- **WAI-ARIA Role**: `listbox`

### Composite Parts (Entity Tree)
- **`Listbox`**: Container coordinator (compiles `role="listbox"`, `aria-multiselectable`, `aria-activedescendant`, `tabindex="0"`).
- **`ListboxOption`**: Option members (compiles `role="option"`, `aria-selected`, `aria-disabled`).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Listbox`** | Native list `<select size="2+">` or non-semantic container (`<div>` / `<ul>`). | `role="listbox"` (omitted on native `<select>`), `aria-multiselectable`, `aria-activedescendant`, `tabindex="0"`. | Container coordinator. Props: `ListboxProps`. Hosts `value`, `multiple`, `disabled`, `required`. Manages virtual focus or native selection pass-through. |
| **`ListboxOption`** | Native `<option>` or non-semantic element (`<li>` / `<div>`). | `role="option"`, `aria-selected`, `aria-disabled`. | Choice candidate: `this.props.value`. Props: `ListboxOptionProps`. Derived active state based on equality or membership. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleListboxProps`
```ts
export interface SingleListboxProps {
  multiple?: false;
  value?: string | null;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}
```

#### `MultipleListboxProps`
```ts
export interface MultipleListboxProps {
  multiple: true;
  value?: string[];
  disabled?: boolean;
  required?: boolean;
  label?: string;
}
```

#### `ListboxProps`
```ts
export type ListboxProps = SingleListboxProps | MultipleListboxProps;
```

#### `ListboxOptions`
```ts
export interface ListboxOptions {
  /** Whether bound to native list-style <select size="2+"> (default: false) */
  native?: boolean;
}
```

#### `ListboxOptionOptions`
```ts
export interface ListboxOptionOptions {
  /** Whether bound to native <option> (default: false) */
  native?: boolean;
}
```

#### `ListboxOptionProps`
```ts
export interface ListboxOptionProps {
  value: string;
  label?: string;
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Listbox: Inline listbox container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'listbox',
  props?: ListboxProps,
  options?: ListboxOptions
): ListboxAria<E>;

// ListboxOption: Member option
export function aria<E extends BaseElement = HTMLElement>(
  role: 'listbox-option' | 'option',
  props: ListboxOptionProps,
  options?: ListboxOptionOptions
): ListboxOptionAria<E>;
```

---

## State & Lifecycle Rules

1. **Focus & Active Descendant**:
   - Single sequential tab stop (`tabindex="0"` on container).
   - DOM focus remains on the container; active option is exposed via `aria-activedescendant`.
   - On entry: previously active enabled option, or first selected enabled option, or first enabled option.

2. **Keyboard Navigation**:
   - `Down` / `Up` move to next / previous enabled option, clamping at boundaries.
   - `Home` / `End` move to first / last enabled option.
   - Typeahead: printable characters navigate matching option labels with 500ms debounce.
   - Single-selection: arrow navigation or activation commits the active option value.
   - Multiple-selection: navigation moves focus without changing selection; `Space` / `Enter` toggles target option membership.

3. **Events**:
   - When native `<select>`: native `input` and `change` pass through.
   - When custom: dispatches `CustomEvent<string | null | string[]>('input', { bubbles: true, detail: value })` and `CustomEvent<string | null | string[]>('change', { bubbles: true, detail: value })` on container.
