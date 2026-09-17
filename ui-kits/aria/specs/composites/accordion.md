# Accordion Specification

An accordion is a vertically stacked set of interactive headings that coordinate panel expansion. In addition to grouped coordination, individual items support autonomous standalone disclosure operation without requiring an enclosing Accordion container.

### Composite Parts (Entity Tree)
- **`Accordion`**: Root entity orchestrator (publishes ambient `accordionCtx`, coordinates group `value`, multi-expansion, and roving focus across triggers; role omitted).
- **`AccordionItem` (`Accordion.Item`)**: Dual-mode context provider. In grouped mode, yields to `Accordion` context. In standalone mode, functions autonomously with local `expanded` state and dispatches local `change`.
- **`AccordionTrigger` (`Accordion.Trigger` / `Accordion.Button`)**: Interactive header trigger (compiles WAI-ARIA `role="button"`, manages roving focus or standalone tab stop).
- **`AccordionPanel` (`Accordion.Panel`)**: Collapsible content section (compiles WAI-ARIA `role="region"`, receives `hidden` when collapsed).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Accordion` (Root)** | Structural container (`<div>`). | None (role omitted). | Container orchestrator. Publishes `accordionCtx`. Props: `SingleAccordionProps` (default) \| `MultipleAccordionProps` (`multiple: true`). Coordinates roving focus. |
| **`AccordionItem`** | Plain wrapper (`<div>` or custom element). | None (role omitted per WAI-ARIA). | Context scope for `id`, `disabled`, and local `expanded` (standalone). Props: `AccordionItemProps`. |
| **`AccordionTrigger`** (Trigger) | Native `<button type="button">`. Handles Space/Enter click natively. | `role="button"` (omitted if native), `aria-expanded`, `aria-controls` (panel ID), roving `tabindex="0"` / `"-1"`, `id`. | Member identifier: `this.props.id` or `this.props.name`. Options: `AccordionTriggerOptions` (`{ native?: boolean }`). Derives `expanded` from group or item. |
| **`AccordionPanel`** (Panel) | Collapsible section (`<section>` or `<div>`). Uses HTML `hidden` when collapsed. | `role="region"`, `aria-labelledby` (trigger ID), `id`. | Paired by item `id`. Props: `AccordionPanelProps`. Hidden when collapsed. |

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
  value?: string | null;
  /** Enforces a selection constraint requiring a non-empty value (default: false) */
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
  disabled?: boolean;
}
```

#### `AccordionProps`
```ts
export type AccordionProps = SingleAccordionProps | MultipleAccordionProps;
```

#### `AccordionItemProps`
```ts
export interface AccordionItemProps {
  /** Item identifier */
  id?: string;
  /** Local expansion state used in standalone mode */
  expanded?: boolean;
  /** Item disabled flag */
  disabled?: boolean;
}
```

#### `AccordionTriggerOptions`
```ts
export interface AccordionTriggerOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `AccordionTriggerProps`
```ts
export interface AccordionTriggerProps {
  /** Explicit DOM identifier of the trigger */
  id?: string;
  /** Explicit item identity when used without AccordionItem wrapper */
  name?: string;
  disabled?: boolean;
}
```

#### `AccordionPanelProps`
```ts
export interface AccordionPanelProps {
  /** Explicit DOM identifier */
  id?: string;
  /** Explicit item identity when used without AccordionItem wrapper */
  name?: string;
}
```

### 2. Overload Contracts

```ts
// Accordion Container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion',
  props?: AccordionProps
): AccordionAria<E>;

// AccordionItem Context Scope
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion-item',
  props?: AccordionItemProps
): AccordionItemAria<E>;

// AccordionTrigger / AccordionButton
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'accordion-trigger' | 'accordion-button',
  props?: AccordionTriggerProps,
  options?: AccordionTriggerOptions
): AccordionTriggerAria<E>;

// AccordionPanel
export function aria<E extends BaseElement = HTMLElement>(
  role: 'accordion-panel',
  props?: AccordionPanelProps
): AccordionPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Dual-Mode Active Check**:
   - **Grouped Mode** (inside `Accordion`):
     - Single (`!this.group.multiple`): `isExpanded = this.group.value === itemId`.
     - Multiple (`this.group.multiple === true`): `isExpanded = Boolean(this.group.value?.includes(itemId))`.
   - **Standalone Mode** (outside `Accordion`):
     - `isExpanded = Boolean(this.item.props.expanded)`.

2. **Activation & Mutation**:
   - Must check `!event.defaultPrevented` and not `disabled`.
   - In grouped single: toggles item in `this.group.value` (collapsing others; setting to `null` if active unless `required: true`).
   - In grouped multiple: toggles item in array.
   - In standalone: toggles local `this.item.props.expanded`.

3. **Roving Focus & Initial Tab Stop (Grouped Mode)**:
   - Arrow keys `Up` / `Down` move focus between triggers, wrapping around and skipping disabled triggers.
   - `Home` / `End` move to the first / last enabled trigger.
   - Initial / fallback tab stop: If no item is expanded (or `value` is null/empty), roving `tabindex="0"` falls back to the first enabled trigger so the accordion is reachable via `Tab`. Sibling triggers receive `tabindex="-1"`.
   - In standalone mode: trigger retains `tabindex="0"` when enabled.

4. **Keyboard Polyfill (`!native`)**:
   - `Space`: Prevents default viewport scroll (`preventDefault()`) and activates trigger.
   - `Enter`: Activates trigger on keydown.

5. **Events**:
   - Grouped: Dispatches `CustomEvent<string | null | string[]>('change', { bubbles: true, detail: accordion.value })` on container.
   - Standalone: Dispatches `CustomEvent<boolean>('change', { bubbles: true, detail: item.expanded })` on item.
