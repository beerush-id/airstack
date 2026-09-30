# Number-Stepper Specification

The numeric field part of the Stepper unit (`StepperInput`) — the element an author holds for entering a discrete value
from a range, stepping it with arrow keys or typed input. Container, step buttons, and coordination live
in [stepper.md](stepper.md).

- **Entity**: `number-stepper` (alias of the `stepper-input` part)
- **WAI-ARIA Role**: `spinbutton` (compiled output)

---

## The Three Semantic Layers

| Context            | HTML Semantic                                                             | WAI-ARIA Semantic                                                                                                                                                                                                                                | Aria Package Semantic Contract                                                                    |
|:-------------------|:--------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------|
| **Native Stepper** | Native `<input type="number">`. Built-in stepper controls and validation. | Implicit `role="spinbutton"`. Omitted on native.                                                                                                                                                                                                 | `min`, `max`, `step`, `disabled`, `readOnly`, and `required` sync native properties.              |
| **Custom Stepper** | Custom host (`<div>`, `<span>`, contenteditable field).                   | `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-disabled="true"`, `aria-readonly="true"`, `aria-required="true"` reflect state; `tabindex="0"` when enabled, `tabindex` removed when `disabled`. | Value stepper controller (`this.value: number`). Polyfills arrow/page/boundary keys and Home/End. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `NumberStepperOptions`

```ts
export interface NumberStepperOptions {
  /** Whether bound to native <input type="number"> (default: true) */
  native?: boolean;
}
```

#### `NumberStepperProps`

```ts
export interface NumberStepperProps {
  /** Current numeric value (default: min) */
  value?: number;
  /** Minimum allowable value (default: 0) */
  min?: number;
  /** Maximum allowable value (default: 100) */
  max?: number;
  /** Increment step; positive number (default: 1) */
  step?: number;
  /** Large increment step for PageUp/PageDown; positive number (default: 10) */
  page?: number;
  /** Human-readable string representation of the value */
  valuetext?: string;
  /** Read-only flag; blocks edits while keeping focusability */
  readonly?: boolean;
  /** Disabled indicator */
  disabled?: boolean;
  /** Required validation indicator */
  required?: boolean;
}
```

### 2. Overload Contract

```ts
// Number-Stepper: Discrete numeric stepper
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'number-stepper',
  props?: NumberStepperProps,
  options?: NumberStepperOptions
): NumberStepperAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`value`)**:
  - Numeric getter and setter, clamped within `[min, max]`. Defaults: `min` `0`, `max` `100`, `value` `min`.

2. **Readonly & Disabled**:
  - `disabled` and `readonly` block stepping and direct editing.
  - `readonly` keeps the element focusable; `disabled` removes the `tabindex`.
  - Programmatic writes are not blocked by `readonly` (`value` is Read/Write; the source names no exception).

3. **Keyboard Navigation (input part)**:
  - `Up` / `Right`: increment by `step`, clamped to `max`.
  - `Down` / `Left`: decrement by `step`, clamped to `min`.
  - `PageUp` / `PageDown`: step by `page`.
  - `Home`: commits `min`. `End`: commits `max`.

4. **Input Commits**:
  - Direct text input commits valid numbers snapped to `step` and clamped to bounds; non-numeric edits are rejected.
  - Step buttons follow the Button contract and disable automatically when `value` reaches `min` or `max`.

5. **Events**:
  - Native host: `input` / `change` are browser-dispatched on direct editing; when the change comes from step-button
    activation, the controller dispatches them.
  - Custom host:
    - `input` — after each committed value update, `CustomEvent<number>('input', { bubbles: true, detail: value })`.
    - `change` — on blur following value commits, `CustomEvent<number>('change', { bubbles: true, detail: value })`.
