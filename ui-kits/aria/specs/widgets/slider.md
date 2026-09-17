# Slider Specification

The bounded numeric entry unit. Guarantees stepped value clamping, keyboard stepping, pointer drag, and dual-thumb accessibility across single and dual-thumb range configurations.

- **Entity**: `slider`
- **WAI-ARIA Role**: `slider` (on thumbs; omitted on native `<input type="range">`), `role="group"` on track for dual-thumb

### Parts (Entity Tree)
- **`Slider`**: Track container coordinator (compiles `role="group"` when dual-thumb).
- **`SliderThumb`**: Value point thumb (`role="slider"`, `tabindex="0"`). Exactly one thumb for `value: number`; low and high thumbs for `value: [number, number]`.

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native `<input type="range">`** | Native range input. | Implicit `role="slider"`. Role omitted. | Form input synchronization and native event forwarding. |
| **Custom Slider** | Custom thumb/track element (`<div>`). | `role="slider"` on thumbs, `role="group"` on dual-thumb track, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-orientation`, `tabindex="0"`. | Value range controller (`value: number \| [number, number]`). Stepping, dragging, and bounds enforcement. |

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
  /** Current numeric value or dual-thumb tuple */
  value?: number | [number, number];
  orientation?: 'horizontal' | 'vertical';
  min?: number;
  max?: number;
  step?: number;
  page?: number;
  valuetext?: string | ((val: number) => string);
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Slider: Track container or single slider
export function aria<E extends BaseElement = HTMLElement>(
  role: 'slider',
  props?: SliderProps,
  options?: SliderOptions
): SliderAria<E>;

// SliderThumb
export function aria<E extends BaseElement = HTMLElement>(
  role: 'slider-thumb',
  props?: AriaProps
): SliderThumbAria<E>;
```

---

## State & Lifecycle Rules

1. **Bounds & Clamping**:
   - Single numeric `value` clamped to `[min, max]` snapped to `step`.
   - Dual-thumb tuple enforces `low <= high`.
   - Both thumbs hold `tabindex="0"` when enabled.

2. **Keyboard Stepping**:
   - `Right` / `Up`: Increments by `step`.
   - `Left` / `Down`: Decrements by `step`.
   - `PageUp` / `PageDown`: Steps by `page` (default: 10).
   - `Home` / `End`: Bounds `min` / `max`.

3. **Events**:
   - `input` — Dispatched during interaction with `detail: value`.
   - `change` — Dispatched on drag end / keyboard commit with `detail: value`.
