# Confirm Specification

The blocking confirmation unit. It interrupts the workflow, presents critical information, and requires an explicit choice among the listed actions. Modal in every binding; it **suppresses outside-click and `Escape` dismissal** so the answer is deliberate.

- **Entity**: `confirm` — invoked as `aria('confirm')`.
- **Compiled WAI-ARIA role**: `alertdialog`, emitted on the panel.

### Composite Parts (Entity Tree)
- **`Confirm`**: Root container coordinator (hosts ambient `open`).
- **`ConfirmTrigger`**: Button opening the confirmation (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`).
- **`ConfirmPanel`**: Modal panel carrying `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
- **`ConfirmTitle`**: Accessible title (referenced by `aria-labelledby`).
- **`ConfirmDescription`**: Description text (referenced by `aria-describedby`).
- **`ConfirmAction`**: Confirmation button (Button contract).
- **`ConfirmCancel`**: Safe cancellation button (Button contract).

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native `<dialog>`** | Native `<dialog>` via `showModal()`. | `role="alertdialog"`, `aria-modal="true"`. | Traps focus; suppresses backdrop click and Escape dismissal. Focus lands on Cancel by default (host-independent). |
| **Custom Element** | Custom modal (`<div>`). | `role="alertdialog"` on the **Panel**, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`. | Background content receives `inert`. Focus trapped inside the panel. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ConfirmProps`
```ts
export interface ConfirmProps {
  id?: string;
  open?: boolean;
}
```

### 2. Overload Contracts

```ts
// Confirm: Container (the sole entity name; compiles role="alertdialog")
export function aria<E extends BaseElement = HTMLElement>(role: 'confirm', props?: ConfirmProps): ConfirmAria<E>;
// ConfirmTrigger
export function aria<E extends BaseElement = HTMLButtonElement>(role: 'confirm-trigger', props?: AriaProps): ConfirmTriggerAria<E>;
// ConfirmPanel — carries role="alertdialog", aria-modal, aria-labelledby, aria-describedby
export function aria<E extends BaseElement = HTMLElement>(role: 'confirm-panel', props?: AriaProps): ConfirmPanelAria<E>;
// ConfirmTitle / ConfirmDescription
export function aria<E extends BaseElement = HTMLElement>(role: 'confirm-title', props?: AriaProps): ConfirmTitleAria<E>;
export function aria<E extends BaseElement = HTMLElement>(role: 'confirm-description', props?: AriaProps): ConfirmDescriptionAria<E>;
// ConfirmAction / ConfirmCancel
export function aria<E extends BaseElement = HTMLButtonElement>(role: 'confirm-action', props?: AriaProps): ConfirmActionAria<E>;
export function aria<E extends BaseElement = HTMLButtonElement>(role: 'confirm-cancel', props?: AriaProps): ConfirmCancelAria<E>;
```

> Panel, Title, and Description overloads are required because the ARIA contract (`role="alertdialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`) lives on the **Panel**, not the container (`docs/confirm.md:32`).

---

## State & Lifecycle Rules

1. **Non-Dismissable Modal** (`docs/confirm.md:15`): outside pointer clicks and `Escape` commit nothing on both native and custom hosts — explicit action required.
2. **Safe Initial Focus** (host-independent, `docs/confirm.md:16`): on open, focus defaults to `ConfirmCancel`; `Tab` cycles within the panel; background receives `inert` (native: browser modal mechanics; custom: controller applies it).
3. **Closing**: activating `ConfirmAction` or `ConfirmCancel` commits `open = false` and restores focus to the opening trigger.
4. **Events** (`docs/confirm.md:22-24`): `close` — native `<dialog>` browser-dispatched on `dialog.close()`, not re-dispatched; custom — `CustomEvent<void>('close', { bubbles: false })` on the **Panel** after `open = false` commits (non-cancelable, so it cannot be refused).
