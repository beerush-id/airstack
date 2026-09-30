# Footer Landmark Specification

A footer is the main footer area an author holds at the end of a document, typically containing copyrights, privacy
policies, contact information, and disclaimer links.

- **Entity**: `footer`
- **WAI-ARIA Role**: `contentinfo` (compiled output)

---

## The Three Semantic Layers

| Context           | HTML Semantic                                          | WAI-ARIA Semantic                                       | Aria Package Semantic Contract               |
|:------------------|:-------------------------------------------------------|:--------------------------------------------------------|:---------------------------------------------|
| **Native Footer** | Native `<footer>` element scoped directly to `<body>`. | Implicit `role="contentinfo"`. Explicit `role` omitted. | Primary footer landmark. Max 1 per document. |
| **Custom Footer** | Non-semantic element (`<div>`).                        | `role="contentinfo"`.                                   | Compiles `role="contentinfo"`.               |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface FooterOptions {
  /** Whether bound to native <footer> (default: true) */
  native?: boolean;
}

export interface FooterProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Footer: Footer landmark (max 1 per document)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'footer',
  props?: FooterProps,
  options?: FooterOptions
): FooterAria<E>;
```
