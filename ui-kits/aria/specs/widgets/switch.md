# Switch Specification

The binary on/off toggle entry unit. Guarantees identical toggle activation, focus, and state reflection across native
`<input type="checkbox" role="switch">` and custom elements.

- **Role**: `switch`
- **WAI-ARIA Role**: `switch`

---

## The Three Semantic Layers

| Context           | HTML Semantic                                         | WAI-ARIA Semantic                                                                                                                                                                        | Aria Package Semantic Contract                                                                                  |
|:------------------|:------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------|
| **Native Switch** | Native `<input type="checkbox" role="switch">`.       | `role="switch"` **is emitted** (a checkbox carries no switch semantics implicitly). Native `checked` reflects `on`. `disabled`/`required` sync native properties. No ARIA state mirrors. | Binary toggle bound to a checkbox input; browser handles activation, focus, and key events without re-dispatch. |
| **Custom Switch** | Non-checkbox element (`<div>`, `<span>`, `<button>`). | `role="switch"`, `aria-checked` (`"true"` \| `"false"`), `aria-required`, `aria-disabled="true"` when `disabled`; `tabindex="0"` when enabled, `tabindex` removed when `disabled`.       | Pure ARIA toggle controller. Exposes `this.on` getter/setter. Polyfills pointer/`Space` toggle.                 |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SwitchOptions`

```ts
export interface SwitchOptions {
  /** Whether bound to native <input type="checkbox" role="switch"> (default: false, pure ARIA) */
  native?: boolean;
}
```

#### `SwitchProps`

```ts
export interface SwitchProps {
  /** Toggle state (default: false). Read/Write. */
  on?: boolean;
  /** Disabled state (default: false) */
  disabled?: boolean;
  /** Requirement flag (default: false) */
  required?: boolean;
}
```

> The Switch unit is standalone. Its state prop is `on`, not `checked`; it carries no `value`/`name` group-membership props.

### 2. Overload Contract

```ts
// Switch: Binary on/off toggle (pure ARIA by default; native host is a checkbox input)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'switch',
  props?: SwitchProps,
  options?: SwitchOptions
): SwitchAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`on`)**:
  - Getter resolves `Boolean(this.props.on)`; setter writes `this.props.on`. There is no group term — the switch is
    standalone.

2. **Activation**:
  - Pointer `click` and `Space` keyup flip `on` (`docs/switch.md:17`). `Enter` does **not** toggle (matches
    `checkbox.md:20`). `Space` keydown prevents scrolling; activation verifies `!event.defaultPrevented`.
  - `disabled` blocks all state transitions and activation.

3. **Native Host Reflection** (`docs/switch.md:33-35`):
  - `role="switch"` is emitted even on the native checkbox host (no implicit switch role exists to inherit).
  - Native `checked` reflects `on`; `disabled` and `required` sync native properties. No ARIA state mirrors on the
    native branch.

4. **Events** (`docs/switch.md:23-28`):
  - Native host: `click`, `input`, `change` are browser-dispatched; the controller does not re-dispatch.
  - Custom host:
    - `click` — synthesized on `Space` keyup when `!event.defaultPrevented` as
      `MouseEvent('click', { bubbles: true, cancelable: true })`.
    - `input` / `change` — dispatched after `on` commits as `CustomEvent<boolean>` with `bubbles: true`, `detail: on`.
