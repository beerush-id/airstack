# Breadcrumb Specification

The trail navigation coordinator unit. Delivers horizontal keyboard traversal across trail links, boundary clamping, and
visual separator isolation.

- **Entity**: `breadcrumb`
- **WAI-ARIA Role**: `navigation` (omitted when bound to native `<nav>`)

### Composite Parts (Entity Tree)

- **`Breadcrumb`**: Container coordinator (`role="navigation"`, `aria-label`).
- **`BreadcrumbSeparator`**: Delimiter element (`aria-hidden="true"`).
- Crumb links follow the `Link` contract.

---

## The Three Semantic Layers

| Part / Role               | HTML Semantic              | WAI-ARIA Semantic                                              | Aria Package Semantic Contract                            |
|:--------------------------|:---------------------------|:---------------------------------------------------------------|:----------------------------------------------------------|
| **`Breadcrumb`**          | Native `<nav>` or `<div>`. | `role="navigation"` (omitted on native `<nav>`), `aria-label`. | Hosts accessible label, coordinates horizontal traversal. |
| **`BreadcrumbSeparator`** | `<span>` or `<div>`.       | `aria-hidden="true"`.                                          | Delimiter hidden from screen readers.                     |

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

1. **Traversal** (`docs/breadcrumb.md:15-21`): `Left`/`Right` move focus to the previous/next crumb link, `Home`/`End`
   to first/last, clamping at boundaries and skipping disabled links. `Up`/`Down` preserve native scroll.

2. **Crumb links follow the Link contract** (`docs/breadcrumb.md:34`): each crumb is a `link`-controlled anchor and
   therefore a sequential tab stop; there is **no** single-tab-stop roving model (the source names none). The terminal
   crumb's current-page announcement comes from the Link unit's `current` / `linkCtx` → `aria-current="page"` rule
   ([link.md](../widgets/link.md)), not a breadcrumb-specific prop.

3. **Separators** (`docs/breadcrumb.md:36`): `aria-hidden="true"` so decorative delimiters are not announced.
