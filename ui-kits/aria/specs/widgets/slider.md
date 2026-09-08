# Slider Specification

A slider is an input widget where the user selects a numeric value from within a given range by moving an indicator or thumb along a horizontal or vertical track.

- **Role**: `slider`
- **WAI-ARIA Role**: `slider`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Slider** | Native `<input type="range">`. Native stepping, min/max constraints, and keyboard stepping. | Implicit `role="slider"`. Omitted if native. | Form input synchronization and native event forwarding. |
| **Custom Slider** | Custom thumb/track element (`<div>`). | `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-orientation`, `tabindex="0"`. | Value range controller (`this.value: number`). Polyfills Arrow keys, PageUp/PageDown, Home/End, and pointer tracking. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SliderOptions`
```ts
export interface SliderOptions {
  /** Whether bound to native <input type="range"> (default: false) */
  native?: boolean;
}
```

#### `SliderProps`
```ts
export interface SliderProps {
  /** Current numeric value */
  value?: number;
  /** Slider orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Minimum allowable value (default: 0) */
  min?: number;
  /** Maximum allowable value (default: 100) */
  max?: number;
  /** Granular stepping increment (default: 1) */
  step?: number;
  /** Human-readable string representation of the value */
  valuetext?: string;
  /** Disabled indicator */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Slider: Numeric range controller
export function aria<E extends BaseElement = HTMLElement>(
  role: 'slider',
  props?: SliderProps,
  options?: SliderOptions
): SliderAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`value`)**:
   - Numeric getter and setter clamped within `[min, max]` and quantized to `step`.

2. **Keyboard Navigation (`!native`)**:
   - `ArrowRight` / `ArrowUp`: Increments value by `step`.
   - `ArrowLeft` / `ArrowDown`: Decrements value by `step`.
   - `PageUp`: Increments value by larger step (e.g. `10 * step`).
   - `PageDown`: Decrements value by larger step.
   - `Home`: Sets value to `min`.
   - `End`: Sets value to `max`.
