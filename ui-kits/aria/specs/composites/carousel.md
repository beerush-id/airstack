# Carousel Specification

The sequential-slide coordinator unit. Hosts the current slide, coordinates navigation and optional timed rotation, and
keeps inactive slide content out of focus and accessibility flows.

- **Entity**: `carousel`
- **Container WAI-ARIA Role**: `region` with `aria-roledescription="carousel"`
- **Slide WAI-ARIA Role**: `group` with `aria-roledescription="slide"`

### Composite Parts (Entity Tree)

- **`Carousel`**: Container coordinator (`role="region"`, `aria-roledescription="carousel"`, `aria-label`).
- **`CarouselViewport`**: Scroll/focus viewport (`tabindex="0"`, `aria-live`, `aria-atomic="false"`).
- **`CarouselSlide`**: Slide member (`role="group"`, `aria-roledescription="slide"`, `hidden` when inactive).
- **`CarouselPrevious` / `CarouselNext`**: Navigation buttons (Button contract, `aria-controls` → **viewport ID**
  (`:59`), `aria-label` "Previous slide"/"Next slide").
- **`CarouselPicker`**: Slide indicator/picker button (`aria-controls` → viewport, `aria-label` = target slide,
  `aria-current="true"` only when current).
- **`CarouselRotation`**: Play/pause rotation button (`aria-controls` → viewport; `aria-label` = **"Stop slide
  rotation"** when `rotating`, **"Start slide rotation"** when stopped (`docs/carousel.md:62`)). Its state reaches AT
  through the label swap, not `aria-pressed`.

---

## The Three Semantic Layers

| Part / Role            | HTML Semantic                       | WAI-ARIA Semantic                                                 | Aria Package Semantic Contract                                    |
|:-----------------------|:------------------------------------|:------------------------------------------------------------------|:------------------------------------------------------------------|
| **`Carousel`**         | Container (`<div>` or `<section>`). | `role="region"`, `aria-roledescription="carousel"`, `aria-label`. | Hosts `value`, `loop`, `rotating`, `interval`. Coordinates timer. |
| **`CarouselViewport`** | Container (`<div>`).                | `tabindex="0"`, `aria-live="off"` (rotating) / `"polite"` (idle). | Focusable viewport with arrow navigation.                         |
| **`CarouselSlide`**    | Item container (`<div>` or `<li>`). | `role="group"`, `aria-roledescription="slide"`, `aria-label`.     | Hidden when inactive.                                             |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `CarouselProps`

```ts
export interface CarouselProps {
  /** Current slide identifier */
  value?: string | null;
  /** Wrap navigation between first and last slide */
  loop?: boolean;
  /** Automatic rotation flag */
  rotating?: boolean;
  /** Delay in milliseconds between advances (default: 5000) */
  interval?: number;
  /** Accessible name */
  label: string;
}
```

#### `CarouselSlideProps`

```ts
export interface CarouselSlideProps {
  value: string;
  /** Accessible slide name; default = position and total, e.g. "2 of 5" (docs/carousel.md:20) */
  label?: string;
}
```

#### `CarouselPickerProps`

```ts
export interface CarouselPickerProps {
  value: string;
}
```

### 2. Overload Contracts

```ts
// Carousel: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'carousel',
  props: CarouselProps
): CarouselAria<E>;

// CarouselViewport
export function aria<E extends BaseElement = HTMLElement>(
  role: 'carousel-viewport',
  props?: AriaProps
): CarouselViewportAria<E>;

// CarouselSlide
export function aria<E extends BaseElement = HTMLElement>(
  role: 'carousel-slide',
  props: CarouselSlideProps
): CarouselSlideAria<E>;

// CarouselPrevious / CarouselNext
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'carousel-prev' | 'carousel-next',
  props?: AriaProps
): CarouselNavAria<E>;

// CarouselPicker
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'carousel-picker',
  props: CarouselPickerProps
): CarouselPickerAria<E>;

// CarouselRotation
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'carousel-rotation',
  props?: AriaProps
): CarouselRotationAria<E>;
```

---

## State & Lifecycle Rules

1. **Timer & Pause**:
  - Pointer enter pauses timer; pointer leave resumes if still rotating.
  - Focus entering carousel stops rotation.
2. **Keyboard Traversal**:
  - Viewport focused: `Left` / `Right` activate prev / next slide; `Home` / `End` activate first / last slide.
3. **Events**:
  - `change` — Dispatched on container on slide advance with `detail: value`.
  - `toggle` — Dispatched on container on rotation state change with `detail: rotating`. Pointer pause changes neither
    and emits nothing.
4. **Value & Control Availability** (`docs/carousel.md:29,34,37`):
  - Exactly one slide is current; an absent/unknown `value` resolves to the first slide, an empty carousel to `null`
    (rotation stops).
  - `loop: false`: Previous disabled at the first slide, Next at the last; reaching the last by timer commits
    `rotating = false`. Fewer than two slides disables Previous, Next, and Rotation.
  - If the current slide holding focus is removed or deactivated, focus moves to the **viewport**, not into
    hidden/detached content.
