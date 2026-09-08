# Accordion Specification

An accordion is a vertically stacked set of interactive headings that each contain a title, content snippet, or thumbnail, where each item can expand or collapse its associated content section. Structured according to the Entity Tree, it consists of a root orchestrator (`Accordion`), interactive trigger buttons (`AccordionButton` / `Accordion.Button`), and content panels (`AccordionPanel` / `Accordion.Panel`).

### Composite Parts (Entity Tree)
- **`Accordion`**: Root entity orchestrator (publishes ambient `selectionGroup` and `accordionCtx`, role omitted)
- **`AccordionItem` (`Accordion.Item`)**: Optional structural item boundary. Not a controller: renders a plain wrapper with no role, publishes no scope, and takes no `aria()` overload.
- **`AccordionButton` (`Accordion.Button`)**: Interactive header trigger (compiles WAI-ARIA `role="button"`)
- **`AccordionPanel` (`Accordion.Panel`)**: Collapsible content section (compiles WAI-ARIA `role="region"`)

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Accordion` (Root)** | Structural container (`<div>`). | None (role omitted). | Container orchestrator. Publishes `selectionGroup` + `accordionCtx`. Props: `SingleAccordionProps` (default) \| `MultipleAccordionProps` (`multiple: true`). |
| **`AccordionButton` (`Accordion.Button`)** (Trigger) | Native `<button type="button">`. Handles Space/Enter click natively. | `role="button"` (omitted if native), `aria-expanded` (`"true"` \| `"false"`), `aria-controls` (panel ID), `id`. | Member identifier: `this.props.name`. Options: `AccordionButtonOptions` (`{ native?: boolean }`). Props: `AccordionButtonProps`. Derives `expanded` from `this.group`. Activation toggles expansion. |
| **`AccordionPanel` (`Accordion.Panel`)** (Panel) | Collapsible section (`<section>` or `<div>`). Uses HTML `hidden` when collapsed. | `role="region"`, `aria-labelledby` (trigger ID), `id`. | Paired by `this.props.name`. Props: `AccordionPanelProps`. Derives visibility from matching trigger's expansion state. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `SingleAccordionProps`
```ts
export interface SingleAccordionProps {
  multiple?: false;
  /** Entity namespace; defaults to generated id */
  id?: string;
  /** Expanded item identifier */
  value?: string;
  /** When false, arrow-key focus movement expands the focused panel immediately (default: true) */
  manual?: boolean;
  /** Enforces a selection constraint requiring a non-empty value */
  required?: boolean;
  disabled?: boolean;
}
```

#### `MultipleAccordionProps`
```ts
export interface MultipleAccordionProps {
  multiple: true;
  /** Entity namespace; defaults to generated id */
  id?: string;
  /** Array of expanded item identifiers */
  value?: string[];
  /** Enforces a selection constraint requiring a non-empty value */
  required?: boolean;
  disabled?: boolean;
}
```

#### `AccordionProps`
```ts
export type AccordionProps =
  | SingleAccordionProps
  | MultipleAccordionProps;
```

#### `AccordionButtonOptions`
```ts
export interface AccordionButtonOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `AccordionButtonProps`
```ts
export interface AccordionButtonProps {
  /** Explicit DOM identifier of the trigger */
  id?: string;
  /** Semantic identity matching panel name */
  name?: string;
  /** Initial expansion hint */
  expanded?: boolean;
  disabled?: boolean;
}
```

#### `AccordionPanelProps`
```ts
export interface AccordionPanelProps {
  /** Explicit DOM identifier overriding automatic pair derivation */
  id?: string;
  /** Semantic identity matching trigger button name */
  name?: string;
}
```

### 2. Overload Contracts

```ts
// Accordion
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion',
  props?: AccordionProps
): AccordionAria<E>;

// AccordionButton: Default native button trigger overload
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'accordion-button',
  props?: AccordionButtonProps,
  options?: AccordionButtonOptions
): AccordionButtonAria<E>;

// AccordionPanel: Content section overload
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion-panel',
  props?: AccordionPanelProps
): AccordionPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Active Check**:
   - In single (`!this.group.multiple`):
     ```ts
     const isExpanded = this.group.value === this.props.name;
     ```
   - In multiple (`this.group.multiple === true`):
     ```ts
     const isExpanded = Boolean(this.group.value?.includes(this.props.name));
     ```

2. **Activation & Mutation**:
   - In single (`!this.group.multiple`):
     - If active and `!this.group.required`: Collapses via `delete this.group.value`.
     - If active and `this.group.required`: Idempotent (cannot collapse).
     - If inactive: Expands via `this.group.value = this.props.name`.
   - In multiple (`this.group.multiple === true`):
     - If active: Removes from array (`this.group.value = this.group.value.filter(id => id !== this.props.name)`).
     - If inactive: Appends to array (`this.group.value = [...(this.group.value ?? []), this.props.name]`).

3. **Deterministic Pair Linkage**:
   - Trigger: `id = "${parentId}-accordion-button-${name}"`, `aria-controls = "${parentId}-accordion-panel-${name}"`.
   - Panel: `id = "${parentId}-accordion-panel-${name}"`, `aria-labelledby = "${parentId}-accordion-button-${name}"`.

4. **Initial Expansion & Claiming**:
   When the group is uncontrolled (`this.group.value === undefined`):
   - A button declaring `expanded: true` claims expansion (`this.group.value = this.props.name` in single; appended in multiple).
   - If `this.group.required` is true and no button has claimed, the first mounted button claims expansion.

5. **State Projection**: `expanded` reads `this.group.value` membership; setting it runs the activation rules above. Props is the single source of state.

6. **Keyboard Interaction**:
   - `Enter` or `Space` activates the trigger and toggles panel expansion.
   - `ArrowUp` / `ArrowDown` move focus between header buttons (wrapping); `Home` / `End` jump to first / last header.
   - Arrow-driven focus never expands while `manual !== false` (default). With `manual: false` (single only), the newly focused header expands immediately.
   - Focus arriving via `Tab` never expands, regardless of `manual`. Multiple declares no `manual`: arrows move focus only.
   - When `native: false`, Space and Enter key events are polyfilled.

