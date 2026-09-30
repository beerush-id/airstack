# Radio Group Specification

A radio group is a set of checkable buttons (radios) of which no more than one may be checked at a time. It enforces
mutually exclusive single selection and handles Arrow key roving focus.

### Composite Parts (Entity Tree)

- **`RadioGroup`**: Single-selection group entity (compiles WAI-ARIA `role="radiogroup"`)
- **`Radio`**: Selectable option entity (compiles WAI-ARIA `role="radio"`)

---

## The Three Semantic Layers

| Part / Role      | HTML Semantic                                                                                                                                                                  | WAI-ARIA Semantic                                                                                                                                                                                                   | Aria Package Semantic Contract                                                                                                                                                                                                                                      |
|:-----------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`radiogroup`** | Container (`<div>`, or `<fieldset>` — `role="radiogroup"` is **always** set; the source emits no fieldset-omission branch).                                                    | `role="radiogroup"`, `aria-required="true"` when `required`, `aria-disabled="true"` when disabled (`docs/radio-group.md:39-42`).                                                                                    | Single-selection group controller. `value` default `null`. Roving tabindex across radios; no member registry.                                                                                                                                                       |
| **`radio`**      | Native `<input type="radio">` with form participation (`name`, `value`, `checked`) — the controller writes these as native **properties**, not `.attributes` entries (Rule 6). | `role="radio"` (custom only), `aria-checked` (`"true"` \| `"false"`); roving `tabindex="0"` on the selected radio **or the first enabled radio when none is selected** (`docs/radio-group.md:48`); siblings `"-1"`. | Choice candidate `value`. Active: `group.value === value`. Activation commits `group.value = value`; **re-activating the checked radio commits nothing** (`:31`). Group may start empty (`value: null`); `required` emits `aria-required` only, never auto-selects. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `RadioGroupProps<T extends Primitive = Primitive>`

```ts
export interface RadioGroupProps<T extends Primitive = Primitive> {
  /** Optional DOM element identifier */
  id?: string;
  /** Shared native radio name; written as a native property on member inputs, never emitted in .attributes (docs/radio-group.md:12,44) */
  name?: string;
  /** Active radio value (default: null; once set, a radio never deselects through itself) */
  value?: T | null;
  /** Requirement flag → aria-required only; never auto-selects (default: false) */
  required?: boolean;
  disabled?: boolean;
}
```

> The group carries only `value`, `multiple`, `disabled` (`docs/radio-group.md:9-14`). Arrows auto-select (`:26`); the
> roving tab stop falls back to the first enabled radio when `value` is `null` (`:48`). Validity is a Field concern.

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
  value: T;
  /** Native HTML form field name pass-through (does not affect group matching) */
  name?: string;
  /** Initial checked hint when uncontrolled */
  checked?: boolean;
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// RadioGroup: Container group controller (single-only, no options)
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'radio-group',
  props?: RadioGroupProps<T>
): RadioGroupAria<E>;

// Radio: Radio button member
export function aria<E extends BaseElement = HTMLInputElement, T extends Primitive = Primitive>(
  role: 'radio',
  props: RadioProps<T>,
  options?: RadioOptions
): RadioAria<E>;
```

---

## State & Lifecycle Rules

1. **Active Check**:
   ```ts
   const isChecked = this.group.value === this.props.value;
   ```

2. **Activation** (`docs/radio-group.md:30`):
  - Activation flows from `click` or `Space` on an unchecked focused radio; it sets
    `this.group.value = this.props.value`. **`Enter` commits nothing** (the source's activation list is click/Space
    only, matching checkbox).
  - Re-activating an already checked radio is idempotent (radio buttons cannot be unchecked by clicking them again).

3. **Keyboard Navigation** (`docs/radio-group.md:26-27`):
  - `Right` / `Down` move focus to the next enabled radio **and commit selection in one transition**; `Left` / `Up` do
    the same for the previous. Navigation wraps and skips disabled radios. There is **no `manual` mode** — arrows always
    select.
  - `Space` over the already-checked radio commits nothing (`:31`); over an unchecked focused radio it commits selection
    (`:30`).

4. **State Projection**: `checked` reads `this.group.value === this.props.value`; setting it writes `this.group.value`.
   Props is the single source of state.
