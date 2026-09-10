# Select Specification

A select presents a list of options and allows a user to select one or more of them. It supports single or multiple selection, vertical roving focus navigation, and option grouping.

- **Entity**: `select`
- **WAI-ARIA Role**: `listbox` (compiled output)

### Composite Parts
- **`Select`**: Root orchestrator (publishes ambient `selectionGroup` and `selectCtx`, role compiles `listbox`)
- **`Option`**: WAI-ARIA `option`
- **`SelectGroup`**: WAI-ARIA `group`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`select`** | Custom selectable list container (`<div>` or `<ul>`). Native `<select>` preferred for native form submission. | `role="listbox"`, `aria-label` / `aria-labelledby`, `aria-multiselectable` (`"true"` if multiple, `"false"` if single), `aria-required`, `aria-invalid`. | Container controller. Props: `SingleSelectProps` (default) \| `MultipleSelectProps` (`multiple: true`). Manages roving tabindex or `aria-activedescendant` and validation states. |
| **`option`** | Interactive list item (`<div>` or `<li>`). | `role="option"`, `aria-selected` (`"true"` \| `"false"`), `id`, `tabindex="-1"` (or `0` when focused). | Choice candidate: `this.props.value`.<br>- **Single Active**: `this.group.value === this.props.value`.<br>- **Multiple Active**: `this.group.value?.includes(this.props.value)`.<br>Activation sets or toggles selection. |
| **`group`** | Structural group separator (`<div>`). | `role="group"`, `aria-label` / `aria-labelledby`. | Semantic category separator; preserves parent select scope. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleSelectProps<T extends Primitive = Primitive>`
```ts
export interface SingleSelectProps<T extends Primitive = Primitive> {
  multiple?: false;
  /** Optional DOM element identifier */
  id?: string;
  /** Active option value */
  value?: T;
  /** Focus movement axis and aria-orientation (default: 'vertical') */
  orientation?: 'vertical' | 'horizontal';
  /** When true, arrows move focus without selecting until Enter/Space (default: true) */
  manual?: boolean;
  /** Enforces a selection constraint requiring a non-empty value */
  required?: boolean;
  /** Invalid indicator compiled to aria-invalid */
  invalid?: boolean | 'grammar' | 'spelling';
  disabled?: boolean;
}
```

#### `MultipleSelectProps<T extends Primitive = Primitive>`
```ts
export interface MultipleSelectProps<T extends Primitive = Primitive> {
  multiple: true;
  /** Optional DOM element identifier */
  id?: string;
  /** Array of active option values */
  value?: T[];
  /** Focus movement axis and aria-orientation (default: 'vertical') */
  orientation?: 'vertical' | 'horizontal';
  /** Enforces a selection constraint requiring a non-empty value */
  required?: boolean;
  /** Invalid indicator compiled to aria-invalid */
  invalid?: boolean | 'grammar' | 'spelling';
  disabled?: boolean;
}
```

#### `SelectProps<T extends Primitive = Primitive>`
```ts
export type SelectProps<T extends Primitive = Primitive> =
  | SingleSelectProps<T>
  | MultipleSelectProps<T>;
```

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
  /** Choice candidate value matching select active value */
  value: T;
  /** Initial selection hint when uncontrolled */
  selected?: boolean;
  disabled?: boolean;
}
```

### 2. Overload Contracts

```ts
// Select
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'select',
  props?: SelectProps<T>
): SelectAria<E>;

// Option
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'option',
  props: OptionProps<T>,
  options?: OptionOptions
): OptionAria<E>;
```

---

## State & Lifecycle Rules

1. **Active State Evaluation**:
   - Single:
     ```ts
     const isSelected = this.group.value === this.props.value;
     ```
   - Multiple:
     ```ts
     const isSelected = this.group.value?.includes(this.props.value);
     ```

2. **Activation & Selection**:
   - Single:
     - If active and `!this.group.required`: Deselects via `delete this.group.value`.
     - If active and `this.group.required`: Idempotent.
     - If inactive: Assigns `this.group.value = this.props.value`.
   - Multiple:
     - Toggles item into/out of array (`this.group.value`).

3. **Keyboard Navigation**:
   - **Vertical** (`orientation: 'vertical'`, default): `ArrowUp` / `ArrowDown` navigate between options with roving tabindex.
   - **Horizontal** (`orientation: 'horizontal'`): `ArrowLeft` / `ArrowRight` navigate between options with roving tabindex.
   - `Home` / `End` jump to first / last enabled option.
   - Single defaults to manual (`manual !== false`): arrows move focus only; Space or Enter activates the focused option. Automatic (`manual === false`) selects on focus.
   - Multiple declares no `manual`: arrows never select; Space or Enter toggles.

4. **State Projection**: `selected` reads `this.group.value` membership; setting it runs the activation rules above. Props is the single source of state.
