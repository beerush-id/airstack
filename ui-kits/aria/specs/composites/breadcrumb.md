# Breadcrumb Specification

The trail navigation coordinator unit. Delivers horizontal keyboard traversal across trail links, boundary clamping, and visual separator isolation.

- **Entity**: `breadcrumb`
- **WAI-ARIA Role**: `navigation` (omitted when bound to native `<nav>`)

### Composite Parts (Entity Tree)
- **`Breadcrumb`**: Container coordinator (`role="navigation"`, `aria-label`).
- **`BreadcrumbSeparator`**: Delimiter element (`aria-hidden="true"`).
- Crumb links follow the `Link` contract.

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Breadcrumb`** | Native `<nav>` or `<div>`. | `role="navigation"` (omitted on native `<nav>`), `aria-label`. | Hosts accessible label, coordinates horizontal traversal. |
| **`BreadcrumbSeparator`** | `<span>` or `<div>`. | `aria-hidden="true"`. | Delimiter hidden from screen readers. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `BreadcrumbProps`
```ts
export interface BreadcrumbProps {
  /** Accessible name for the landmark (default: 'Breadcrumbs') */
  label?: string;
}
```

### 2. Overload Contracts

```ts
// Breadcrumb: Navigation container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'breadcrumb',
  props?: BreadcrumbProps
): BreadcrumbAria<E>;

// BreadcrumbSeparator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'breadcrumb-separator',
  props?: AriaProps
): BreadcrumbSeparatorAria<E>;
```

---

## State & Lifecycle Rules

1. **Keyboard Traversal**:
   - `Left` / `Right` navigate previous / next crumb link, clamping at boundaries.
   - `Home` / `End` navigate to first / last crumb link.
   - Separators receive `aria-hidden="true"`.
