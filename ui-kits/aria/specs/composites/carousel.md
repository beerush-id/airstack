# Carousel Specification

The sequential-slide coordinator unit. Hosts the current slide, coordinates navigation and optional timed rotation, and
keeps inactive slide content out of focus and accessibility flows.

- **Entity**: `carousel`
- **Container WAI-ARIA Role**: `region` with `aria-roledescription="carousel"`
- **Slide WAI-ARIA Role**: `group` with `aria-roledescription="carousel-slide"`

### Composite Parts (Entity Tree)

- **`Carousel`**: Container coordinator (`role="region"`, `aria-roledescription="carousel"`, `aria-label`).
- **`CarouselViewport`**: Scroll/focus viewport (`role="group"`, `aria-roledescription="carousel-slides"`,
  `tabindex="0"`, `aria-live`, `aria-atomic="false"`, stable `id` derived from container namespace).
- **`CarouselSlide`**: Slide member (`role="group"`, `aria-roledescription="carousel-slide"`, `hidden` when inactive,
  `tabindex="-1"`, `aria-current` when current, `aria-labelledby` → paired picker).
- **`CarouselNav`**: Step button used twice (Button contract, `aria-controls` → **viewport ID**, `direction` prop `-1` back / `1`
  forward, `aria-label` "Previous slide"/"Next slide", `aria-roledescription` `carousel-prev`/`carousel-next` derived from
  `direction`).
- **`CarouselPicker`**: Slide indicator button (`aria-controls` → paired slide ID, `aria-label` = target slide label,
  `aria-current="true"` only when current, `aria-roledescription="carousel-indicator"`).
- **`CarouselPlayer`**: Play/pause autoplay button (`aria-controls` → viewport; `aria-label` = **"Stop slide
  rotation"** when `autoplay`, **"Start slide rotation"** when stopped). Its state reaches AT
  through the label swap, not `aria-pressed`.

---

## The Three Semantic Layers

| Part / Role            | HTML Semantic                       | WAI-ARIA Semantic                                                 | Aria Package Semantic Contract                                    |
|:-----------------------|:------------------------------------|:------------------------------------------------------------------|:------------------------------------------------------------------|
| **`Carousel`**         | Container (`<div>` or `<section>`). | `role="region"`, `aria-roledescription="carousel"`, `aria-label`. | Hosts `value`, `keys`, `loop`, `autoplay`, `playing`, `interval`, `arrowNav`. Coordinates timer. |
| **`CarouselViewport`** | Container (`<div>`).                | `role="group"`, `aria-roledescription="carousel-slides"`, `tabindex="0"`, `aria-live="off"` (playing) / `"polite"` (idle), `aria-atomic="false"`. | Focusable viewport with arrow navigation. |
| **`CarouselSlide`**    | Item container (`<div>` or `<li>`). | `role="group"`, `aria-roledescription="carousel-slide"`, `aria-labelledby` → picker, `aria-current` when current. | Hidden when inactive.                                             |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `CarouselProps`

```ts
export interface CarouselProps {
  /** Namespace the viewport identity is derived from; generated as `carousel-<n>` when omitted */
  id?: string;
  /** Ordered slide keys driving total, last, and current */
  keys?: string[];
  /** Current slide identifier */
  value?: string;
  /** Wrap navigation between first and last slide */
  loop?: boolean;
  /** Whether rotation is currently playing (set by the timer coordinator) */
  playing?: boolean;
  /** Auto-advance flag */
  autoplay?: boolean;
  /** Delay in milliseconds between advances (default: 5000) */
  interval?: number;
  /** Disable arrow-key traversal when `false` */
  arrowNav?: boolean;
  /** Group disabled cascade */
  disabled?: boolean;
  /** Accessible name */
  label: string;
  /** Called with the committed slide value after the slide advances */
  onchange?: AriaEventHandler<CarouselChangeEvent>;
  /** Called with the autoplay value after rotation starts or stops */
  ontoggle?: AriaEventHandler<CarouselToggleEvent>;
}
```

#### `CarouselSlideProps`

```ts
export interface CarouselSlideProps {
  /** Semantic identity matching the paired picker `name` */
  name: string;
  /** Explicit DOM identifier overriding automatic pair derivation */
  id?: string;
}
```

#### `CarouselPickerProps`

```ts
export interface CarouselPickerProps {
  /** Semantic identity matching the paired slide `name` */
  name: string;
  /** Accessible name of the indicator, naming its target slide */
  label: string;
  /** Explicit DOM identifier overriding automatic pair derivation */
  id?: string;
  /** Initial selection hint when the group is uncontrolled */
  selected?: boolean;
  /** Whether this indicator is disabled */
  disabled?: boolean;
}
```

#### `CarouselNavProps`

```ts
export interface CarouselNavProps {
  /** Accessible name, e.g. "Previous slide" / "Next slide" */
  label?: string;
  /** Stepping direction carried by props: `1` forward, `-1` backward */
  direction: 1 | -1;
}
```

#### `CarouselPlayerProps`

```ts
export interface CarouselPlayerProps {
  /** Label while stopped */
  label?: string;
  /** Label while `autoplay` is on */
  playingLabel?: string;
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

// CarouselNav (one role; direction carried by props)
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'carousel-nav',
  props: CarouselNavProps
): CarouselNavAria<E>;

// CarouselPicker
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'carousel-picker',
  props: CarouselPickerProps
): CarouselPickerAria<E>;

// CarouselPlayer
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'carousel-player',
  props?: CarouselPlayerProps
): CarouselPlayerAria<E>;
```

---

## State & Lifecycle Rules

1. **Timer & Pause**:
  - The container owns the timer. `autoplay` drives `playing` through the mount/value coordinator: setting
    `autoplay` restarts or parks the countdown, manual navigation restarts the countdown, reaching the last slide
    without `loop` commits `autoplay = false`.
  - Pointer enter / focusin sets `autoplay = false` and emits `toggle` with `false`; pointer leave / focusout
    restores the prior `autoplay` and emits `toggle` with the restored value. Hover therefore pauses audibly through
    the same toggle path as the player; focus stopping rotation is the same mechanism.
  - The viewport holds `aria-live="off"` while `playing`, `"polite"` while idle, always with `aria-atomic="false"`.
2. **Keyboard Traversal**:
  - Container-level delegation: `Left` / `Right` activate prev / next slide; `Home` / `End` activate first / last slide.
    Traversal honors `loop` at the ends and is disabled when `arrowNav === false`. Focus stays on the invoking control;
    selection follows the indicator order.
3. **Events**:
  - `change` — Dispatched on container on slide advance with `detail: value`.
  - `toggle` — Dispatched on container on autoplay state change with `detail: autoplay`. Pointer and focus pauses
    emit through this path; resume emits the restored value.
  - `onchange` / `ontoggle` props receive the same events captured at the container.
4. **Value & Control Availability**:
  - Exactly one indicator is current; the shared `value` is claimed by the first mounted indicator when absent, so an
    absent value resolves to the first slide. An empty carousel (fewer than one key) holds `undefined` and rotation stops.
  - `loop: false` (default): Previous disabled at the first slide, Next at the last; reaching the last by timer commits
    `autoplay = false` and emits `toggle` with `false`. Fewer than two slides disables Previous, Next, and Player.
    Group `disabled` cascades into nav and player lockout.
  - Inactive slides carry `hidden` without `inert`; the current slide carries `aria-current` and is labelled by its picker.
  - No automatic focus relocation on slide removal or deactivation is provided; focus management beyond viewport focus
    and arrow traversal is consumer land.
