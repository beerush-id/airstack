# Complementary Landmark Specification

A complementary landmark represents a supporting section of the document designed to be complementary to the main content (e.g. sidebars, related links, quick notes).

- **Role**: `complementary`
- **WAI-ARIA Role**: `complementary`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Aside** | Native `<aside>` element. | Implicit `role="complementary"`. Explicit `role` omitted. | Supporting landmark. |
| **Custom Complementary** | Non-semantic element (`<div>`). | `role="complementary"`. | Compiles `role="complementary"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface ComplementaryOptions {
  /** Whether bound to native <aside> (default: true) */
  native?: boolean;
}

export interface ComplementaryProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing the accessible name */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Complementary: Supporting section landmark
export function aria<E extends BaseElement = HTMLElement>(
  role: 'complementary',
  props?: ComplementaryProps,
  options?: ComplementaryOptions
): ComplementaryAria<E>;
```
