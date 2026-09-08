# Status Live Region Specification

A status live region is an advisory message that informs the user of non-critical status changes (e.g. "Draft saved", "5 items found").

- **Role**: `status`
- **WAI-ARIA Role**: `status`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Output** | Native `<output>` element. Implicit `status` role. | `role="status"` (omitted if `<output>`). Implicit `aria-live="polite"`, `aria-atomic="true"`. | Advisory status notification manager. |
| **Custom Status** | Non-semantic element (`<div>`). | `role="status"`. Implicit `aria-live="polite"`, `aria-atomic="true"`. | Compiles `role="status"` and polite live attributes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

```ts
export interface StatusOptions {
  /** Whether bound to native <output> (default: true) */
  native?: boolean;
}

export interface StatusProps {
  /** Politeness level (default: 'polite') */
  politeness?: 'polite' | 'assertive' | 'off';
  /** Whether the region is atomic (default: true) */
  atomic?: boolean;
  /** Whether the region is actively busy updating */
  busy?: boolean;
}
```

### 2. Overload Contract

```ts
// Status: Advisory live notification (polite by default)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'status',
  props?: StatusProps,
  options?: StatusOptions
): StatusAria<E>;
```
