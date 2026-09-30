# Disclosure Specification

The single show-hide unit. Coordinates trigger toggling and panel expansion across native `<details>`/`<summary>` and
custom elements.

- **Entity**: `disclosure`
- **Trigger WAI-ARIA Role**: `button`
- **Panel WAI-ARIA Role**: `region`

### Parts

- **`Disclosure`**: Container coordinator hosting ambient `expanded` and `disabled` state.
- **`DisclosureTrigger`**: Interactive button toggling panel (`aria-expanded`, `aria-controls`).
- **`DisclosurePanel`**: Collapsible content panel (`role="region"`, `aria-labelledby`, receives `hidden` when closed).

---

## The Three Semantic Layers

| Part / Role             | HTML Semantic                                      | WAI-ARIA Semantic                                                                                                                                                                                                                                                                   | Aria Package Semantic Contract                                                                  |
|:------------------------|:---------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------|
| **`Disclosure`**        | Native `<details>` or `<div>`.                     | Native disclosure mechanics pass through on `<details>`.                                                                                                                                                                                                                            | Container coordinator. Props: `DisclosureProps`.                                                |
| **`DisclosureTrigger`** | Native `<summary>`, `<button>`, or custom element. | Native `<button>`/`<summary>`: `aria-expanded`, `aria-controls`, `disabled` reflects `disabled` (no role, no `aria-disabled`). Custom: `role="button"`, `aria-expanded`, `aria-controls`, `aria-disabled="true"` when `disabled`, `tabindex="0"` enabled / removed when `disabled`. | Toggles `expanded` on click/Enter/Space when `disabled` is false and `!event.defaultPrevented`. |
| **`DisclosurePanel`**   | `<div>` or `<section>`.                            | `role="region"`, `aria-labelledby` (trigger ID).                                                                                                                                                                                                                                    | Receives `hidden` when collapsed; removed from accessibility and tab flows.                     |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `DisclosureProps`

```ts
export interface DisclosureProps {
  /** Expansion state */
  expanded?: boolean;
  disabled?: boolean;
}
```

#### `DisclosureOptions`

```ts
export interface DisclosureOptions {
  /** Whether bound to native <details> (default: false) */
  native?: boolean;
}
```

#### `DisclosureTriggerOptions`

```ts
export interface DisclosureTriggerOptions {
  /** Whether bound to native <button> or <summary> (default: true) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// Disclosure: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'disclosure',
  props?: DisclosureProps,
  options?: DisclosureOptions
): DisclosureAria<E>;

// DisclosureTrigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'disclosure-trigger',
  props?: AriaProps,
  options?: DisclosureTriggerOptions
): DisclosureTriggerAria<E>;

// DisclosurePanel
export function aria<E extends BaseElement = HTMLElement>(
  role: 'disclosure-panel',
  props?: AriaProps
): DisclosurePanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Activation**:
  - Trigger toggles `expanded` when `disabled` is false and `!event.defaultPrevented` (`docs/disclosure.md:16`). Pointer
    `click`, `Enter`, and `Space` (with `preventDefault()` on `Space` to prevent scroll) toggle `expanded`.
  - `disabled` blocks activation and state change; it reaches the trigger per host: `disabled` property on a native
    `<button>`/`<summary>`, `aria-disabled="true"` on a custom trigger.
  - Native `<details>` synchronizes `open` attribute natively.
2. **Events** (`docs/disclosure.md:20-24`):
  - `toggle` — native `<details>`: browser-dispatched, controller listens and does not re-dispatch. Custom: dispatched
    **on the Disclosure container** after `expanded` commits as
    `CustomEvent<boolean>('toggle', { bubbles: false, detail: expanded })`.
