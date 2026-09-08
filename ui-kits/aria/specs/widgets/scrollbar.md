# Scrollbar Specification

A scrollbar is a graphical widget that controls the scrolling of content within a scrollable container.

- **Role**: `scrollbar`
- **WAI-ARIA Role**: `scrollbar`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Custom Scrollbar** | Visual thumb and track (`<div>`). | `role="scrollbar"`, `aria-controls` (scrollable container ID), `aria-orientation`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `tabindex="-1"` (or `0`). | Custom scrollbar controller synchronizing scroll position with target scroll container. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ScrollbarProps`
```ts
export interface ScrollbarProps {
  /** Current scroll position offset */
  value?: number;
  /** Orientation of the scrollbar (default: 'vertical') */
  orientation?: 'horizontal' | 'vertical';
  /** Minimum scroll offset (usually 0) */
  min?: number;
  /** Maximum scroll offset */
  max?: number;
  /** ID of the scrollable container element controlled by this scrollbar */
  controls?: string;
}
```

### 2. Overload Contract

```ts
// Scrollbar: Custom scroll-position controller
export function aria<E extends BaseElement = HTMLElement>(
  role: 'scrollbar',
  props?: ScrollbarProps
): ScrollbarAria<E>;
```

---

## State & Lifecycle Rules

1. **Target Synchronization**:
   - Manages scroll position of target container referenced by `controls`.
   - `aria-valuenow` reflects current scroll offset.
