# Tooltip Specification

A tooltip is a contextual popup that displays non-essential, advisory information describing an interactive element when that element receives keyboard focus or pointer hover.

- **Role**: `tooltip`
- **WAI-ARIA Role**: `tooltip`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Tooltip Overlay** | Non-interactive advisory element (`<div>`). Strictly non-focusable (no `tabindex`). | `role="tooltip"`, `id`. Referenced by host trigger via `aria-describedby`. | Ambient self-discovering overlay (`this.scope`). Tracks hover/focus timers and injects `aria-describedby` onto target element. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TooltipOptions`
```ts
export interface TooltipOptions {
  /** Delay in milliseconds before showing the tooltip */
  delay?: number;
}
```

#### `TooltipProps`
```ts
export interface TooltipProps {
  /** Optional DOM element identifier (referenced by host trigger aria-describedby) */
  id?: string;
  /** Explicit open state */
  open?: boolean;
}
```

### 2. Overload Contract

```ts
// Tooltip: Non-interactive advisory overlay discovering its host via scope
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tooltip',
  props?: TooltipProps,
  options?: TooltipOptions
): TooltipAria<E>;
```

---

## State & Lifecycle Rules

1. **Overlay Linkage**:
   - Discovers parent controller via ambient scope (`this.scope`).
   - Injects `aria-describedby="{tooltip.id}"` onto host element while open.
   - Non-interactive: does not trap focus and does not accept keyboard focus.

2. **Dismissal**:
   - Dismisses when pointer leaves trigger or `Escape` key is pressed.

3. **Delay**:
   - `delay` is milliseconds before showing on hover/focus; re-entering the trigger resets the timer; `delay: 0` or omitted shows immediately.
