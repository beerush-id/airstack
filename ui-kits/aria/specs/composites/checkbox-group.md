# CheckboxGroup Specification

The checked-set coordinator unit. Hosts an ambient collection of checked values while checkbox members independently manage activation and focus without roving focus.

- **Entity**: `checkbox-group`
- **WAI-ARIA Role**: `group`

### Composite Parts (Entity Tree)
- **`CheckboxGroup`**: Container coordinator (compiles `role="group"`, `aria-label`, `aria-disabled`).
- **`CheckboxGroupItem`**: Checkbox member (compiles `role="checkbox"`, `aria-checked`, native checked synchronization).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`CheckboxGroup`** | Container (`<div>` or `<fieldset>`). | `role="group"` (omitted on `<fieldset>`), `aria-label`, `aria-disabled`. | Hosts `value: string[]`, `disabled`, `label`. |
| **`CheckboxGroupItem`** | Native `<input type="checkbox">` or custom element. | `role="checkbox"` (omitted on native input), `aria-checked`, `tabindex="0"`. | Checks `group.value.includes(item.value)`. Independent tab stop (no roving focus). |

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
}
```

#### `CheckboxGroupItemProps`
```ts
export interface CheckboxGroupItemProps {
  /** Member identifier */
  value: string;
  disabled?: boolean;
}
```

#### `CheckboxGroupItemOptions`
```ts
export interface CheckboxGroupItemOptions {
  /** Whether bound to native <input type="checkbox"> (default: true) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// CheckboxGroup: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'checkbox-group',
  props?: CheckboxGroupProps
): CheckboxGroupAria<E>;

// CheckboxGroupItem: Member
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'checkbox-group-item',
  props: CheckboxGroupItemProps,
  options?: CheckboxGroupItemOptions
): CheckboxGroupItemAria<E>;
```

---

## State & Lifecycle Rules

1. **Independent Tab Stops**:
   - Every enabled member remains independently reachable through `Tab`.
   - The group does **not** introduce roving focus or arrow-key selection (per WAI-ARIA APG standard).

2. **Activation**:
   - Activating an item toggles its membership in `group.value`.
   - Dispatches `CustomEvent<string[]>('change', { bubbles: true, detail: group.value })` on container.
