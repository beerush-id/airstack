# Listbox Specification

The option-selection group. Coordinates single or multiple option selection with a single tab-stop and typeahead
capability.

- **Entity**: `listbox`
- **WAI-ARIA Role**: `listbox`

### Composite Parts (Entity Tree)

- **`Listbox`**: Group coordinator (compiles `role="listbox"`, `aria-multiselectable`).
- **`Option`**: Option members (compiles `role="option"`, `aria-selected`, `aria-disabled`). See [Option](../widgets/option.md).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                                                                  | WAI-ARIA Semantic                                                                                                                                                                                                                          | Aria Package Semantic Contract                                                                                                                                                                                                                   |
|:--------------------|:-------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`Listbox`**       | Non-semantic container (`<div>` / `<ul>`). | `role="listbox"`, `aria-multiselectable`, `aria-required="true"` when `required`, `aria-label` from `label`. Single tab-stop. | Group coordinator. Props: `ListboxProps`. Adopts `ambientProps ?? props`. Coordinates selection, single tab-stop navigation, typeahead, and optional query filtering. |
| **`Option`**        | Non-semantic element (`<li>` / `<div>`).   | `role="option"`, `aria-selected`, `aria-disabled`, `aria-label` (explicit `label`; default = text content).                     | Choice member: `this.props.value`. Handled by [Option](../widgets/option.md).                                                                                           |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleListboxProps`

```ts
export interface SingleListboxProps {
  multiple?: false;
  value?: string | null;
  query?: string;
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
  query?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}
```

#### `ListboxProps`

```ts
export type ListboxProps = SingleListboxProps | MultipleListboxProps;
```

### 2. Overload Contracts

```ts
// Listbox: Inline listbox container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'listbox',
  props?: ListboxProps
): ListboxAria<E>;
```

---

## State & Lifecycle Rules

1. **Tab Stop & Navigation**:
  - Exactly one tab-stop for the composite group in the sequential tab order.
  - `Down` / `Up` move focus to next / previous enabled option.
  - `Home` / `End` move focus to first / last enabled option.
  - Typeahead: printable characters match against options' `textContent` to move focus (500ms debounce).

2. **Activation & Selection**:
  - Activation (`Space`, `Enter`, click) selects the focused option.
  - Single: sets or replaces the scalar value (`string | null`).
  - Multiple: toggles membership in the collection value (`string[]`).

3. **Events**:
  - `input`: When roving, the focused option dispatches an `input` event with its value as `detail`, which the container forwards.
  - `change`: Dispatched on selection commit (value update via activation).

4. **Composition & Ambient Host**:
  - Resolves properties as `this.properties = ambientProps ?? props`: adopts the enclosing host's props directly when nested; otherwise uses its own direct `props`.
