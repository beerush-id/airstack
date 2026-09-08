# Separator Specification

A separator is a line or boundary that separates sections of content or groups of menuitems. It can be purely static or an interactive movable splitter.

- **Role**: `separator`
- **WAI-ARIA Role**: `separator`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Static Separator** | Native `<hr>` (horizontal rule). | `role="separator"` (custom only), `aria-orientation` (if vertical). | Static visual divider. Non-focusable (`tabindex` omitted). |
| **Movable Splitter** | Custom interactive divider (`<div>`). | `role="separator"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-orientation`, `tabindex="0"`. | Interactive splitter controller. Polyfills Arrow keys to adjust position value. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SeparatorOptions`
```ts
export interface SeparatorOptions {
  /** Whether bound to native <hr> (default: true) */
  native?: boolean;
}
```

#### `SeparatorProps`
```ts
export interface SeparatorProps {
  /** Whether the separator is an interactive movable splitter */
  movable?: boolean;
  /** Current position value (if movable) */
  value?: number;
  /** Separator orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Minimum position value (if movable) */
  min?: number;
  /** Maximum position value (if movable) */
  max?: number;
}
```

### 2. Overload Contract

```ts
// Separator: Static divider, or movable splitter when `movable: true`
export function aria<E extends BaseElement = HTMLElement>(
  role: 'separator',
  props?: SeparatorProps,
  options?: SeparatorOptions
): SeparatorAria<E>;
```

---

## State & Lifecycle Rules

1. **Static vs. Movable**:
   - **Static (`movable: false`)**: Pure structural divider without `tabindex` or value attributes.
   - **Movable (`movable: true`)**: Focusable widget with `tabindex="0"` and `aria-valuenow` representing partition boundary.
