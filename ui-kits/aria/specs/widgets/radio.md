# Radio Specification

A radio is a checkable input in a group of mutually exclusive options, where selecting one radio button deselects any
previously selected button in the same group.

- **Role**: `radio`
- **WAI-ARIA Role**: `radio`

---

## The Three Semantic Layers

| Part / Role      | HTML Semantic                                                                                                                                                        | WAI-ARIA Semantic                                                                                            | Aria Package Semantic Contract                                                                                                |
|:-----------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------|
| **Native Radio** | Native `<input type="radio">`. Participates in native form submission (`name`, `value`, `checked`). Mutually exclusive selection handled by native `name` attribute. | Implicit `role="radio"`. Attribute omitted.                                                                  | Syncs native `.checked` property. Forwards change events to group.                                                            |
| **Custom Radio** | Non-native element (`<div>`, `<span>`). No native form participation or keyboard behavior.                                                                           | `role="radio"`, `aria-checked` (`"true"` \| `"false"`), roving `tabindex` (`0` if active, `-1` if inactive). | Group choice member (`this.props.value`). Polyfills Space key activation, manages active focus, and compiles ARIA attributes. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `RadioOptions`

```ts
export interface RadioOptions {
  /** Whether bound to native <input type="radio"> (default: true) */
  native?: boolean;
}
```

#### `RadioProps<T extends Primitive = Primitive>`

```ts
export interface RadioProps<T extends Primitive = Primitive> {
  /** Choice candidate value matching parent group value */
  value?: T;
  /** Native HTML form field name pass-through */
  name?: string;
  /** Explicit checked state when standalone */
  checked?: boolean;
  /** Disabled state */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Radio: Mutually exclusive choice member (standalone, or radiogroup member with `value`)
export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'radio',
  props?: RadioProps<T>,
  options?: RadioOptions
): RadioAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`checked`)**:
  - **Getter** (member): `this.group.value === this.props.value`.
  - **Setter is select-only**: `radio.checked = true` commits `this.group.value = this.props.value`. `radio.checked = false` is a **no-op** — a radio never deselects through itself (`docs/radio-group.md:30-31`: Space over the checked radio commits nothing). The slot only moves when the group value changes or another radio selects. This is what makes a swallowed `.checked = false` write a non-discriminating teardown proof; disposal is proven by mutating `group.value` / `assign()`, not by writing `checked`.

2. **Activation**:
  - Radio buttons are never toggleable: clicking or pressing Space on an already selected radio never deselects it, even when the group is not required. The group may still start empty (`value: null`).
  - **Arrows commit selection** (`docs/radio-group.md:26`): `Right`/`Down` and `Left`/`Up` move focus to the next/previous enabled radio **and select it in one transition**, wrapping and skipping disabled. There is **no `manual` mode** for radios.
  - **Member vs group split**: arrow/Home/End/Enter handling belongs to the group container, not the member. A `radio` member is inert to `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`/`Home`/`End` (no `defaultPrevented`, no state commit) and `Enter` is not a radio affordance. The member owns Space only: custom hosts `preventDefault` on Space keydown (scroll suppression, no commit) and commit on Space keyup; native hosts delegate keyboard to the browser (no synthetic `preventDefault`).

3. **Standalone projection**:
  - Without an ambient group, the getter derives from `props.checked` (`radio.checked === props.checked === true`).
  - The setter stays select-only in both modes: `radio.checked = true` commits selection (`group.value = props.value` when grouped, checked when standalone); `radio.checked = false` through the projection is a **no-op**. External writes use `assign()` / direct props mutation, which is also the teardown proof path alongside `group.value` mutation.
  - `deselect()` through the member never clears the slot; the slot only moves when `group.value` changes or another radio selects.

4. **Disabled composition**:
  - Effective disabled is group `disabled` OR member `disabled`.
  - Native hosts project `disabled` as a boolean and omit `tabindex` / `aria-disabled`; activation is rejected and committed state never changes.
  - Custom hosts project `tabindex: -1` (number) and `aria-disabled: "true"` while disabled, block click and full Space presses from reaching the registry, and re-arm on the same node when disabled clears (reachability + activation restore without rebinding).
  - A member disabled while holding the selection keeps the group value but cannot be re-activated; an enabled sibling can still take the slot because exclusivity outranks the hold.

5. **Roving tabindex (custom)**:
  - Selected member `tabindex: 0`, unselected `tabindex: -1`, any disabled member `-1` — always numbers in `.attributes`, recomputed on every `group.value` / disabled change.

6. **Form boundary** (`spec.md` Rule 6):
  - `.attributes` never synthesizes or emits HTML form attributes (`name`, `value`, `form`). Identity keys stay on props for template binding (`<input {...radio.attributes} name={props.name} value={props.value} />`); the derived selection is the single submitted value through the author binding.

7. **Value plane** (`spec.md`):
  - `aria-checked` is always an explicit string (`"true"` | `"false"`); `tabindex` is a number; `disabled` / `checked` are logical booleans (present `false` is correct — the host/adapter decides serialization).

8. **Teardown**:
  - `destroy()` detaches the element and ceases DOM mutations; subsequent `group.value` / `assign()` mutations cause zero DOM side effects. Swallowed `.checked = false` writes after destroy are non-discriminating proof — disposal is proven by registry mutation, not by projection writes.
