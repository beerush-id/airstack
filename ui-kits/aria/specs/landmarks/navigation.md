# Navigation Landmark Specification

A navigation landmark represents a major collection of navigational links or menus.

- **Role**: `navigation`
- **WAI-ARIA Role**: `navigation`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Nav** | Native `<nav>` element. | Implicit `role="navigation"`. Explicit `role` omitted. | Navigation landmark. When multiple exist on a page, each must be labeled. |
| **Custom Navigation** | Non-semantic element (`<div>`). | `role="navigation"`. | Compiles `role="navigation"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface NavigationOptions {
  /** Whether bound to native <nav> (default: true) */
  native?: boolean;
}

export interface NavigationProps {
  /** Accessible label to distinguish from other navigation landmarks */
  label?: string;
  /** Element ID providing the accessible name */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Navigation: Collection of navigational links
export function aria<E extends BaseElement = HTMLElement>(
  role: 'navigation',
  props?: NavigationProps,
  options?: NavigationOptions
): NavigationAria<E>;
```
