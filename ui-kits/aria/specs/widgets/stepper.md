# Stepper Specification

The stepped numeric entry unit. Delivers coordinated numeric adjustment via step buttons, keyboard arrow/page keys, and direct digit input.

- **Entity**: `stepper` (or `number-stepper`)
- **Input WAI-ARIA Role**: `spinbutton` (on custom host; omitted on native `<input type="number">`)
- **Container WAI-ARIA Role**: `group`

### Parts (Entity Tree)
- **`Stepper`**: Container coordinator (compiles `role="group"`).
- **`StepperInput`**: Numeric input element (`min`, `max`, `step`, `value`, `readOnly`, `disabled`).
- **`StepperIncrement` / `StepperDecrement`**: Step buttons (Button contract, automatically disabled at bounds).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Stepper`** | Container (`<div>`). | `role="group"`. | Coordinates value, stepping, bounds, and button disabled states. |
| **`StepperInput`** | Native `<input type="number">` or custom host. | `role="spinbutton"` on custom host, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`. | Value entry and display. |
| **`StepperIncrement` / `StepperDecrement`** | Native `<button type="button">`. | Follows Button contract. | Step buttons with automatic disabled clamping. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `StepperProps`
```ts
export interface StepperProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  page?: number;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  valuetext?: string;
}
```

#### `StepperInputOptions`
```ts
export interface StepperInputOptions {
  /** Whether bound to native <input type="number"> (default: false) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// Stepper: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'stepper' | 'number-stepper',
  props?: StepperProps
): StepperAria<E>;

// StepperInput
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'stepper-input',
  props?: AriaProps,
  options?: StepperInputOptions
): StepperInputAria<E>;

// StepperIncrement / StepperDecrement
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'stepper-inc' | 'stepper-dec',
  props?: AriaProps
): StepperButtonAria<E>;
```

---

## State & Lifecycle Rules

1. **Stepping & Bounds**:
   - Step buttons automatically disable when value hits `min` or `max`.
   - Keyboard: `Up` / `Right` increments; `Down` / `Left` decrements; `PageUp` / `PageDown` steps by `page`; `Home` / `End` clamps to `min` / `max`.
2. **Events**:
   - `input` — Dispatched during interaction with `detail: value`.
   - `change` — Dispatched on blur following value commit with `detail: value`.
