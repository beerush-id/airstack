# Tooltip Specification

A tooltip is a non-interactive advisory popup displaying helper text when an interactive element receives keyboard focus
or pointer hover. Complies with WCAG 2.1 SC 1.4.13 hoverable requirements.

- **Entity**: `tooltip`
- **WAI-ARIA Role**: `tooltip`

### Parts

- **`Tooltip`**: Container coordinator hosting `open` and `delay`.
- **`TooltipTrigger`**: Anchor trigger (receives `aria-describedby` when open).
- **`TooltipPanel`**: Advisory text panel (`role="tooltip"`, receives `hidden` when closed, no `tabindex`).

---

## The Three Semantic Layers

| Context             | HTML Semantic                                         | WAI-ARIA Semantic                                      | Aria Package Semantic Contract                          |
|:--------------------|:------------------------------------------------------|:-------------------------------------------------------|:--------------------------------------------------------|
| **Tooltip Trigger** | Interactive button or link.                           | `aria-describedby` referencing tooltip ID when open.   | Anchors hover and keyboard focus.                       |
| **Tooltip Panel**   | Advisory container (`<div>`). Strictly non-focusable. | `role="tooltip"`, `id`. Receives `hidden` when closed. | Hoverable per WCAG 2.1 SC 1.4.13. Never receives focus. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TooltipProps`

```ts
export interface TooltipProps {
  id?: string;
  /** Visibility state */
  open?: boolean;
  /** Hover delay in milliseconds before showing (default: 300) */
  delay?: number;
}
```

### 2. Overload Contracts

```ts
// Tooltip: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tooltip',
  props?: TooltipProps
): TooltipAria<E>;

// TooltipTrigger
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tooltip-trigger',
  props?: AriaProps
): TooltipTriggerAria<E>;

// TooltipPanel
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tooltip-panel',
  props?: AriaProps
): TooltipPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Triggering & Hoverability**:
  - Keyboard focus shows tooltip immediately without delay (`open = true`).
  - Pointer hover over trigger shows tooltip after `delay` (`open = true`).
  - Pointer can move over TooltipPanel without dismissing (WCAG 2.1 SC 1.4.13).
  - Moving off both trigger and panel hides tooltip (`open = false`).
  - `Escape` keypress hides tooltip and stops propagation.

2. **Events**:
  - `change` — Dispatched on Tooltip container when `open` commits as
    `CustomEvent<boolean>('change', { bubbles: true, detail: open })`.
