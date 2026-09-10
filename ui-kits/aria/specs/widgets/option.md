# Option Specification

An option is a selectable item in a select or combobox popup.

- **Role**: `option`
- **WAI-ARIA Role**: `option`

---

## The Three Semantic Layers

| Context | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **Native Option** | Native `<option>` element inside `<select>`. Handles selection natively. | Implicit `role="option"`. Attribute omitted. | Synchronizes with native `.selected` property. |
| **Custom Option** | Non-native element (`<div>` or `<li>`). | `role="option"`, `aria-selected` (`"true"` \| `"false"`), `id`, roving `tabindex="-1"` (or `0` when active). | Choice member: `this.props.value`. Derives `selected` from enclosing `select` group. Manages focus and click selection. |

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
  /** Choice candidate value matching select active value */
  value: T;
  /** Explicit selected state when standalone or uncontrolled */
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
   - Single: Assigns `this.group.value = this.props.value`. If `!this.group.required` and already selected, deselects (`delete this.group.value`).
   - Multiple: Toggles `this.props.value` in `this.group.value` array.
