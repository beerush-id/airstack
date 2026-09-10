# Confirm Specification

A confirm is the blocking confirmation an author holds when a destructive or irreversible action needs an explicit answer before proceeding. It interrupts the workflow, delivers the critical information, and requires an immediate response.

- **Entity**: `confirm`
- **WAI-ARIA Role**: `alertdialog` (compiled output)

> No factory surface ships yet: this is an entity spec only. The overload below is reserved.

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Confirm** | Modal container (`<dialog>` or `<div>`). HTML has no native confirm element; `role="alertdialog"` must always be explicitly declared. | `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`. | Urgent modal overlay. Traps focus, locks background scroll, and directs initial focus to the least destructive action button. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ConfirmProps`
```ts
export interface ConfirmProps {
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

### 2. Overload Contract (reserved, not implemented)

```ts
// Confirm: Urgent modal overlay
export function aria<E extends BaseElement = HTMLElement>(
  role: 'confirm',
  props?: ConfirmProps
): ConfirmAria<E>;
```

---

## State & Lifecycle Rules

1. **Initial Focus**:
   - Initial focus must NOT land on a destructive action (e.g. "Delete" or "Format").
   - Focus must automatically land on the safest or least destructive control (e.g. "Cancel").

2. **Modal Trap & Dismissal**:
   - Keyboard focus is trapped strictly within the confirm.
   - Escape key dismisses the dialog unless explicitly prevented by confirmation requirements.
