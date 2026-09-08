# Dialog Specification

A dialog is an overlay window that prompts the user for input or confirmation.

- **Role**: `dialog`
- **WAI-ARIA Role**: `dialog`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`dialog`** | Native `<dialog>` element. Handles `.showModal()`, native backdrop, and Esc dismissal. | `role="dialog"`, `aria-modal="true"` (if modal), `aria-labelledby`, `aria-describedby`. | Overlay controller (`this.open: boolean`). In `attach()`, manages focus trapping, body scroll lock, Escape key dismissal, and focus restoration upon close. Urgent variants: see `alertdialog`. |
| **`alertdialog`** | Urgent dialog window. | `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`. | See [`alertdialog`](alertdialog.md) (canonical spec; initial focus lands on the least destructive control). |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DialogProps`
```ts
export interface DialogProps {
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
  /** Whether the dialog is modal (traps focus and blocks backdrop, compiled to aria-modal) */
  modal?: boolean;
}
```

### 2. Overload Contract

```ts
// Dialog: Overlay window controller
export function aria<E extends BaseElement = HTMLElement>(
  role: 'dialog',
  props?: DialogProps
): DialogAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection**: `open` reads and writes `props.open`. Props is the single source of state.

2. **Focus Management**:
   - **On Open**: Captures `document.activeElement`. If `modal: true`, traps keyboard focus within first and last focusable elements inside the dialog.
   - **On Close**: Restores focus to the originally captured trigger element.
   - **Alertdialog**: Initial focus must land on the least destructive control (e.g. Cancel).

3. **Escape Dismissal**:
   - Pressing `Escape` invokes `dialog.close()`, unless explicitly prevented.
