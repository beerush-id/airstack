# Contentinfo Landmark Specification

A contentinfo landmark represents the main footer area of a document, typically containing copyrights, privacy policies, contact information, and disclaimer links.

- **Role**: `contentinfo`
- **WAI-ARIA Role**: `contentinfo`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Footer** | Native `<footer>` element scoped directly to `<body>`. | Implicit `role="contentinfo"`. Explicit `role` omitted. | Primary footer landmark. Max 1 per document. |
| **Custom Contentinfo** | Non-semantic element (`<div>`). | `role="contentinfo"`. | Compiles `role="contentinfo"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface ContentinfoOptions {
  /** Whether bound to native <footer> (default: true) */
  native?: boolean;
}

export interface ContentinfoProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Contentinfo: Footer landmark (max 1 per document)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'contentinfo',
  props?: ContentinfoProps,
  options?: ContentinfoOptions
): ContentinfoAria<E>;
```
