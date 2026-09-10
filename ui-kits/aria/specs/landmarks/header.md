# Header Landmark Specification

A header is the prime header area an author holds at the start of a page, typically containing site identity, logo, or global navigation controls.

- **Entity**: `header`
- **WAI-ARIA Role**: `banner` (compiled output)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Header** | Native `<header>` element scoped directly to `<body>`. | Implicit `role="banner"`. Explicit `role` omitted. | Static landmark. Max 1 per document. |
| **Custom Header** | Non-semantic element (`<div>`). | `role="banner"`. | Compiles `role="banner"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface HeaderOptions {
  /** Whether bound to native <header> (default: true) */
  native?: boolean;
}

export interface HeaderProps {
  /** Accessible label if multiple headers exist */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Header: Prime header landmark
export function aria<E extends BaseElement = HTMLElement>(
  role: 'header',
  props?: HeaderProps,
  options?: HeaderOptions
): HeaderAria<E>;
```
