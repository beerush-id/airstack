# Tab Specification

A tabbed interface organizes content into multiple panels, where only one panel is visible at a time. Structured according to the Entity Tree, it consists of a root orchestrator (`Tab`), a focus container (`TabList` / `Tab.List`), interactive trigger buttons (`TabButton` / `Tab.Button`), and content panels (`TabPanel` / `Tab.Panel`).

### Composite Parts (Entity Tree)
- **`Tab`**: Root orchestrator (publishes ambient `selectionGroup` and `tabCtx`, role omitted)
- **`TabList` (`Tab.List`)**: Focus manager container (compiles WAI-ARIA `role="tablist"`)
- **`TabButton` (`Tab.Button`)**: Interactive trigger (compiles WAI-ARIA `role="tab"`)
- **`TabPanel` (`Tab.Panel`)**: Content section (compiles WAI-ARIA `role="tabpanel"`)

---

## The Three Semantic Layers

| Part / Role | HTML Semantic | WAI-ARIA Semantic | Aria Package Semantic Contract |
| :--- | :--- | :--- | :--- |
| **`Tab` (Root)** | Non-semantic layout wrapper (`<div>` or fragment). No form participation. | None (`role` omitted so `tabpanel` elements are not invalid DOM children of `tablist`). | Logical root orchestrator. Publishes `selectionGroup` + `tabCtx`. Props: `TabProps`. |
| **`TabList` (`Tab.List`)** | Structural container (`<nav>` / `<div>`). | `role="tablist"`, `aria-orientation` (`horizontal` default), `aria-label` or `aria-labelledby`. | Focus manager: manages roving tabindex across child tabs via Arrow keys. Reads `this.tab`. |
| **`TabButton` (`Tab.Button`)** | Native `<button type="button">`. Handles Space/Enter natively. | `role="tab"`, `aria-selected` (`"true"` \| `"false"`), `aria-controls` (ID of `TabPanel`), `id`, `tabindex` (`0` if selected, `-1` if inactive). | Member identifier: `this.props.name`.<br>Active: `this.tab.value === this.props.name`.<br>Activation: `this.tab.value = this.props.name`. Idempotent if `required: true`. Options: `TabButtonOptions`. Props: `TabButtonProps`. |
| **`TabPanel` (`Tab.Panel`)** | Content container (`<section>` or `<div>`). | `role="tabpanel"`, `aria-labelledby` (ID of `TabButton`), `id`, `tabindex="0"`. | Paired by `this.props.name`.<br>Active: `this.tab.value === this.props.name`.<br>Linkage: deterministic ID pairing with counterpart tab button. Props: `TabPanelProps`. |

---

## Architectural & Behavioral Contracts

### 1. Logical Hierarchy vs. Semantic DOM Hierarchy
In WAI-ARIA, `tabpanel` elements must NOT be DOM children of `tablist`:
- **`Tab`**: Root component that manages state and publishes `selectionGroup` and `tabCtx`.
- **`Tab.List` (`TabList`)**: Binds to `<div role="tablist">`, containing only `<button role="tab">` elements.
- **`Tab.Panel` (`TabPanel`)**: Rendered outside `<div role="tablist">` as a sibling.

```tsx
<Tab value="profile">
  <Tab.List aria-label="Account Settings">
    <Tab.Button name="profile">Profile</Tab.Button>
    <Tab.Button name="security">Security</Tab.Button>
  </Tab.List>
  <Tab.Panel name="profile">Profile Content</Tab.Panel>
  <Tab.Panel name="security">Security Content</Tab.Panel>
</Tab>
```

### 2. Options & Props Contracts

#### `TabProps` (Public Component Inputs)
```ts
export interface TabProps {
  /** Entity namespace; defaults to generated id */
  id?: string;
  /** Active tab name */
  value?: string;
  /** Tablist axis orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** When true, moving focus does not activate tab until Enter/Space (default: true; panel switches are heavy) */
  manual?: boolean;
  /** Enforces a selection constraint requiring a non-empty value (default: true) */
  required?: boolean;
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
  /** Explicit DOM identifier overriding automatic pair derivation */
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
  /** Explicit DOM identifier overriding automatic pair derivation */
  id?: string;
  /** Semantic identity matching tab button name */
  name: string;
}
```

### 3. Overload Contracts

```ts
// Tab: Root orchestrator
export function aria<E extends BaseElement = HTMLElement>(
  role: 'tab',
  props?: TabProps
): TabAria<E>;

// TabList: Focus manager container (shares parent tab state)
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

1. **Initial Selection & Claiming**:
   - If parent `Tab` is uncontrolled (`this.tab.value === undefined`):
     - A tab button declaring `selected: true` claims initial selection (`this.tab.value = this.props.name`).
     - If `this.tab.required` is true (default), the first mounted tab button claims active selection.

2. **Active Check**:
   - TabButton and TabPanel evaluate active state via:
     ```ts
     const isActive = this.tab.value === this.props.name;
     ```

3. **Activation & Mutation**:
   - Clicking a tab button or activating via keyboard assigns `this.tab.value = this.props.name`.
   - If `this.tab.required` is true, clicking the active tab button is idempotent (cannot deselect).
   - If `!this.tab.required`, clicking the active tab button deselects via `delete this.tab.value`.

4. **Keyboard Navigation (Roving Tabindex)**:
   - Handled on `TabList` via single-tab-stop roving focus:
     - **Horizontal** (`orientation: 'horizontal'`): `ArrowRight` (next, wraps), `ArrowLeft` (prev, wraps).
     - **Vertical** (`orientation: 'vertical'`): `ArrowDown` (next, wraps), `ArrowUp` (prev, wraps).
     - `Home` / `End`: First / last enabled tab button.
   - **Automatic Selection** (`this.tab.manual === false`): Moving focus immediately activates the tab button.
   - **Manual Selection** (`this.tab.manual !== false`, default): Focus moves without selection; tab button activates upon `Enter` or `Space`.

5. **Deterministic Linkage**:
   - TabButton: `id = "${parentId}-tab-button-${name}"`, `aria-controls = "${parentId}-tab-panel-${name}"`.
   - TabPanel: `id = "${parentId}-tab-panel-${name}"`, `aria-labelledby = "${parentId}-tab-button-${name}"`.

6. **State Projection**: `selected` reads `this.tab.value === this.props.name`; setting it writes `this.tab.value`. Props is the single source of state.

