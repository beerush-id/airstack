# Stepper Specification

The stepped numeric entry unit: one shared number adjusted by step buttons, stepping keys, and free typing.

- **Entity**: `stepper` (container; the numeric field part is sheeted as `number-stepper` / `stepper-input`)
- **Input WAI-ARIA Role**: `spinbutton` on a custom host; a native host is a text input the controller parses
- **Container WAI-ARIA Role**: `group`

### Parts (Entity Tree)

- **`Stepper`**: Container coordinator (`role="group"`); owns value, bounds, increments, stepping keys, and events.
- **`StepperInput`**: The value's field; `type="text"` on a native host, plaintext `contenteditable` on a custom host.
- **`StepperIncrement` / `StepperDecrement`**: Step buttons; Button contract; disarmed at their bound.

---

## The Three Semantic Layers

| Part / Role                                 | HTML Semantic                                     | WAI-ARIA Semantic                                                                             | Aria Package Semantic Contract                        |
|:--------------------------------------------|:--------------------------------------------------|:----------------------------------------------------------------------------------------------|:------------------------------------------------------|
| **`Stepper`**                               | Container (`<div>`).                              | `role="group"`.                                                                               | Value, bounds, increments, keys, events.              |
| **`StepperInput`**                          | Native text input or custom host.                 | `role="spinbutton"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`.     | Value entry and display as real, selectable text.     |
| **`StepperIncrement` / `StepperDecrement`** | Native `<button type="button">`, `tabindex="-1"`. | Button contract.                                                                              | Auxiliary step triggers with automatic disarming.     |

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
  /** Whether bound to a native input element (default: false) */
  native?: boolean;
}
```

### 2. Overload Contracts

```ts
// Stepper: Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'stepper',
  props?: StepperProps
): StepperAria<E>;

// StepperInput
export function aria<E extends BaseElement = HTMLInputElement>(
  role: 'stepper-input' | 'number-stepper',
  props?: StepperInputProps,
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
   - Step buttons disarm at their own bound, on container `disabled`, and on container `readonly`.
   - Step buttons carry `tabindex="-1"`; the field is the tab stop.
   - Writes clamp to declared bounds; an undeclared bound clamps nothing in its direction.
2. **Keyboard** (owned by the container; keys reach it from any part):
   - `ArrowUp` / `ArrowDown`: step by `step`, consumed.
   - `PageUp` / `PageDown`: step by `page`, consumed.
   - `Home` / `End`: jump to `min` / `max`, consumed; left to the user when that bound is undeclared.
   - Every other key, `ArrowLeft` and `ArrowRight` included: left to the user, unconsumed, no step.
   - `Enter` and `Space` on the field: prevented, no step.
3. **Typing**:
   - Both hosts accept free text; each `input` reading parses as a strict decimal.
   - A valid reading commits through the bounds; an invalid reading keeps the current value.
   - `blur` commits a valid reading, else restores the last committed value to the field; `blur` emits no event.
   - Custom host: keyboard focus selects the contents; programmatic text writes preserve the selection.
4. **Events** (emitted on the stepper: container DOM `CustomEvent` and its `on*` props; a typed keystroke emits
   `input` on the field part's `oninput`, handler-only):
   - `input`: per active interaction — key step, button step, typed keystroke; `detail` is the value at that moment.
   - `change`: per actual value change from any path; `detail` is the committed number.
5. **Readonly**: steps and typing refused; stepping keys unconsumed; field carries `tabindex="-1"` and stays
   focusable; step buttons disarm.
6. **Disabled**: no activation and no stepping; field carries `tabindex="-1"` and `aria-disabled="true"`; an
   activation click on a disarmed part is cancelled and stopped from bubbling.
7. **Required**: native host sets its own `required` property; custom host sets `aria-required`; no cross-host
   mirror.
