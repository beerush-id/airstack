# Search Landmark Specification

A search landmark designates a region that contains a collection of items and objects that, as a whole, combine to create a search facility.

- **Role**: `search`
- **WAI-ARIA Role**: `search`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Search** | Native `<search>` element. | Implicit `role="search"`. Explicit `role` omitted. | Identifies site search landmark. |
| **Custom Search** | `<form role="search">` or `<div>`. | `role="search"`. | Compiles `role="search"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface SearchLandmarkOptions {
  /** Whether bound to native <search> (default: true) */
  native?: boolean;
}

export interface SearchLandmarkProps {
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Search: Site-search landmark
export function aria<E extends BaseElement = HTMLElement>(
  role: 'search',
  props?: SearchLandmarkProps,
  options?: SearchLandmarkOptions
): SearchAria<E>;
```
