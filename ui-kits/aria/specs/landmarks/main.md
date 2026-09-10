# Main Landmark Specification

A main is the primary unique content area an author holds in a document, enabling users of assistive technologies to quickly skip repetitive site navigation.

- **Entity**: `main`
- **WAI-ARIA Role**: `main` (compiled output)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Main** | Native `<main>` element. | Implicit `role="main"`. Explicit `role` omitted. | Primary entity. Exactly 1 per document. |
| **Custom Main** | Non-semantic element (`<div>`). | `role="main"`. | Compiles `role="main"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface MainOptions {
  /** Whether bound to native <main> (default: true) */
  native?: boolean;
}

export interface MainProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Main: Primary content landmark (exactly 1 per document)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'main',
  props?: MainProps,
  options?: MainOptions
): MainAria<E>;
```
