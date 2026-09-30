# Pagination Specification

The page-list navigation coordinator unit. Delivers enhanced keyboard traversal (`Left`, `Right`, `Home`, `End`) across
page controls and boundary clamping.

- **Entity**: `pagination`
- **WAI-ARIA Role**: `navigation` (omitted when bound to native `<nav>`)

### Composite Parts (Entity Tree)

- **`Pagination`**: Container coordinator (`role="navigation"`, `aria-label`).
- Slotted page links follow the `Link` contract (`aria-current="page"` on active page).

---

## The Three Semantic Layers

| Part / Role      | HTML Semantic              | WAI-ARIA Semantic                                              | Aria Package Semantic Contract                                                     |
|:-----------------|:---------------------------|:---------------------------------------------------------------|:-----------------------------------------------------------------------------------|
| **`Pagination`** | Native `<nav>` or `<div>`. | `role="navigation"` (omitted on native `<nav>`), `aria-label`. | Hosts accessible label, coordinates rapid keyboard traversal across page controls. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `PaginationProps`

```ts
export interface PaginationProps {
  /** Accessible name for the navigation landmark (default: 'Pagination') */
  label?: string;
}
```

### 2. Overload Contracts

```ts
// Pagination: Navigation container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'pagination',
  props?: PaginationProps
): PaginationAria<E>;
```

---

## State & Lifecycle Rules

1. **Keyboard Traversal**:
  - `Left` / `Right` move DOM focus to previous / next enabled control, clamping at boundaries without wrapping.
  - `Home` / `End` move focus to first / last enabled control.
  - Skips disabled controls.
  - Up and Down arrows preserve native scroll.
