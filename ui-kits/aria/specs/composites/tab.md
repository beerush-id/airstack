# Tab Specification

A tabbed interface organizes content into multiple panels, where only one panel is visible at a time. Structured according to the Entity Tree, it consists of a root orchestrator (`Tab`), a focus container (`TabList` / `Tab.List`), interactive trigger buttons (`TabButton` / `Tab.Button`), and content panels (`TabPanel` / `Tab.Panel`).

### Composite Parts (Entity Tree)
- **`Tab`**: Root orchestrator (publishes ambient `tabCtx`, role omitted).
- **`TabList` (`Tab.List`)**: Focus manager container (compiles WAI-ARIA `role="tablist"`).
- **`TabButton` (`Tab.Button`)**: Interactive trigger (compiles WAI-ARIA `role="tab"`).
- **`TabPanel` (`Tab.Panel`)**: Content section (compiles WAI-ARIA `role="tabpanel"`).

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Tab` (Root)** | Non-semantic layout wrapper (`<div>` or fragment). | None (`role` omitted so panels are not invalid DOM children of tablist). | Logical root orchestrator. Publishes `tabCtx`. Props: `TabProps`. |
| **`TabList` (`Tab.List`)** | Structural container (`<nav>` / `<div>`). | `role="tablist"`, `aria-orientation` (`horizontal` default). | Focus manager: manages roving tabindex across child tabs via Arrow keys. Reads `this.tab`. |
| **`TabButton` (`Tab.Button`)** | Native `<button type="button">`. Handles Space/Enter natively. | `role="tab"`, `aria-selected` (`"true"` \| `"false"`), `aria-controls` (panel ID), `id`, roving `tabindex="0"` / `"-1"`. | Member identifier: `this.props.name`.<br>Active: `this.tab.value === this.props.name`.<br>Activation: `this.tab.value = this.props.name`. |
| **`TabPanel` (`Tab.Panel`)** | Content container (`<section>` or `<div>`). Uses HTML `hidden` when inactive. | `role="tabpanel"`, `aria-labelledby` (trigger ID), `id`, `tabindex="0"` when scrollable. | Paired by `this.props.name`.<br>Active: `this.tab.value === this.props.name`.<br>Deterministic ID pairing. |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `TabProps`
```ts
export interface TabProps {
  /** Entity namespace; defaults to generated id */
  id?: string;
  /** Active tab name */
  value?: string;
  /** Tablist axis orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Activation timing: 'automatic' (arrows activate) or 'manual' (arrows focus only, Enter/Space activates). Default: 'automatic' */
  activation?: 'automatic' | 'manual';
  /** Backwards-compatible alias for activation === 'manual' */
  manual?: boolean;
  /** Disables the entire tab group */
  disabled?: boolean;
}
```

#### `TabListProps`
```ts
export interface TabListProps {
  /** Accessible label for the tablist */
  label?: string;
  /** Element ID providing the accessible label */
  labelledby?: string;
}
```

#### `TabButtonOptions`
```ts
export interface TabButtonOptions {
  /** Whether bound to native <button> (default: true) */
  native?: boolean;
}
```

#### `TabButtonProps`
```ts
export interface TabButtonProps {
  /** Explicit DOM identifier */
  id?: string;
  /** Semantic identity matching tabpanel name */
  name: string;
  /** Initial selection hint when parent is uncontrolled */
  selected?: boolean;
  /** Disables this tab button */
  disabled?: boolean;
}
```

#### `TabPanelProps`
```ts
export interface TabPanelProps {
  /** Explicit DOM identifier */
  id?: string;
  /** Semantic identity matching tab button name */
  name: string;
}
```

### 2. Overload Contracts

```ts
// Tab: Root orchestrator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tab',
  props?: TabProps
): TabAria<E>;

// TabList: Focus manager container
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tab-list',
  props?: TabListProps
): TabListAria<E>;

// TabButton: Interactive tab button trigger
export function aria<E extends BaseElement = HTMLButtonElement>(
  role: 'tab-button',
  props: TabButtonProps,
  options?: TabButtonOptions
): TabButtonAria<E>;

// TabPanel: Content section
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tab-panel',
  props: TabPanelProps
): TabPanelAria<E>;
```

---

## State & Lifecycle Rules

1. **Active Evaluation**:
   - `TabButton` and `TabPanel` evaluate `active = this.tab.value === this.props.name`.
   - Inactive panels receive `hidden`.
   - Panels receive `tabindex="0"` when scrollable so keyboard users can scroll content.

2. **Activation**:
   - Activating a tab button via pointer `click` or keyboard commits `this.tab.value = this.props.name` when not disabled and `!event.defaultPrevented`.
   - Emits `CustomEvent<string>('change', { bubbles: true, detail: this.tab.value })` on the Tab container.

3. **Roving Tabindex Navigation**:
   - Handled on `TabList`:
     - Horizontal: `ArrowRight` (next, wraps), `ArrowLeft` (prev, wraps).
     - Vertical: `ArrowDown` (next, wraps), `ArrowUp` (prev, wraps).
     - `Home` / `End`: First / last enabled tab button.
   - Under `activation: 'automatic'` (default): Moving focus immediately commits selection.
   - Under `activation: 'manual'`: Focus moves without selection; tab button activates upon `Enter` or `Space`.
