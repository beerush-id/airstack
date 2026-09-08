# Log Live Region Specification

A log live region is an append-only stream where new information is added sequentially and old information may disappear (e.g. chat history, game logs, error console).

- **Role**: `log`
- **WAI-ARIA Role**: `log`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Log Stream** | Stream container (`<div>` or `<ul>`). | `role="log"`. Implicit `aria-live="polite"`, `aria-atomic="false"`. | Append-only sequential update stream manager. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface LogProps {
  /** Politeness level (default: 'polite') */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether the region is atomic (default: false for logs) */
  atomic?: boolean;
  /** Whether the stream is actively fetching or writing */
  busy?: boolean;
}
```

### 2. Overload Contract

```ts
// Log: Append-only sequential update stream
export function aria<E extends BaseElement = HTMLElement>(
  role: 'log',
  props?: LogProps
): LogAria<E>;
```
