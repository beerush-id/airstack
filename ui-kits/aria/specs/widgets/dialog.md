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
```

---

## State & Lifecycle Rules

1. **Native `<dialog>` vs Custom**:
   - Native: `showModal()` under `modal`, `show()` under `nonmodal`. Native backdrop and `inert` pass through.
   - Custom: `role="dialog"`, background gets `inert` while modal open.

2. **Focus Management**:
   - On open: Focus moves to declared target or first focusable element inside panel.
   - On close: Focus restores to opening trigger.

3. **Dismissal**:
   - Under `dismissable: true`: `Escape` or outside click initiates dismissal.
   - Dispatches cancelable `cancel` event, and `close` event after `open = false`.
