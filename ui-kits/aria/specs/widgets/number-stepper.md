# Number-Stepper Specification

A number-stepper is the numeric field an author holds for entering a discrete value from a range, stepping it with arrow keys or typed input.

- **Entity**: `number-stepper`
- **WAI-ARIA Role**: `spinbutton` (compiled output)

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Stepper** | Native `<input type="number">`. Built-in stepper controls and validation. | Implicit `role="spinbutton"`. Omitted if native. | Form input synchronization and native event forwarding. |
| **Custom Stepper** | Custom input/stepper container (`<div>`). | `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `tabindex="0"`. | Value stepper controller (`this.value: number`). Polyfills Arrow keys and Home/End. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `NumberStepperOptions`
```ts
export interface NumberStepperOptions {
  /** Whether bound to native <input type="number"> (default: false) */
  native?: boolean;
}
```

#### `NumberStepperProps`
```ts
export interface NumberStepperProps {
  /** Current numeric value */
  value?: number;
  /** Minimum allowable value */
  min?: number;
  /** Maximum allowable value */
  max?: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Human-readable string representation of the value */
  valuetext?: string;
  /** Readonly indicator */
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
   - Numeric getter and setter, clamped within `[min, max]` when limits are defined.

2. **Keyboard Navigation (`!native`)**:
   - `ArrowUp`: Increments value by `step`.
   - `ArrowDown`: Decrements value by `step`.
   - `PageUp`: Increments value by larger step (e.g. `10 * step`).
   - `PageDown`: Decrements value by larger step.
   - `Home`: Sets value to `min` (if defined).
   - `End`: Sets value to `max` (if defined).
