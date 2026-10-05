# Option Specification

An option is a selectable item in a select or combobox popup.

- **Role**: `option`
- **WAI-ARIA Role**: `option`

---

## The Three Semantic Layers

| Context           | HTML Semantic                                                            | WAI-ARIA Semantic                                                                                                                                                                                                                   | Aria Package Semantic Contract                                                                                                                                   |
|:------------------|:-------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Native Option** | Native `<option>` element inside `<select>`. Handles selection natively. | Implicit `role="option"`. Attribute omitted.                                                                                                                                                                                        | Native `value`, `selected`, `disabled` reflect the contract; `label` reflects an explicitly declared label. No redundant role or selected ARIA state is emitted. |
| **Custom Option** | Non-native element (`<div>` or `<li>`).                                  | `role="option"`, `aria-selected` (`"true"` \| `"false"`), `aria-label` (explicit label), `aria-disabled="true"`, `id`; excluded from sequential focus — the active option is published through the group's `aria-activedescendant`. | Choice member: `this.props.value`. Derives `selected` from enclosing `select`/`listbox` group.                                                                   |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `OptionOptions`

```ts
export interface OptionOptions {
  /** Whether bound to native <option> (default: false) */
  native?: boolean;
  /** Whether pointer activation inverts a standalone selection (default: false, select-only) */
  toggle?: boolean;
}
```

#### `OptionProps<T extends Primitive = Primitive>`

```ts
export interface OptionProps<T extends Primitive = Primitive> {
  /** Choice candidate value matching group active value (unique within the group) */
  value: T;
  /** Option name used for accessible naming and typeahead (default: the option's text content) */
  label?: string;
  /** Local selected hint in standalone mode only; grouped options always derive from ambient group value */
  selected?: boolean;
  /** Disabled state */
  disabled?: boolean;
}
```

### 2. Overload Contract

```ts
// Option: Selectable select/combobox choice member
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'option',
  props: OptionProps<T>,
  options?: OptionOptions
): OptionAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`selected`)**:
  - **Single Selection**: Evaluates `this.group.value === this.props.value`.
  - **Multiple Selection**: Evaluates `Boolean(this.group.value?.includes(this.props.value))`.
  - **Standalone**: Evaluates `Boolean(this.props.selected)`.
  - **Setter**: Invokes group selection assignment.

2. **Activation**:
  - Single: Assigns `this.group.value = this.props.value`. Re-activating the holder of an optional registry
    deselects (the slot clears); a `required` registry refuses the deselection and the holder keeps it. The popup
    case commits the highlighted value and closes (`select.md:35`).
  - Multiple: Toggles `this.props.value` in `this.group.value` array. Adding a value does not create duplicates.
  - Standalone: Activation selects. Inversion of a selected standalone option requires the `toggle` opt-in;
    without it standalone activation is select-only. Grouped members always follow group rules.
  - Keyboard: A member owns no keystroke — `Enter`, arrows, `Home`/`End`, letters, and full `Space` presses are
    all inert on the member (`!event.defaultPrevented` throughout). Traversal and typeahead belong to the
    enclosing popup, which commits through pointer-equivalent paths.
  - `required` expresses a selection constraint only and never auto-selects (`listbox.md:34`).

3. **Claiming**: A member hint (`selected: true`) claims an empty registry, and a `required` registry is claimed
  by the first member that mounts. Emptiness is value-based (`group.value === undefined`), not key-based — a
  declared-but-empty slot is still claimable. Idempotency alone never claims: a member without a hint in a
  non-required empty group stays unselected (radio parity).

4. **Native Host Reflection**: Native `<option>` hosts omit `role`, `tabindex`, and `aria-selected` and sync the
  `selected` IDL property instead (content-attribute reflection plus direct property assignment, mirroring the
  checkbox `checked` path). No ARIA mirror is ever emitted on the native branch.

5. **Shielding & Identity**: `id` (container linkage address), `aria-selected`, and `aria-disabled` are shielded
  from consumer `.refine()` overrides; `value` joins `ownKeys` so rest-spreads never leak the candidate token to
  the DOM. Member addresses are stable across activation and refiners.

> `label` is declared on `OptionProps` for accessible naming but has no test coverage yet; it is deferred, not
> contracted, until a RED demands it.
