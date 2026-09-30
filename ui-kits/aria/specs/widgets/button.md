# Button Specification

A button is an interactive action widget that enables users to trigger a discrete action or event.

- **Role**: `button`
- **WAI-ARIA Role**: `button`

---

## The Three Semantic Layers

| Context           | HTML Semantic                                                                                  | WAI-ARIA Semantic                                                                 | Aria Package Semantic Contract                                            |
|:------------------|:-----------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------|:--------------------------------------------------------------------------|
| **Native Button** | Native `<button type="button">`. Handles click, Space/Enter activation, and native `disabled`. | Implicit `role="button"`. Explicit `role` omitted.                                | Action trigger. Forwards click events to consumer listeners.              |
| **Custom Button** | Non-semantic element (`<div>`, `<span>`).                                                      | `role="button"`; `tabindex="0"` when enabled, `tabindex` removed when `disabled`. | Polyfills Space/Enter key activation and compiles ARIA button attributes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `ButtonOptions`

```ts
export interface ButtonOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `ButtonProps`

```ts
export interface ButtonProps {
  /** Button behavior type (default: 'button') */
  type?: 'button' | 'submit' | 'reset';
  /** Disabled state */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Button: Action trigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'button',
  props?: ButtonProps,
  options?: ButtonOptions
): ButtonAria<E>;
```

---

## State & Lifecycle Rules

1. **Type Attribute Default**:

- When `native: true`, compiles `type="button"` by default (unless specified via `props.type`) to prevent implicit
  form submission.

2. **Form Mechanics**:

- `type="submit"` requests submission on the ancestor form; `type="reset"` requests reset on the ancestor form.
- On a custom host the controller synthesizes the activation `click` (bubbles, cancelable); a canceled synthesized
  click aborts form submission/reset.

3. **Action Trigger**:

- Forwards DOM click events directly to consumer listeners.
- Activation is blocked if the initiating event was canceled (`defaultPrevented`).

4. **Disabled Inertness**:

- `disabled` blocks all activation paths (including pointer clicks), focus entry, and form mechanics.

5. **Keyboard Polyfill (`!native`)**:

- `Space`: Prevents the default viewport scroll and triggers click on keyup.
- `Enter`: Triggers click on keydown, **without canceling the event's default** — Enter has no harmful browser default on a custom host, so `preventDefault()` is not applied (only Space's scroll is prevented, per `docs/button.md:18`).
