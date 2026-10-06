# Slider Specification

The bounded numeric entry unit. Guarantees stepped value clamping, keyboard stepping, pointer drag, and dual-thumb
accessibility across single and dual-thumb range configurations.

- **Entity**: `slider`
- **WAI-ARIA Role**: `slider` (on the track for single values, on thumbs for dual-thumb tuples; omitted on
  native `<input type="range">`), `role="group"` on track for dual-thumb

### Parts (Entity Tree)

- **`Slider`**: Track container coordinator (compiles `role="group"` when dual-thumb).
- **`SliderThumb`**: Value point thumb. Exactly one visual handle for `value: number`; low and
  high `role="slider"` thumbs for `value: [number, number]`.

---

## The Three Semantic Layers

| Context                           | HTML Semantic                         | WAI-ARIA Semantic                                                                                                                                                       | Aria Package Semantic Contract                                                                            |
|:----------------------------------|:--------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------|
| **Native `<input type="range">`** | Native range input.                   | Implicit `role="slider"`. Role omitted.                                                                                                                                 | Form input synchronization and native event forwarding.                                                   |
| **Custom Slider**                 | Custom thumb/track element (`<div>`). | `role="slider"` on the single-value track and on each dual thumb, `role="group"` on dual-thumb track, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-orientation`, `tabindex="0"`. | Value range controller (`value: number \| [number, number]`). Stepping, dragging, and bounds enforcement. |

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
  value?: number | [ number, number ];
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
  - Dual-thumb tuple enforces `low <= high`; each thumb's range bounds are tightened against the other — low thumb's
    `aria-valuemax` is the current `high`, high thumb's `aria-valuemin` is the current `low` (`docs/slider.md:22,49`).
  - The single-value track carries the slider semantics (`tabindex="0"`, value announcements); dual thumbs each
    carry their own (dual-thumb reachability). `tabindex` resolves to `-1` with `aria-disabled="true"` when
    `disabled`. `disabled` blocks all stepping and drag.

2. **Keyboard Stepping** (handled on the track for single values, per thumb for dual tuples):
  - `Right` / `Up`: Increments by `step`.
  - `Left` / `Down`: Decrements by `step`.
  - `PageUp` / `PageDown`: Steps by `page` (value units, not a `step` multiplier; default 10).
  - `Home` / `End`: Bounds `min` / `max`.

3. **Pointer Drag** (`docs/slider.md:29`): dragging a thumb tracks stepped values continuously.

4. **Position Publication**: each thumb publishes its committed endpoint as the `--aria-slider-thumb-offset`
   custom property (percentage string along `[min, max]`, e.g. `30%`) in its compiled `style`. Single thumbs
   publish their value; dual thumbs publish their own endpoint independently. Stylesheets position thumbs purely
   in CSS (`left: var(--aria-slider-thumb-offset)` horizontally, `bottom: var(--aria-slider-thumb-offset)`
   vertically). There is no JavaScript positioning: consumers never compute ratios.

5. **Track Press**: pressing the track computes the pressed ratio from pointer coordinates and commits the
   nearest endpoint by value — no thumb required. Single values move; dual tuples move the closer endpoint
   with ties resolving to low. `input`/`change` dispatch on the track, and a drag session opens so
   press-then-drag works continuously. Presses starting on a thumb belong to the thumb. Disabled blocks;
   native hosts defer to the browser.

6. **Events** (`docs/slider.md:32-35`): dispatched on the **interacting element** — the track for track presses
   and single-value keys, the thumb for thumb drags and dual-thumb keys —
   `CustomEvent<number | [number, number]>` with `bubbles: true`, `detail: value`.
  - `input` — after each committed step during interaction.
  - `change` — after interaction ends with a committed value.
