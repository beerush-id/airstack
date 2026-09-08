# Banner Landmark Specification

A banner landmark represents the prime header area for a page, typically containing site identity, logo, or global navigation controls.

- **Role**: `banner`
- **WAI-ARIA Role**: `banner`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Header** | Native `<header>` element scoped directly to `<body>`. | Implicit `role="banner"`. Explicit `role` omitted. | Static landmark. Max 1 per document. |
| **Custom Banner** | Non-semantic element (`<div>`). | `role="banner"`. | Compiles `role="banner"`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface BannerOptions {
  /** Whether bound to native <header> (default: true) */
  native?: boolean;
}

export interface BannerProps {
  /** Accessible label if multiple banners exist */
  label?: string;
  /** Element ID providing accessible label */
  labelledby?: string;
}
```

### 2. Overload Contract

```ts
// Banner: Prime header landmark
export function aria<E extends BaseElement = HTMLElement>(
  role: 'banner',
  props?: BannerProps,
  options?: BannerOptions
): BannerAria<E>;
```
