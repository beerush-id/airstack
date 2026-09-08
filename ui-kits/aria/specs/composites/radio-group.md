# Radio Group Specification

A radio group is a set of checkable buttons (radios) of which no more than one may be checked at a time. It enforces mutually exclusive single selection and handles Arrow key roving focus.

### Composite Parts
- **`RadioGroup`**: WAI-ARIA `radiogroup`
- **`Radio`**: WAI-ARIA `radio`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`radiogroup`** | Form grouping (`<fieldset>` + `<legend>`). Participates in native form submission when children are native inputs. | `role="radiogroup"`, `aria-label` / `aria-labelledby`, `aria-required` (`"true"` \| `"false"`). | Single-only container group controller. Props: `RadioGroupProps` (no `multiple` flag; `manual` defaults `false`). Manages roving tabindex across radios. |
| **`radio`** | Native `<input type="radio">` with form participation (`name`, `value`, `checked`). | `role="radio"` (custom only), `aria-checked` (`"true"` \| `"false"`), roving `tabindex` (`0` if checked, `-1` if unchecked). | Choice candidate: `this.props.value`.<br>Active: `this.group.value === this.props.value`.<br>Activation: `this.group.value = this.props.value`. Always idempotent (never deselects, even when `!required`); group may start empty.<br>Form field: `this.props.name` passes through to native element. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `RadioGroupProps<T extends Primitive = Primitive>`
```ts
export interface RadioGroupProps<T extends Primitive = Primitive> {
  /** Optional DOM element identifier */
  id?: string;
  /** HTML form field name forwarded to native radio inputs */
  name?: string;
  /** Active radio value (may start undefined; once set, never deselects) */
  value?: T;
  /** Keyboard navigation axis and aria-orientation (default: 'vertical') */
  orientation?: 'vertical' | 'horizontal';
  /** When false, arrows move focus and select immediately (default: false; focus is choice) */
  manual?: boolean;
  /** Enforces a selection constraint requiring a non-empty value */
  required?: boolean;
  disabled?: boolean;
}
```

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
  role: 'radiogroup',
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

2. **Activation**:
   - Activating a radio sets `this.group.value = this.props.value`.
   - Re-activating an already checked radio is idempotent (radio buttons cannot be unchecked by clicking them again).

3. **Keyboard Navigation**:
   - Arrow keys (`ArrowDown` / `ArrowUp` or `ArrowRight` / `ArrowLeft`) move roving focus and automatically select the next enabled radio button (`manual === false`, default). With `manual: true`, arrows move focus only and `Space` selects.

4. **State Projection**: `checked` reads `this.group.value === this.props.value`; setting it writes `this.group.value`. Props is the single source of state.
