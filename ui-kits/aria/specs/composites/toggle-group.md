# Toggle Group Specification

A toggle group is a composite widget containing a set of one or more related toggle buttons that can be toggled independently or mutually exclusively.

### Composite Parts
- **`ToggleGroup`**: WAI-ARIA `group` (or `radiogroup` if single-select required)
- **`Toggle`**: WAI-ARIA `button` (with `aria-pressed`); group member with candidate `value`

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`ToggleGroup` (Root)** | Structural container (`<div>`). | `role="group"` (or `role="radiogroup"` if single-select required), `aria-orientation` (`horizontal` default), `aria-label` / `aria-labelledby`. | Container group. Props: `SingleToggleGroupProps` (default) \| `MultipleToggleGroupProps` (`multiple: true`). Publishes group context. |
| **`Toggle` (Member)** | Native `<button type="button">`. Handles Space/Enter click natively. | `role="button"` (with `aria-pressed`), roving `tabindex` (`0` if active, `-1` if inactive). | Member token: `this.props.value` (when inside a group).<br>- **Single**: `this.group.value === this.props.value`.<br>- **Multiple**: `this.group.value?.includes(this.props.value)`. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleToggleGroupProps<T extends Primitive = Primitive>`
```ts
export interface SingleToggleGroupProps<T extends Primitive = Primitive> {
  multiple?: false;
  /** Optional DOM element identifier */
  id?: string;
  /** Active item identifier */
  value?: T;
  /** Keyboard navigation axis and aria-orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** When true, arrows move focus without selecting until Enter/Space (default: true) */
  manual?: boolean;
  /** Whether an item must always remain active */
  required?: boolean;
  disabled?: boolean;
}
```

#### `MultipleToggleGroupProps<T extends Primitive = Primitive>`
```ts
export interface MultipleToggleGroupProps<T extends Primitive = Primitive> {
  multiple: true;
  /** Optional DOM element identifier */
  id?: string;
  /** Array of active item identifiers */
  value?: T[];
  /** Keyboard navigation axis and aria-orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Whether at least one item must remain active */
  required?: boolean;
  disabled?: boolean;
}
```

#### `ToggleGroupProps<T extends Primitive = Primitive>`
```ts
export type ToggleGroupProps<T extends Primitive = Primitive> =
  | SingleToggleGroupProps<T>
  | MultipleToggleGroupProps<T>;
```

Group members are `toggle` controllers with a `value` matching the group state (see `specs/widgets/toggle.md`). No `toggle-item` entity exists.

### 2. Overload Contracts

```ts
// ToggleGroup
export function aria<E extends BaseElement = HTMLElement, T extends Primitive = Primitive>(
  role: 'toggle-group',
  props?: ToggleGroupProps<T>
): ToggleGroupAria<E>;
```

---

## State & Lifecycle Rules

1. **State Projection (`pressed`)**:
   - Single selection: Evaluates `this.group.value === this.props.value`.
   - Multiple selection: Evaluates `Boolean(this.group.value?.includes(this.props.value))`.

2. **Activation**:
   - Single selection: If `!this.group.required` and already active, deselects (`delete this.group.value`); otherwise sets `this.group.value = this.props.value`.
   - Multiple selection: Toggles membership in `this.group.value` array.

3. **Keyboard Navigation**:
   - Horizontal: `ArrowRight` / `ArrowLeft` roves focus between items with circular wrap.
   - Vertical: `ArrowDown` / `ArrowUp` roves focus between items with circular wrap.
   - Single defaults to manual (`manual !== false`): arrows move focus only; `Enter`/`Space` selects. Multiple declares no `manual`: arrows never select.

4. **State Projection**: `pressed` reads `this.group.value` membership; setting it runs the activation rules above. Props is the single source of state.
