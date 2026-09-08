# Spinbutton Specification

A spinbutton is a form widget for inputting a numeric value from a range of discrete values, allowing users to increment or decrement the value using stepper controls or keyboard arrow keys.

- **Role**: `spinbutton`
- **WAI-ARIA Role**: `spinbutton`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Stepper** | Native `<input type="number">`. Built-in stepper controls and validation. | Implicit `role="spinbutton"`. Omitted if native. | Form input synchronization and native event forwarding. |
| **Custom Spinbutton** | Custom input/stepper container (`<div>`). | `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `tabindex="0"`. | Value stepper controller (`this.value: number`). Polyfills Arrow keys and Home/End. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SpinbuttonOptions`
```ts
export interface SpinbuttonOptions {
  /** Whether bound to native <input type="number"> (default: false) */
  native?: boolean;
}
```

#### `SpinbuttonProps`
```ts
export interface SpinbuttonProps {
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
// Spinbutton: Discrete numeric stepper
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'spinbutton',
  props?: SpinbuttonProps,
  options?: SpinbuttonOptions
): SpinbuttonAria<E>;
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
