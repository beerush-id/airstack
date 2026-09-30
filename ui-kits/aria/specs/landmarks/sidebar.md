# Sidebar Landmark Specification

A sidebar is the supporting section an author holds beside the main content (e.g. sidebars, related links, quick notes).

- **Entity**: `sidebar`
- **WAI-ARIA Role**: `complementary` (compiled output)

---

## The Three Semantic Layers

| Context            | HTML Semantic                   | WAI-ARIA Semantic                                         | Aria Package Semantic Contract   |
|:-------------------|:--------------------------------|:----------------------------------------------------------|:---------------------------------|
| **Native Aside**   | Native `<aside>` element.       | Implicit `role="complementary"`. Explicit `role` omitted. | Supporting landmark.             |
| **Custom Sidebar** | Non-semantic element (`<div>`). | `role="complementary"`.                                   | Compiles `role="complementary"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface SidebarOptions {
  /** Whether bound to native <aside> (default: true) */
  native?: boolean;
}

export interface SidebarProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing the accessible name */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Sidebar: Supporting section landmark
export function aria<E extends BaseElement = HTMLElement>(
  role: 'sidebar',
  props?: SidebarProps,
  options?: SidebarOptions
): SidebarAria<E>;
```
