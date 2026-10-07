# CheckboxGroup Specification

The checked-set coordinator unit. Hosts an ambient collection of checked values while checkbox members independently
manage activation and focus without roving focus.

- **Entity**: `checkbox-group`
- **WAI-ARIA Role**: `group`

### Composite Parts (Entity Tree)

- **`CheckboxGroup`**: Container coordinator (compiles `role="group"`, `aria-label`, `aria-disabled`).
- **`Checkbox`**: Checkbox member (compiles `role="checkbox"`, `aria-checked`, native checked synchronization).

---

## The Three Semantic Layers

| Part / Role         | HTML Semantic                                       | WAI-ARIA Semantic                                                            | Aria Package Semantic Contract                                                     |
|:--------------------|:----------------------------------------------------|:-----------------------------------------------------------------------------|:-----------------------------------------------------------------------------------|
| **`CheckboxGroup`** | Container (`<div>` or `<fieldset>`).                | `role="group"` (omitted on `<fieldset>`), `aria-label`, `aria-disabled`.     | Hosts `value: string[]`, `disabled`, `label`.                                      |
| **`Checkbox`**      | Native `<input type="checkbox">` or custom element. | `role="checkbox"` (omitted on native input), `aria-checked`, `tabindex="0"`. | Checks `group.value.includes(item.value)`. Independent tab stop (no roving focus). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `CheckboxGroupProps`

```ts
export interface CheckboxGroupProps {
  /** Array of checked member values */
  value?: string[];
  disabled?: boolean;
  label?: string;
  id?: string;
}
```

### 2. Overload Contracts

```ts
// CheckboxGroup: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'checkbox-group',
  props?: CheckboxGroupProps
): CheckboxGroupAria<E>;
```

---

## State & Lifecycle Rules

1. **Independent Tab Stops**:
  - Every enabled member remains independently reachable through `Tab`.
  - The group does **not** introduce roving focus or arrow-key selection (per WAI-ARIA APG standard).

2. **Activation**:
  - Activating a checkbox toggles its membership in `group.value`.
  - Dispatches bubbling change event carrying checked state.
