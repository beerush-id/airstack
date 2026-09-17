# AlertDialog Specification

The confirmation unit requiring explicit action choice among listed actions. Modal in all bindings; suppresses outside click and Escape dismissal.

- **Entity**: `alert-dialog` (or `confirm`)
- **WAI-ARIA Role**: `alertdialog`

### Parts (Entity Tree)
- **`AlertDialog`**: Root container coordinator (hosts `open`).
- **`AlertDialogTrigger`**: Button opening the alert dialog (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`).
- **`AlertDialogPanel`**: Modal panel (`role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`).
- **`AlertDialogTitle`**: Accessible title (referenced by `aria-labelledby`).
- **`AlertDialogDescription`**: Description text (referenced by `aria-describedby`).
- **`AlertDialogAction`**: Confirmation button (Button contract).
- **`AlertDialogCancel`**: Safe cancellation button (Button contract).

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Dialog** | Native `<dialog>` via `showModal()`. | `role="alertdialog"`, `aria-modal="true"`. | Traps focus, suppresses backdrop click and Escape dismissal. Focus lands on Cancel by default. |
| **Custom Element** | Custom modal element (`<div>`). | `role="alertdialog"`, `aria-modal="true"`. | Background content receives `inert`. Focus trapped inside panel. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `AlertDialogProps`
```ts
export interface AlertDialogProps {
  id?: string;
  open?: boolean;
}
```

### 2. Overload Contracts

```ts
// AlertDialog: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'alert-dialog' | 'confirm',
  props?: AlertDialogProps
): AlertDialogAria<E>;

// AlertDialogTrigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'alert-dialog-trigger',
  props?: AriaProps
): AlertDialogTriggerAria<E>;

// AlertDialogAction
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'alert-dialog-action',
  props?: AriaProps
): AlertDialogActionAria<E>;

// AlertDialogCancel
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'alert-dialog-cancel',
  props?: AriaProps
): AlertDialogCancelAria<E>;
```

---

## State & Lifecycle Rules

1. **Non-Dismissable Modal**:
   - Outside pointer clicks and `Escape` keypresses commit nothing (explicit user choice required).
2. **Safe Initial Focus**:
   - Focus defaults to `AlertDialogCancel` so destructive confirmation is not triggered accidentally.
   - `Tab` cycles focus strictly within the panel.
3. **Closing**:
   - Activating `AlertDialogAction` or `AlertDialogCancel` commits `open = false` and restores focus to opening trigger.
   - Emits `close` event.
