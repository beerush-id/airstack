# Switch Specification

The binary on/off toggle entry unit. Guarantees identical toggle activation, focus, and state reflection across native
`<button>` hosts and custom elements.

- **Role**: `switch`
- **WAI-ARIA Role**: `switch`

> Amended 2026-10-06 (tests win): the prior revision named the state prop `on`, forbade `Enter` activation, described
> a checkbox-input native host with IDL sync, and declared the switch standalone. The locked usage tests prove
> otherwise — `checked` projection, `Enter` inverting on keydown, button-native hosts keeping ARIA mirrors, and group
> disablement cascading to members — and those behaviors are now the contract below.

---

## The Three Semantic Layers

| Context           | HTML Semantic                                                                                        | WAI-ARIA Semantic                                                                                                                             | Aria Package Semantic Contract                                                                                           |
|:------------------|:-----------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------|
| **Native Switch** | Native `<button>`. No implicit switch semantics and no native `checked` IDL to sync.                 | `role="switch"` **is emitted** and `aria-checked` is mirrored — a button carries no switch state implicitly. No synthesized `tabindex`.        | Binary toggle bound to a button; browser handles focus and key events without re-dispatch, activation arrives as click. |
| **Custom Switch** | Non-button element (`<div>`, `<span>`). No native semantics, focusability, or keyboard behavior.      | `role="switch"`, `aria-checked` (`"true"` \| `"false"`), always-explicit `aria-disabled`; `tabindex` (`0` enabled, `-1` disabled, numbers).    | Pure ARIA toggle controller. Exposes `checked` getter/setter. Polyfills pointer/`Space`/`Enter` toggling.                |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SwitchOptions`

```ts
export interface SwitchOptions {
  /** Whether bound to a native <button> host (default: false, pure ARIA) */
  native?: boolean;
}
```

#### `SwitchProps`

```ts
export interface SwitchProps {
  /** Choice candidate value when nested in a selection group */
  value?: Primitive;
  /** Semantic identity key or field name on the parent settings group */
  name?: string;
  /** Toggle state (default: false). Read/Write. */
  checked?: boolean;
  /** Disabled state (default: false) */
  disabled?: boolean;
}
```

> The Switch unit declares no selection of its own: members without a `value` never claim or coordinate group
> selection — a value-less group contributes only its `disabled` cascade. Identity keys (`name`, `value`) stay on
> props for template binding and never enter the compiled dictionary.

### 2. Overload Contract

```ts
// Switch: Binary on/off toggle (pure ARIA by default; native host is a button)
export function aria<E extends BaseElement = HTMLElement>(
  role: 'switch',
  props?: SwitchProps,
  options?: SwitchOptions
): SwitchAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`checked`)**:
  - Getter resolves `Boolean(this.props.checked)`; setter writes through the shared toggle transition.
  - Standalone (and value-less in a value-less group): the projection reads and writes `props.checked` directly —
    every activation flips it exactly once.
  - Value-declaring members coordinate through `group.value` like any other selection member. Nothing claims
    selection on a group's behalf.

2. **Activation**:
  - Pointer `click` and `Space` keyup flip `checked` (`docs/switch.md:17`). `Enter` inverts **immediately on keydown**
    (unlike checkbox — locked by usage tests, superseding `checkbox.md:20` for this role). `Space` keydown prevents
    scrolling and is repeat-safe (many keydowns, one keyup, one inversion); activation verifies
    `!event.defaultPrevented`.
  - Native button hosts add no key polyfills and never `preventDefault`: raw key events belong to the browser and
    activation arrives as the click the browser generates, inverting exactly once.
  - `disabled` blocks all state transitions and activation on every path.

3. **Native Host Reflection** (`docs/switch.md:33-35`):
  - `role="switch"` and `aria-checked` are emitted even on the native button host (no implicit switch semantics
    exist to inherit). There is no HTML switch element, so `checked` never has a native counterpart — the compiled
    dictionary carries no `checked` key on either host and no `tabindex` is synthesized on buttons.

4. **Events** (`docs/switch.md:23-28`):
  - Native host: `click`, `input`, `change` are browser-dispatched; the controller does not re-dispatch.
  - Custom host:
    - `click` — synthesized on `Space` keyup when `!event.defaultPrevented` as
      `MouseEvent('click', { bubbles: true, cancelable: true })`, so outer click listeners observe keyboard
      activation with the already-inverted projection.
    - `input` / `change` — dispatched after `checked` commits as `CustomEvent<boolean>` with `bubbles: true`,
      `detail: checked`. Canceled triggers, disabled hosts, and no-op dispatches stay silent.

5. **Disabled composition**:
  - Effective disabled is group `disabled` OR member `disabled` — registry-level lockout reaches the member without
    the member declaring anything, and lifting it hands the widget back on the same node without rebinding.
  - Disabling is never a reset: lockout keeps the declared `checked` state; custom hosts project `tabindex: -1`
    (number) with explicit `aria-disabled="true"` (tests + toggle/radio parity win over any "removed" wording).

6. **Form boundary** (`spec.md` Rule 6):
  - `.attributes` never synthesizes or emits HTML form attributes (`name`, `value`, `form`). A button-backed switch
    never becomes a form field by accident.

7. **Value plane** (`spec.md`):
  - `aria-checked` / `aria-disabled` are always explicit strings; `tabindex` is a number; `disabled` is a logical
    boolean. `checked` has no native counterpart and is never emitted as an attribute key.

8. **Teardown**:
  - `destroy()` detaches the element and ceases DOM mutations and further inversions; subsequent external
    mutations cause zero DOM side effects.
