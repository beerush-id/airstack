# Splitter Specification

A splitter is the interactive movable partition an author holds between resizable panels. It always owns a tab stop and adjusts its partition position with arrow keys.

- **Entity**: `splitter`
- **WAI-ARIA Role**: `separator` (compiled output)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Movable Splitter** | Custom interactive divider (`<div>`). | `role="separator"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-orientation`, `tabindex="0"`. | Interactive splitter controller. Polyfills Arrow keys to adjust position value. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SplitterOptions`
```ts
export interface SplitterOptions {
  /** Whether bound to a native host (default: true) */
  native?: boolean;
}
```

#### `SplitterProps`
```ts
export interface SplitterProps {
  /** Current partition position */
  value?: number;
  /** Splitter axis (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Minimum partition position (default: 0) */
  min?: number;
  /** Maximum partition position (default: 100) */
  max?: number;
}
```

### 2. Overload Contract

```ts
// Splitter: Interactive movable partition with a tab stop and range announcements
export function aria<E extends BaseElement = HTMLElement>(
  role: 'splitter',
  props?: SplitterProps,
  options?: SplitterOptions
): SplitterAria<E>;
```

---

## State & Lifecycle Rules

1. **Always Movable**:
   - A splitter is always focusable with `tabindex="0"` and always announces `aria-valuenow` within `[min, max]`.
   - Right and Down always advance the partition regardless of divider axis; Left and Up retreat it. For a static boundary with no value, see `divider`.
