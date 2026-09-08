# Alertdialog Specification

An alertdialog is an urgent dialog window that interrupts the user's workflow to deliver critical information and require immediate response.

- **Role**: `alertdialog`
- **WAI-ARIA Role**: `alertdialog`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Alertdialog** | Modal container (`<dialog>` or `<div>`). HTML has no native `<alertdialog>` element; `role="alertdialog"` must always be explicitly declared. | `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`. | Urgent modal overlay. Traps focus, locks background scroll, and directs initial focus to the least destructive action button. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `AlertDialogProps`
```ts
export interface AlertDialogProps {
  /** Optional DOM element identifier */
  id?: string;
  /** Accessible label */
  label?: string;
  /** Element ID providing accessible label (heading) */
  labelledby?: string;
  /** Element ID providing detailed description */
  describedby?: string;
  /** Visibility state */
  open?: boolean;
}
```

### 2. Overload Contracts

```ts
// AlertDialog: Urgent modal overlay
export function aria<E extends BaseElement = HTMLElement>(
  role: 'alertdialog',
  props?: AlertDialogProps
): AlertDialogAria<E>;
```

---

## State & Lifecycle Rules

1. **Initial Focus**:
   - Initial focus must NOT land on a destructive action (e.g. "Delete" or "Format").
   - Focus must automatically land on the safest or least destructive control (e.g. "Cancel").

2. **Modal Trap & Dismissal**:
   - Keyboard focus is trapped strictly within the alertdialog.
   - Escape key dismisses the dialog unless explicitly prevented by confirmation requirements.
