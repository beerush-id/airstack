# Pagination Specification

The page-list navigation coordinator unit. Delivers enhanced keyboard traversal (`Left`, `Right`, `Home`, `End`) across
page controls, wrapping at both ends.

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
  /** Element ID providing the accessible name */
  labelledby?: string;
  /** Current page position (default: 1) */
  page?: number;
  /** Last page position; absent means the forward bound is unknown */
  total?: number;
}
```

### 2. Overload Contracts

```ts
// Pagination: Navigation container holding the page position
export function aria<E extends BaseElement = HTMLElement>(
  role: 'pagination',
  props?: PaginationProps,
  options?: AriaOptions
): PaginationAria<E>;
```

---

## State & Lifecycle Rules

1. **Keyboard Traversal**:
  - `Left` / `Right` move DOM focus to previous / next enabled control, wrapping at both ends.
  - `Home` / `End` move focus to first / last enabled control.
  - Skips disabled controls.
  - Up and Down arrows preserve native scroll.

2. **Page Position**:
  - `page` (default `1`) and `total` are consumed inputs owned through `omittedAttrs`; neither compiles to an attribute
    nor reaches the DOM. `page` is a readable and writable reactive projection, `total` read-only.
  - `canBackward` is `page > 1`. `canForward` is `total !== undefined && page < total`, so an unknown `total` holds no
    forward bound.
  - `prev()` / `next()` step one page and no-op at their bound. They stop rather than wrap, so binding them to a
    control's `disabled` is the whole guard.
  - Page links carry `page` and commit it on activation ([link.md](../widgets/link.md)), so the run has one source of
    truth whether the reader clicks a page number or a prev / next control.

3. **Baseline**: extends `NavigationBase` ([navigation.md](navigation.md)) and inherits traversal, naming, role
   compilation, and `navCtx` publication. Pagination adds only `defaultLabel: 'Pagination'` and the page position.
