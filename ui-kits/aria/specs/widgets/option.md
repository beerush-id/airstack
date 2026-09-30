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
  - Single: Assigns `this.group.value = this.props.value`. Activating an already-selected option commits nothing
    (`listbox.md:29`); the popup case commits the highlighted value and closes (`select.md:35`). There is no
    deselect-on-re-activation path for options, regardless of `required`.
  - Multiple: Toggles `this.props.value` in `this.group.value` array. Adding a value does not create duplicates.
  - `required` expresses a selection constraint only and never auto-selects (`listbox.md:34`).
