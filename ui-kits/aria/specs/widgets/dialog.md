# Dialog Specification

A dialog is an overlay window that prompts the user for input or interaction. Supports modal and non-modal modes across native `<dialog>` and custom elements.

- **Entity**: `dialog`
- **WAI-ARIA Role**: `dialog`

### Parts (Entity Tree)
- **`Dialog`**: Container coordinator hosting ambient `open`, `modality`, and `dismissable` state.
- **`DialogTrigger`**: Interactive button opening dialog (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`).
- **`DialogPanel`**: Overlay panel (`role="dialog"`, `aria-modal="true"`/`"false"`, `aria-labelledby`, `aria-describedby`).
- **`DialogTitle`**: Dialog title element (referenced by `aria-labelledby`).
- **`DialogDescription`**: Dialog description element (referenced by `aria-describedby`).
- **`DialogClose`**: Close button (Button contract).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Dialog`** | Native `<dialog>` or `<div>`. | `role="dialog"`, `aria-modal="true"` (modal) \| `"false"` (nonmodal). | Overlay controller (`open: boolean`, `modality`, `dismissable`). Manages focus trap, `inert`, Esc dismissal, and focus restoration. |
| **`DialogTrigger`** | Native `<button type="button">`. | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. | Follows Button contract, toggles dialog. |
| **`DialogClose`** | Native `<button type="button">`. | Follows Button contract. | Commits `open = false`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DialogProps`
```ts
export interface DialogProps {
  id?: string;
  open?: boolean;
  modality?: 'modal' | 'nonmodal';
  dismissable?: boolean;
}
```

### 2. Overload Contracts

```ts
// Dialog: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'dialog',
  props?: DialogProps
): DialogAria<E>;

// DialogTrigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'dialog-trigger',
  props?: AriaProps
): DialogTriggerAria<E>;

// DialogClose
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'dialog-close',
  props?: AriaProps
): DialogCloseAria<E>;

// DialogPanel — carries role="dialog", aria-modal, aria-labelledby, aria-describedby
export function aria<E extends BaseElement = HTMLElement>(
  role: 'dialog-panel',
  props?: AriaProps
): DialogPanelAria<E>;

// DialogTitle (referenced by the panel's aria-labelledby)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'dialog-title',
  props?: AriaProps
): DialogTitleAria<E>;

// DialogDescription (referenced by the panel's aria-describedby when present)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'dialog-description',
  props?: AriaProps
): DialogDescriptionAria<E>;
```

> Panel, Title and Description overloads are required because `docs/dialog.md:42` places `role="dialog"`, `aria-modal`, `aria-labelledby` and `aria-describedby` on the **DialogPanel**, not the container.

---

## State & Lifecycle Rules

1. **Native `<dialog>` vs Custom**:
   - Native: `showModal()` under `modal`, `show()` under `nonmodal`. Native backdrop and `inert` pass through.
   - Custom: `role="dialog"`, background gets `inert` while modal open.

2. **Focus Management**:
   - On open: Focus moves to declared target or first focusable element inside panel.
   - On close: Focus restores to opening trigger.

3. **Dismissal**:
   - Under `dismissable: true`: `Escape` or outside click initiates dismissal. Under `dismissable: false` (the confirm pattern) they commit nothing.

4. **Events** (`docs/dialog.md:26-33`):
   - `cancel` — native: browser-dispatched on `Escape`, not re-dispatched. Custom: dispatched on the **DialogPanel** when `Escape` is pressed as `CustomEvent<void>('cancel', { bubbles: false, cancelable: true })`; if `defaultPrevented` is false it commits `open = false` (the veto, stated — dialog's `cancel` is refusal-capable, unlike confirm's non-cancelable `close`).
   - `close` — native: browser-dispatched on `dialog.close()`, not re-dispatched. Custom: dispatched on the **DialogPanel** after `open = false` commits as `CustomEvent<void>('close', { bubbles: false })`.
