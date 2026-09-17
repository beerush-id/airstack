# ARIA Package Specification & WAI-ARIA Reference

The `aria` package is a headless, framework-agnostic accessibility controller foundation for UI components. It bridges reactive state machines with the standard W3C WAI-ARIA specification, compiling deterministic attribute snapshots for SSR/JSX rendering and managing DOM lifecycles.

---

## Package Mission & Responsibilities

The core job of the `aria` package is to:

1. **Model WAI-ARIA Semantics & State**: Encapsulate interactive states (`disabled`, `pressed`, `checked`, `expanded`, `selected`, `value`) within reactive proxies so accessibility states automatically recompute upon state changes.
2. **Compile Deterministic Attribute Dictionaries**: Compute pure HTML and ARIA attribute dictionaries (`role`, `aria-*`, `tabindex`, `disabled`, `type`, `class`, `style`) for SSR and template spreading (`.attributes`), excluding `on*` event handlers to decouple serialized markup from DOM event execution.
3. **Manage Fine-Grained DOM Lifecycles (`ref`)**: Bind to target DOM elements, diff and synchronize attributes directly onto DOM nodes, and manage direct DOM event listener registration and detachment.
4. **Polyfill Non-Native Elements**: Provide keyboard triggers (Enter/Space activation, arrow-key navigation) and accessibility semantics when users bind controllers to non-native tags (`div`, `span`), while preserving browser-native behavior when bound to native HTML tags (`button`, `input`).
5. **Compose Event Handlers**: Ensure internal accessibility behaviors and state transitions execute first, then seamlessly forward events to user-defined refiner listeners with fresh, transitioned state.
6. **Zero-Cost Framework Translation**: Translate attributes to framework-specific conventions (e.g. `class` &rarr; `className` for React) outside the reactive observation loop with cached results for zero-allocation JSX spread.
7. **Composable Architecture**: Provide a lean, single-element controller (`Aria<E, T, A>`) that composite widgets (Tabs, Combobox, Accordion, Dialog) compose into parent-child controller graphs.

---

## The Three Semantic Layers: HTML vs. WAI-ARIA vs. Aria Package

Controllers strictly separate three distinct layers of semantic responsibility to avoid conflating native browser behavior, accessibility tree annotations, and reactive application state:

| Layer | Responsibility & Boundary | Source of Truth | Key Characteristics |
| :--- | :--- | :--- | :--- |
| **HTML Semantic** | Native browser behavior, DOM element semantics, form participation (`FormData`), native focusability, built-in events, and native boolean/value attributes (`checked`, `disabled`, `open`, `multiple`, `type`, `name`, `value`). | WHATWG HTML Living Standard | Browser-executed, native validation, implicit roles, form submission. |
| **WAI-ARIA Semantic** | Accessible metadata for assistive technologies: roles (`role="listbox"`), string states (`aria-selected="true"`, `aria-checked="mixed"`), and relationship linkages (`aria-controls`, `aria-activedescendant`). | W3C WAI-ARIA 1.2 / 1.3 | **Zero native behavior, zero state storage, zero form participation**. Purely an accessibility tree snapshot. |
| **Aria Package Semantic** | Headless reactive controller and state machine (this package): orchestrates structural contracts (`group` with `multiple?: boolean`, `name`, `value`, `required`), ambient scope discovery (`this.scope`), attribute compilation, and DOM lifecycle/keyboard polyfills. | Aria Protocol | Framework-agnostic reactive proxy, bridges HTML and ARIA based on `isNative`. |

---

## Architectural Contracts

### Standards vs Locked Role Specs
This document states illustrative standards: layering, vocabulary, and shared
mechanics. Role specifications under [`specs/`](specs/) are locked contracts and
may lock otherwise on any per-role decision (defaults, overloads, keyboard
tables). Where this document shows sample code (ID generation, scope capture,
roving queries), the sample is normative for the mechanism it demonstrates:
`uIndex` namespacing, scope push/pop pairing, and disabled-aware queries.

### Public API Surface
External consumers and template authors interact with:
- **`.attributes`**: Normalized HTML and ARIA attribute dictionary for template spread (`role`, `tabindex`, `aria-*`, `class`, `style`). Excludes `on*` event handlers. Emits **strictly accessibility metadata**; never emits HTML form attributes (`name`, `value`, `form`).
- **`.current`**: React `RefObject` compatible getter/setter for DOM element access (`widget.current?.focus()`).
- **`.ref`**: Universal callback ref for DOM attachment across React, Solid, Svelte, and vanilla DOM (`ref={widget.ref}`).
- **`.props`**: Reactive inputs proxy for reading and mutating component properties. Props is a transparent bridge: unowned consumer props pass through to the template or can be bound directly in JSX.
- **`.scope`**: Enclosing parent `Aria` controller captured during construction via ambient scope chaining (`this.scope = ariaScope.get()`).
- **State Projections**: First-class reactive getters and setters for interactive states (`widget.selected`, `widget.expanded`, `widget.checked`, `widget.pressed`, `widget.open`). Only state has a setter to drive transitions; comparators (`widget.disabled`, `widget.isNative`) are read-only getters and never have a setter.
- **`.assign(partial)`**: Batch updates reactive props atomically.
- **`.refine(fn)`**: Injects custom attributes, styles, or composed event listeners; returns an unregister cleanup callback (`() => void`) to prevent memory leaks and zombie attributes.
- **`.destroy()`**: Cleans up observers, runs registered refiner cleanups (`unrefine`), unbinds DOM listeners, and releases element references.

### Base Types & Interfaces

```ts
/** Universal base inputs contract for Aria controllers (open dictionary) */
export interface AriaProps {
  [key: string]: any;
}

/** Universal static configuration options */
export interface AriaOptions {
  /** Whether bound to native HTML element (omits redundant roles and keyboard polyfills) */
  native?: boolean;
}

/** Compiled attribute dictionary for template spreading */
export type AriaAttributes = Record<string, any>;
```

### DOM Event Attachment & Lifecycle
Event listeners are bound directly to the mounted DOM element through the `applyAttributes` utility:
- **Registration**: Event handlers declared with `on*` prefixes (built-in role behaviors and consumer-injected refiners) are attached to the element via `addEventListener`.
- **Reconciliation**: When an event handler reference updates across reactive ticks, the previous listener is detached via `removeEventListener` and the replacement listener is attached.
- **Teardown**: When an attribute refiner unregisters, its associated event listeners are detached from the element.

### Protected Subclass SPI (`Aria<E, T, A, O extends AriaOptions = AriaOptions>`)
Specialized widget implementations (e.g. `ButtonAria`, `SliderAria`) extend base `Aria`:
- **`protected options`**: Controller configuration options (`native` and subclass-specific options).
- **`protected element`**: The bound DOM element reference for internal queries and DOM APIs.
- **`protected omittedAttrs`**: Attribute keys shielded from external mutation or override by consumer `.refine()` calls (aria linkage ids and state attributes).
- **`protected attrs`**: Normalized attribute dictionary containing internal role attributes and `on*` event handlers prior to public projection.
- **`protected createAttributes()`**: Pure factory computing base HTML/ARIA attributes and event handlers for the role.
- **`protected attach()`**: Lifecycle hook invoked when the DOM element mounts, returning a detachment cleanup function.

> [!IMPORTANT]
> **Prohibit ECMAScript Hard Private Fields (`#field`)**: Never use `#field` syntax in controllers. Hard private fields are completely inaccessible to subclasses, break class inheritance, prevent method overrides, and cause runtime `TypeError` when accessed across reactive `Proxy` instances. Always use TypeScript soft access modifiers (`protected` / `private`) so subclasses can cleanly inherit and coordinate state.

### The Architectural Boundary: Props vs. Options

To maintain predictable separation between UI component authoring and internal engine lifecycles, controllers enforce a strict boundary between `props` and `options`:

| Dimension | Component Props (`props`) | Controller Options (`options`) |
| :--- | :--- | :--- |
| **Concern** | **What** the component represents (semantic state, user inputs, ARIA attributes). | **How** the controller operates (engine adapter, DOM binding lifecycle). |
| **Exposure** | Public JSX/template API (`<Tab orientation="vertical" manual value="x">`, `<Accordion multiple>`). Forwarded directly from consumer component wrappers without plucking. | Instantiation-time engine flags passed to `new Aria(props, options)` or `aria(role, props, options)`. Encapsulated within component wrappers; never exposed to template authors. |
| **Mutability** | **Dynamic & Reactive**: Values change across component ticks (`value`, `disabled`, `required`, `orientation`, `multiple`, `manual`). Wrapped in a reactive proxy. | **Static & Immutable**: Engine configuration fixed at controller creation (`native?: boolean`). Never changes during the element lifecycle. |
| **DOM Compilation** | Compiles directly into standard ARIA and interaction attributes (`aria-orientation`, `aria-required`, `aria-disabled`, `aria-selected`, `tabindex`). | Governs attribute omission, event listener attachment strategies, and whether to emit native HTML attributes vs. pure ARIA polyfills. |
| **Examples** | `value`, `name`, `multiple`, `orientation`, `manual`, `required`, `disabled`, `selected`, `checked`, `pressed`, `min`, `max`, `step`. | `native?: boolean` (bind to `<button>`/`<input>` vs custom `<div>`), mid-layer inheritance flags set by the public class or parent controller, never JSX (e.g. `toggle?: boolean`, see Mid-Layer Architecture). |

#### The Guiding Axioms:
1. **The Direct Forwarding Rule**: If a value is passed by a template author in JSX/HTML (`<Widget foo="...">`), it **must** reside in `props`. Component wrappers must never be forced to deconstruct JSX props into separate `props` and `options`.
2. **The Engine Isolation Rule**: If a setting determines how the controller attaches to the browser DOM (e.g. `native: true` using native `<button>` behavior vs `native: false` attaching Space/Enter key polyfills), it **must** reside in `options`.

---

### Authoring Vocabulary: Archetypes & Semantic Concerns

`aria()` role strings are **Aria entity names**, not WAI-ARIA tokens; the compile step maps entity+part to WAI-ARIA roles.

Authoring properties are structured around the **four behavioral archetypes** of composite and collection widgets:

#### 1. Paired Structural Composites (`Tab`, `Accordion`)
- **Primary Concern**: Deterministic cross-element coordinate linkage (`aria-controls` &harr; `aria-labelledby`) between trigger and content panel without holding object references.
- **Container**: `id` (entity namespace, author-overridable, defaults generated) + `value` (active section state) + concern props (`orientation`, `manual`, `required`, `disabled`).
- **Member**: `name` (identity key linking trigger to panel) + initial state hints (`selected`, `expanded`) + `disabled`.
- **Coordinate Derivation**: Member DOM IDs and ARIA linkage derive deterministically via `f(parentId, name)`.

#### 2. Value Choice Composites (`RadioGroup`, `Select`)
- **Primary Concern**: Selection of a candidate value within an input collection (`group.value === member.value`).
- **Container**: `value` (current selected value) + concern props (`orientation`, `manual`, `required`, `disabled`). Group `id` is optional and not required for coordination (no external panels).
- **Member**: `value` (candidate value matching `group.value`) + `disabled`.
- **Form Compatibility**: Member selection uses `value`. The HTML form field name (`name`) is preserved for native form binding: `<input {...radio.attributes} name={props.name} value={props.value} />`.

#### 3. Coordinated Toggle Groups (`ToggleGroup`)
- **Primary Concern**: Coordinated two-state button toggling (single or multiple).
- **Container**: `value` (active item or array of active items) + concern props (`orientation`, `manual`, `required`, `disabled`). Group `id` is optional.
- **Member**: `value` (active token) + `disabled`.

#### 4. Stateless Focus Collections (`Toolbar`, `Menu`)
- **Primary Concern**: Single-tab-stop roving focus management across independent actions.
- **Container**: Focus-only traversal (`orientation`). Zero selection state; no group `value`, no group `id`.
- **Controls**: Native action controls managing their own state (`pressed`, `checked`).

#### The Form Boundary Invariant
The `aria` package is **not a form serializer or submission engine**. The `.attributes` dictionary emits only accessibility metadata (`role`, `aria-*`, `tabindex`, `aria-disabled`). It never synthesizes or emits HTML form attributes (`name`, `value`, `form`). When an underlying element participates in native form submission, the template author binds standard HTML attributes directly in JSX.

---

### Entity Tree Architecture & Authoring Taxonomy (Authoring vs. WAI-ARIA Compilation)

Component and controller naming is authored strictly around the **Entity Tree Structure**, not forced into a naive 1:1 parity with raw WAI-ARIA role strings or HTML tags.

#### The Authoring Dichotomy
Forcing a 1:1 relationship between authored roles and WAI-ARIA roles creates severe taxonomy breakdowns:
- WAI-ARIA designates `role="tab"` for the individual clickable button and `role="tablist"` for the container.
- If a framework forces the composite root to be pluralized as `Tabs` and the button as `Tab`, consumer code suffers from semantic collision, irregular JSX nesting, and ambiguous scoping.

#### The Entity Tree Model
In our architecture, the **Root Entity** is singular and identifies the conceptual domain component (`Tab`, `Accordion`, `Menu`, `Dialog`). All child members specialize as explicit sub-parts within that entity's tree:

```
- Tab (Root Orchestrator / Context Publisher)
  - TabList (Tab.List) -> Focus manager container (compiles role="tablist")
    - TabButton (Tab.Button) -> Interactive trigger (compiles role="tab")
  - TabPanel (Tab.Panel) -> Content panel (compiles role="tabpanel")

- Accordion (Root Orchestrator / Context Publisher)
  - AccordionItem (Accordion.Item) -> Optional item boundary
    - AccordionButton (Accordion.Button) -> Interactive header trigger (compiles role="button")
    - AccordionPanel (Accordion.Panel) -> Collapsible content (compiles role="region")
```

#### Compilation Separation
- **Authoring Surface**: Clean, intuitive entity trees using dot-notation (`<Tab>`, `<Tab.List>`, `<Tab.Button>`, `<Tab.Panel>`) or standalone parts (`Tab`, `TabList`, `TabButton`, `TabPanel`). Controller methods mirror this hierarchy (`tab.list()`, `tab.button()`, `tab.panel()`).
- **WAI-ARIA Projection**: The controller compiler projects the entity tree down to standard WAI-ARIA attributes and DOM relationships:
  - `Tab.List` &rarr; `<div role="tablist">`
  - `Tab.Button` &rarr; `<button role="tab" aria-selected="..." aria-controls="...">`
  - `Tab.Panel` &rarr; `<div role="tabpanel" aria-labelledby="...">`

---

### Composite Widget Architecture & Contracts

Every `Aria` controller instance governs exactly one DOM element. Composite WAI-ARIA widgets (Tab, Menu, Combobox, RadioGroup, Accordion, Toolbar) are coordinated graphs of discrete `Aria` instances operating through self-discovery and shared reactive state:

---

#### 1. Logical Component Hierarchy vs Semantic DOM Hierarchy
In WAI-ARIA, the logical component tree must not be conflated with the rendered DOM hierarchy:
- **Logical Root Orchestrator (`Tab`)**: Owns the reactive state (`value`, `id`, `manual`, `orientation`) and publishes ambient context (`selectionGroup.set(this.props)` and `tabCtx.set(this)`). It renders as a pure fragment or un-roled structural wrapper (`<div class="tab">`). It does **not** bind to `role="tablist"` directly, because WAI-ARIA strictly prohibits `tabpanel` elements from existing as DOM children inside a `tablist`.
- **Semantic DOM Elements**:
  - **`tab.list()` &rarr; `TabListAria`**: Binds to `<div role="tablist">`. Has **no independent state** of its own; it reads and mutates `this.tab`. Manages roving tabindex keyboard navigation across child tabs.
  - **`tab.button()` &rarr; `TabButtonAria`**: Binds to `<button role="tab">` inside `<div role="tablist">`.
  - **`tab.panel()` &rarr; `TabPanelAria`**: Binds to `<div role="tabpanel">` rendered as a sibling **outside** `<div role="tablist">`.

```tsx
// Logical Component Tree (Context Hierarchy)
<Tab value="profile">              {/* Logical Root: Owns value, publishes tabCtx, NO ARIA role */}
  <Tab.List>                       {/* DOM: <div role="tablist"> (TabListAria: Shares this.tab) */}
    <Tab.Button name="profile">    {/* Semantic identity: name="profile" (DOM: <button role="tab">) */}
    <Tab.Button name="security">   {/* Semantic identity: name="security" (DOM: <button role="tab">) */}
  </Tab.List>
  <Tab.Panel name="profile">       {/* Paired by matching name="profile" (DOM: <div role="tabpanel">) */}
  <Tab.Panel name="security">      {/* Paired by matching name="security" (DOM: <div role="tabpanel">) */}
</Tab>
```

```tsx
// TabList.tsx (Child Component)
const tab = tabCtx.get();
const list = tab.list(); // TabListAria shares tab instance

// TabButton.tsx (Child Component)
const tab = tabCtx.get();
const button = tab.button({ name: 'profile' });

// TabPanel.tsx (Child Component)
const tab = tabCtx.get();
const panel = tab.panel({ name: 'profile' });
```

This decouples the visual component tree from DOM hierarchy depth, allowing intermediate markup and layout styling without manual controller prop-drilling while enforcing strict WAI-ARIA DOM validity.

---

#### 2. Deterministic ID Generation & Pair Addressing
Controllers generate stable, context-scoped identifiers using `uIndex(..., true)` with declared role symbol constants to guarantee SSR and client hydration parity:

```ts
const ROLE_TAB = 'tab';
const ROLE_TABLIST = 'tab-list';
const ROLE_TABBUTTON = 'tab-button';
const ROLE_TABPANEL = 'tab-panel';

const TAB_INDEX = $symbol(ROLE_TAB);
const TABLIST_INDEX = $symbol(ROLE_TABLIST);
const TABBUTTON_INDEX = $symbol(ROLE_TABBUTTON);
const TABPANEL_INDEX = $symbol(ROLE_TABPANEL);

// Parent Orchestrator
public id = `${ROLE_TAB}-${uIndex(TAB_INDEX, true)}`;

// Child Parts
public id = `${ROLE_TABBUTTON}-${uIndex(TABBUTTON_INDEX, true)}`;
```

During attribute generation (`createAttributes()`), child elements derive paired DOM identifiers dynamically from the parent's resolved namespace (`const parentId = this.tab.id`) and the child's semantic name (`const name = this.props.name`):

```ts
// Inside TabButton.createAttributes()
return {
  id: `${parentId}-tab-button-${key}`,
  'aria-controls': `${parentId}-tab-panel-${key}`,
};

// Inside TabPanel.createAttributes()
return {
  id: `${parentId}-tab-panel-${key}`,
  'aria-labelledby': `${parentId}-tab-button-${key}`,
};
```

Child controllers push `'id'`, `'aria-controls'`, and `'aria-labelledby'` into `omittedAttrs` to shield pair synchronization from consumer `.refine()` overrides.

Pairing between elements is strictly addressable through deterministic state and key derivation, never through cross-instance references:
- **Zero Cross-Instance References**: Triggers never reference panels (`this.panel` does not exist), and panels never reference triggers (`this.button` does not exist).
- **Independent Lifecycles**: Triggers and panels inhabit disparate component subtrees, mount and unmount asynchronously, and may be lazy-loaded independently without coupling or synchronization leaks.
- **Deterministic Coordinate Mapping**: The accessibility linkage (`aria-controls` &harr; `id` &harr; `aria-labelledby`) is computed as a pure function `f(parentId, role, key)`. Because counterpart controllers share the ambient parent identity and match on semantic `key`, pairing is mathematically guaranteed without holding relational object references.

---

#### 3. Group Contracts & Structural Signatures

The contract defined by this package is strictly the **signature (structural protocol)**, not the value itself. DOM identifiers (`id`) and semantic identifiers (`name`) are always `string`. Selection values (`value`) must be `Primitive`: they compare with `===` and derive selection state. Richer domain objects remain in consumer application state.

##### Ambient Publication Contract (Props vs. Instance)
To facilitate decoupled child members across disparate component subtrees, composite groups manage context through a two-tier ambient publication contract:

1. **Mandatory Ambient Props (`selectionGroup`)**:
   A group **must** publish its reactive props (`GroupProps`) into ambient context (`selectionGroup.set(this.props)`).
   - Child members discover their enclosing group via this ambient props context (`this.group = selectionGroup.get()`).
   - Members read and mutate the collective group state directly through `this.group` (`this.group.value`, `this.group.multiple`, `this.group.required`, `this.group.orientation`) without coupling to a specific parent controller class.

2. **Optional Controller Instance (`tabCtx`, `accordionCtx`, etc.)**:
   When specialized composites require coordinated sub-controller spawning (e.g. `Tab` orchestrating `tab.list()`, `tab.button()`, `tab.panel()`), the group **optionally** publishes its own controller instance into a role-specific ambient context (`tabCtx.set(this)`).

##### Group Archetypes on Public Props (`props`)
Component props (`props`) represent the public-facing API exposed to template authors (`<Tab value="profile" orientation="vertical">`, `<Accordion multiple value={['a']}>`, `<RadioGroup value="dark">`). Grouping archetypes (`multiple?: boolean`) and interaction axis (`orientation?: 'horizontal' | 'vertical'`) reside directly on `props` to allow direct prop forwarding and dynamic attribute compilation (`aria-orientation`).

```ts
export interface BaseGroupProps extends AriaProps {
  /** Prevents user interaction across all member items */
  disabled?: boolean;
  /** Enforces a selection constraint requiring a non-empty value (`aria-required="true"`) */
  required?: boolean;
  /** Axis orientation for keyboard navigation and aria-orientation attribute */
  orientation?: 'horizontal' | 'vertical';
}

/** Single selection archetype (default) */
export interface GroupProps<T extends Primitive = Primitive> extends BaseGroupProps {
  multiple?: false;
  /** Current active item identifier */
  value?: T;
}

/** Multiple simultaneous selection archetype */
export interface GroupMultipleProps<T extends Primitive = Primitive> extends BaseGroupProps {
  multiple: true;
  /** Array of active item identifiers */
  value?: T[];
}
```

##### Child Member Contracts
Member active state evaluation depends on the widget archetype:

1. **Paired Structural Members (`Tab.Button`, `Accordion.Button`)**:
   Declare `name` as their semantic section key:
   - **Active Check**:
     ```ts
     const isActive = this.group.multiple
       ? this.group.value?.includes(this.props.name)
       : this.group.value === this.props.name;
     ```
   - **Activation**: Mutates `this.group.value` with `this.props.name`. If single-select and `!this.group.required`, re-activation toggles off (`delete this.group.value`).

2. **Value Choice Members (`Radio`, `Option`)**:
   Declare `value` as their candidate selection choice:
   - **Active Check**:
     ```ts
     const isActive = this.group.multiple
       ? this.group.value?.includes(this.props.value)
       : this.group.value === this.props.value;
     ```
   - **Activation**: Mutates `this.group.value` with `this.props.value`.
   - **Radio Exception**: Radios are never toggle controls. Once checked, re-activation is always idempotent, even when `!this.group.required`. A radiogroup may still start empty (`value === undefined`).
   - **Option Toggle**: In single-select select, selecting an active option deselects it only when `!this.group.required`.

3. **Initial Selection & Claiming Strategy**:
   When a single-selection group has no value present (`this.group.value === undefined`):
   - A member explicitly declaring an initial selection hint (`selected: true` / `checked: true`) claims active selection (`this.group.value = memberKey`).
   - If the group is marked as `required` (`this.group.required`) and no member has claimed selection, the first mounted member claims active selection.
   - If the group is not `required` and no member declares a selection hint, the group remains unselected.

##### The Native vs. Pure ARIA Contract (`{ native?: boolean }`)
During SSR, DOM elements do not exist (`this.element === null`). The controller cannot inspect the DOM to determine whether the template renders a native HTML element (`<button>`, `<input>`) or a custom element (`<div>`, `<span>`). To guarantee 100% deterministic compilation between SSR and client hydration:

1. **Deterministic Configuration**:
   - `this.isNative` evaluates strictly from `!!this.options.native`.
   - Never relies on runtime DOM tag guessing (`this.element?.tagName === ...`), ensuring zero hydration mismatches.

2. **Default Options**:
   - Roles wrapping native HTML elements by default (`button`, `checkbox`) default to `{ native: true }` in their controller options, eliminating boilerplate in standard UI components.
   - Roles without native HTML counterparts (`switch`) default to pure ARIA (`native: false`); the role spec may permit `native: true` for button-backed hosts (see `switch`).

3. **Output Isolation**:
   - **When `isNative === true` (Native Elements)**:
     - Emits native HTML attributes (`type`, `checked`, `indeterminate`).
     - Omits redundant implicit ARIA roles (e.g. `role="button"` on `<button>`, `role="checkbox"` on `<input type="checkbox">`).
     - Delegates Space/Enter key navigation directly to the browser (disables synthetic polyfills).
   - **When `isNative === false` (Custom Elements)**:
     - Emits explicit WAI-ARIA roles (`role="button"`, `role="checkbox"`) and state attributes (`aria-checked="true" | "false" | "mixed"`).
     - Activates keyboard navigation polyfills (Space/Enter) so custom elements behave accessibly.
     - Omits invalid HTML attributes (`type`, `checked`, `indeterminate`) that do not belong on non-input tags.

---

#### 4. State-Driven Rendering & Public Projections
All dynamic attributes (`aria-selected`, `aria-pressed`, `tabindex`, `hidden`) are pure projections of reactive state.

To support template conditionals (`{panel.selected && <Content />}`), dynamic class bindings (`class={{ active: button.selected }}`), and programmatic control, controllers expose computed interactive states as first-class public reactive getters and setters (`widget.selected`, `widget.expanded`, `widget.checked`, `widget.pressed`, `widget.open`). Props is the single source of state; projections directly read from and write to props (or to `this.group` for members):
- **Read**: Returns whether the element currently satisfies the active state.
- **Write**: Only interactive states have setters; setting active state invokes the role's defined activation mutation rules. Comparators (`disabled`, `isNative`) are read-only getters and never expose setters.
- **Compiled Output**: Compiles deterministic attributes (e.g. `aria-selected="true" | "false"` and roving `tabindex="0" | "-1"`).

ARIA state attributes (`aria-selected`, `aria-expanded`, `aria-checked`, `aria-pressed`, `aria-hidden`, `aria-modal`) are string-enumerated attributes that require explicit string tokens (`"true"` | `"false"` | `"mixed"`). Unlike HTML boolean attributes (`hidden`, `disabled`) that are omitted when false, ARIA attributes must emit `"false"` explicitly so assistive technologies distinguish an inactive state from an element lacking the role capability.

---

#### 5. Event Handling & State Mutation Convergence
Interactive triggers converge mouse clicks, native button keyboard activation (Enter/Space on `<button>`), and programmatic roving focus into a single authoritative activation mutation path:
- **Internal Transitions First**: Controller state transitions execute synchronously upon event trigger before user-defined refiner listeners receive the event.
- **Downstream Synchronization**: User refiner callbacks receive fresh, transitioned state.
- **Disabled Guarding**: When `disabled` is true, all activation mutations and event dispatching are suppressed.

---

#### 6. Keyboard Navigation & Live DOM Roving Tabindex
Composite widgets manage single-tab-stop roving focus through container-level event delegation (`onkeydown`), inspecting live DOM elements at invocation time:

```ts
// Inside TabListAria onkeydown
const tabs = Array.from(this.element.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled]):not([aria-disabled="true"])'));
const index = tabs.indexOf(currentTabElement);
const next = tabs[(index + 1) % tabs.length];

next.focus();
if (!this.group.manual) {
  next.click(); // Invokes child onclick state mutation
}
```

Navigation conforms to `aria-orientation`:
- `horizontal` (default): `ArrowRight` (next, wraps) / `ArrowLeft` (prev, wraps).
- `vertical` (`aria-orientation="vertical"`): `ArrowDown` (next, wraps) / `ArrowUp` (prev, wraps).
- `Home` / `End`: First / last enabled DOM item.

**Toolbar roving takeover**: A `toolbar` owns the single tab stop and arrow travel across everything inside it. Inner selection groups keep their value semantics but surrender their own roving handlers when scoped inside a toolbar; grouping inside collapses to `role="group"` for AT semantics only. Scope detection runs over the ambient scope chain (nearest toolbar controller); see [Toolbar](specs/composites/toolbar.md).

In automatic selection, focus movement invokes `next.click()` immediately. In manual selection (`props.manual: true`), focus moves without selection until explicitly activated via `Enter` or `Space`. `manual` exists only on single-select focus-moving containers (`tab`, single `accordion`, `radiogroup`, single `select`, single `toggle-group`, single `tree`); multi-select, action, and grid/menu/toolbar containers never select on focus, so they declare no `manual` prop. Defaults are per-role, never global.

---

#### 7. Overlay Lifecycle & Document Orchestration
Modals and overlays (`dialog`, `confirm`) implement document-level event listeners and focus containment within the `protected attach()` lifecycle hook:

```ts
// Inside DialogAria.attach()
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    this.close();
    return;
  }

  if (e.key === 'Tab' && this.props.modal) {
    // Contain focus within first and last focusable element
  }
};
```

Upon opening, the controller captures `document.activeElement`; upon closing or unmounting, focus is restored to that element. Trapping focus is strictly conditioned on `aria-modal="true"`.

---

#### 8. Ambient Scope Chaining & Self-Discovering Overlays (`this.scope`)
To eliminate intrusive wrapper components (such as `<TooltipProvider>`), base `Aria` automatically captures the ambient execution scope upon construction:

```ts
export class Aria<E = HTMLElement, T = AriaProps, A = AriaAttributes, O = AriaOptions> {
  public readonly scope?: Aria;
  protected options: O;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    this.options = options;
    this.scope = ariaScope.get(); // Captures enclosing parent controller
    ariaScope.set(this);         // Publishes itself for downstream children
    // The previous scope MUST be restored when this controller's construction
    // scope exits (sibling subtrees must never observe each other as scope).
    // Host frameworks restore it after rendering this controller's children.
  }
}
```

Nested overlays (`TooltipAria`, `PopoverAria`) leverage `this.scope` to self-discover their host trigger without wrapper components, prop drilling, or secondary registries:

- **Self-Discovering Tooltip (`TooltipAria`)**:
  When placed inside a trigger component, the tooltip automatically captures `this.scope` as its host:
  ```tsx
  <Button>
    Save Draft
    <Tooltip>Saves your changes locally</Tooltip>
  </Button>
  ```
  - **Descriptor Injection**: Injects `aria-describedby={this.open ? this.id : undefined}` onto `this.scope`.
  - **Event Attachment**: In `attach()`, binds `pointerenter`, `pointerleave`, `focus`, and `blur` listeners directly to `this.scope.element`.
  - **Non-Interactive Invariant**: Enforces `role="tooltip"`, remaining strictly non-focusable with zero focusable descendants.

- **Self-Discovering Popover (`PopoverAria`)**:
  When placed inside a trigger component, the popover automatically captures `this.scope` as its trigger:
  ```tsx
  <Button>
    Filters
    <Popover>
      <FilterForm />
    </Popover>
  </Button>
  ```
  - **Trigger Wiring**: Injects `aria-haspopup="dialog"`, `aria-expanded={this.open ? 'true' : 'false'}`, and `aria-controls={this.id}` onto `this.scope`.
  - **Event Attachment**: In `attach()`, binds click toggle to `this.scope.element`, plus light-dismiss (click outside) and `Escape` focus restoration.

##### Attribute Injection Mechanics: Refiner vs DOM Fallback
Because compiled `this.attrs` dictionaries are non-reactive snapshots recomputed during update cycles, overlays inject accessibility attributes through two distinct layers:
- **Aria Host (`this.scope`) &rarr; Host Refiner (`this.scope.refine()`)**:
  During constructor initialization, the child overlay registers an attribute refiner on the host, capturing the returned cleanup callback to prevent zombie attributes on unmount:
  ```ts
  // Inside TooltipAria constructor:
  if (this.scope) {
    const unrefine = this.scope.refine(() => ({
      'aria-describedby': this.open ? this.id : undefined,
    }));
    this.cleanups.add(unrefine);
  }
  ```
  Because refiners run within the host's reactive observer, injected attributes persist across host state changes and compile deterministically during SSR. When the overlay destroys, calling `unrefine()` removes the refiner and recomputes host attributes to purge stale linkage.
- **Native DOM Parent Fallback (`!this.scope`) &rarr; Direct Mutation in `attach()`**:
  If nested inside a plain HTML tag lacking an `Aria` controller (e.g. `<button><Tooltip>...</Tooltip></button>`), `this.scope` is `undefined`. In `attach()`, the controller falls back to `this.element.parentElement`:
  - Dynamically sets accessibility attributes (`setAttribute('aria-describedby', this.id)`) directly on `parentElement`.
  - Attaches hover, focus, or click listeners directly to `parentElement`.
  - Removes injected attributes and event listeners on unmount.

---

### Shared Locked Rules (normative for all role specs)

1. **Deselect idiom**: single-select deselection is `delete this.group.value`.
2. **`omittedAttrs` shielding**: pair-linkage IDs (`id`, `aria-controls`, `aria-labelledby`, overlay-injected `aria-describedby`) and compiled state attributes are always shielded from consumer `.refine()` overrides; refiners targeting shielded keys are ignored.
3. **Pair-ID derivation**: `f(parentId, role, key)` derives paired child IDs from `parentId`, `role`, and child string `key` (`props.name ?? props.id ?? this.id`). Deterministic `uIndex(..., true)` namespacing applies to paired composite roots (Tab, Accordion).
4. **Disabled composition**: effective disabled is group `disabled` OR member `disabled`.
5. **`required` on multi-select**: `required: true` demands a non-empty array; `[]` and `undefined` are both unselected. First-mount claiming does not apply to multi-select; single-select claiming follows §3.
6. **Form attribute isolation**: `.attributes` never synthesizes or emits HTML form attributes (`name`, `value`, `form`). In value choice composites (radio, option), group matching evaluates member `value` against `group.value`. Form field naming (`props.name`) is preserved unmutated for template binding.
7. **Structural `group` parts** (select/tree/menu inner groups): render `role="group"` with a label, pass the ambient scope through unchanged, and take no `aria()` overload — except menu subgroups, which publish an independent scoped selection value for their radio members (see `menu`).
8. **Group `id` scoping**: Paired composite roots (`Tab`, `Accordion`) accept `id?: string`, defaulting to a generated namespace, so child triggers and panels derive paired coordinate IDs. Non-paired groups (`RadioGroup`, `Select`, `ToggleGroup`, `Toolbar`) do not require a group `id` for internal coordination.

### Behavioral Capabilities & Architectural Layers

Controllers are organized across three capability layers:

- **Base (`Aria`)**: element lifecycle, attribute compilation, refiners, scope chaining (SPI above).
- **Behavioral Capabilities**: shared state machinery. Selection capability coordinates group value, activation/toggle rules, claiming, and roving tabindex; disclosure capability coordinates overlay trigger wiring, light-dismiss, Escape handling, and focus restoration.
- **Public Roles** (`TabAria`, `TabButtonAria`, `RadioGroupAria`, …): role compilation + locked per-role contracts in `specs/`.

Capability options are set by the public-class definition or the parent controller — never forwarded from JSX. The test is the setter: anything a template author passes in JSX **must** be props (Direct Forwarding Rule); anything fixed at class-definition level **may** be options. Per rulings: `orientation`, `selectionMode`, and live-region `politeness`/`atomic` are author-set and live on props; text-input `role` is set by the public TextInput/SearchInput faces and stays in options.

## Role Specifications Index

Role-specific architectural options, props contracts, state projections, and keyboard lifecycles are organized in dedicated specifications under [`specs/`](specs/), mirrored after the package directory structure:

### Composites ([`specs/composites/`](specs/composites/))
- [Tab](specs/composites/tab.md) (`tab` + `tab-list` + `tab-button` + `tab-panel`)
- [Accordion](specs/composites/accordion.md) (`accordion` + `accordion-item` + `accordion-trigger` + `accordion-panel`)
- [Menu & Menubar](specs/composites/menu.md) (`menu-bar` / `menu` + `menu-item` + `menu-item-checkbox` + `menu-item-radio` + `group`)
- [ContextMenu](specs/composites/context-menu.md) (`context-menu` + `context-menu-trigger` + `menu`)
- [Select](specs/composites/select.md) (`select` + `select-trigger` + `select-popup` + `select-option`)
- [Combobox](specs/composites/combobox.md) (`combobox` + `combobox-input` + `combobox-popup` + `combobox-option`)
- [Listbox](specs/composites/listbox.md) (`listbox` + `listbox-option`)
- [Treeview](specs/composites/tree.md) (`tree` + `tree-item` + `group`)
- [Grid & Treegrid](specs/composites/grid.md) (`grid` / `treegrid` + `row` + `gridcell`)
- [Radio Group](specs/composites/radio-group.md) (`radio-group` + `radio`)
- [Checkbox Group](specs/composites/checkbox-group.md) (`checkbox-group` + `checkbox-group-item`)
- [Toggle Group](specs/composites/toggle-group.md) (`toggle-group` + `toggle`)
- [Toolbar](specs/composites/toolbar.md) (`toolbar` + controls)
- [Sort](specs/composites/sort.md) (`sort` + `sort-header` + `sort-trigger`)
- [Field](specs/composites/field.md) (`field` + `field-label` + `field-control` + `field-description` + `field-error`)
- [CodeInput](specs/composites/code-input.md) (`code-input` + `code-input-cell`)
- [DatePicker](specs/composites/date-picker.md) (`date-picker` + `date-picker-input` + `date-picker-trigger` + `date-picker-calendar` + `date-picker-day`)
- [DateRangePicker](specs/composites/date-range-picker.md) (`date-range-picker` + `date-range-picker-input` + `date-range-picker-trigger` + `date-range-picker-calendar` + `date-range-picker-day`)
- [Pagination](specs/composites/pagination.md) (`pagination` + page links)
- [Breadcrumb](specs/composites/breadcrumb.md) (`breadcrumb` + `breadcrumb-separator` + crumb links)
- [Carousel](specs/composites/carousel.md) (`carousel` + `carousel-viewport` + `carousel-slide` + controls)
- [Reorder](specs/composites/reorder.md) (`reorder` + `reorder-item` + `reorder-handle` + `reorder-status`)
- [Toast](specs/composites/toast.md) (`toast-region` + `toast` + `toast-title` + `toast-description` + `toast-close`)
- [Feed](specs/composites/feed.md) (`feed` + `feed-article`)

### Widgets ([`specs/widgets/`](specs/widgets/))
- [Button](specs/widgets/button.md) (`button` action trigger)
- [Toggle](specs/widgets/toggle.md) (`toggle` two-state button)
- [Checkbox](specs/widgets/checkbox.md) (`checkbox` binary & tri-state)
- [Radio](specs/widgets/radio.md) (`radio` single-selection member)
- [Option](specs/widgets/option.md) (`option` select/combobox member)
- [Switch](specs/widgets/switch.md) (`switch` boolean toggle)
- [Text-Input](specs/widgets/text-input.md) (`text-input` text input)
- [Search-Input](specs/widgets/search-input.md) (`search-input` search input)
- [Slider](specs/widgets/slider.md) (`slider` numeric range)
- [Stepper](specs/widgets/stepper.md) (`stepper` / `number-stepper`)
- [Progress](specs/widgets/progress.md) (`progress` / `progressbar`)
- [Meter](specs/widgets/meter.md) (`meter` scalar gauge)
- [Scrollbar](specs/widgets/scrollbar.md) (`scrollbar` container sync)
- [Divider](specs/widgets/divider.md) (`divider` static divider)
- [Splitter](specs/widgets/splitter.md) (`splitter` movable splitter)
- [Disclosure](specs/widgets/disclosure.md) (`disclosure` show-hide unit)
- [Dialog](specs/widgets/dialog.md) (`dialog` modal overlay)
- [AlertDialog](specs/widgets/alert-dialog.md) (`alert-dialog` / `confirm`)
- [Tooltip](specs/widgets/tooltip.md) (`tooltip` advisory overlay)
- [Popover](specs/widgets/popover.md) (`popover` disclosure overlay)
- [Link](specs/widgets/link.md) (`link` navigation trigger)
- [FileTrigger](specs/widgets/file-trigger.md) (`file-trigger` file picker)
- [Image](specs/widgets/image.md) (`image` loading & fallback)
- [Alert](specs/widgets/alert.md) (`alert` inline announcement)

### Landmarks ([`specs/landmarks/`](specs/landmarks/))
- [Overview](specs/landmarks/landmarks.md)
- [Header](specs/landmarks/header.md) (`header`)
- [Main](specs/landmarks/main.md) (`main`)
- [Navigation](specs/landmarks/navigation.md) (`navigation`)
- [Sidebar](specs/landmarks/sidebar.md) (`sidebar`)
- [Footer](specs/landmarks/footer.md) (`footer`)
- [Search](specs/landmarks/search.md) (`search`)
- [Form](specs/landmarks/form.md) (`form`)
- [Section](specs/landmarks/section.md) (`section`)

### Live Regions ([`specs/live/`](specs/live/))
- [Overview](specs/live/live-regions.md)
- [Announcer](specs/live/announcer.md) (`announcer`)

---

## WAI-ARIA Semantic References

### Live Region Roles

Live regions automatically announce updates without losing current focus.

| Role | What It Is | Purpose | Required / Default Politeness | Best Practice |
| :--- | :--- | :--- | :--- | :--- |
| `alert` | High-priority dynamic message. | Informs user of errors or urgent notifications. | Implicit `aria-live="assertive"`, `aria-atomic="true"` | Use only for time-critical alerts. |
| `status` | Advisory information message. | Informs of non-critical status changes (e.g. "Draft saved"). | Implicit `aria-live="polite"`, `aria-atomic="true"` | `<output>` has implicit status role. |
| `log` | Append-only sequential updates. | Chat logs, error histories, activity feeds. | Implicit `aria-live="polite"` | New entries appended at the end. |
| `timer` | Counter or countdown clock. | Displays elapsed or remaining time. | `aria-live="off"` or controlled polling | Announce at milestones, not every second. |
| `marquee` | Rapidly changing text. | Stock tickers, sports scores. | `aria-live="off"` | Provide mechanism to pause. |

---

### Landmark Roles

Landmarks divide page structure into navigable sections (`<main>`, `<nav>`, `<header>`, etc.).

| Role | What It Is | Purpose | HTML5 Native Element | Requirement |
| :--- | :--- | :--- | :--- | :--- |
| `banner` | Primary site header. | Contains logo, title, global site info. | `<header>` (scoped to `<body>`) | Max 1 per page. |
| `main` | Primary unique content of the document. | Skips repeated navigation directly to main content. | `<main>` | Exactly 1 per page. |
| `navigation` | Navigation menu/links collection. | Groups related links. | `<nav>` | Use `aria-label` if multiple on one page. |
| `complementary` | Supporting sidebar / aside. | Contextual info related to main topic. | `<aside>` | Use `aria-label` to distinguish. |
| `contentinfo` | Footer information. | Copyrights, privacy links, disclaimers. | `<footer>` (scoped to `<body>`) | Max 1 per page. |
| `search` | Search tool area. | Encloses search input and controls. | `<search>` or `<form role="search">` | Identifies site search feature. |
| `form` | Form landmark. | Significant form area. | `<form aria-label="...">` | Requires accessible name to be a landmark. |
| `region` | Generic named landmark. | Important self-contained section. | `<section aria-label="...">` | **Must** have `aria-label` or `aria-labelledby`. |

---

### Document Structure & Presentational Roles

| Role | What It Is | Purpose | HTML5 Native Element |
| :--- | :--- | :--- | :--- |
| `heading` | Section title. | Declares hierarchy (`aria-level="1"` through `6`). | `<h1>` - `<h6>` |
| `list` | Container for items. | Denotes unordered/ordered lists. | `<ul>`, `<ol>` |
| `listitem` | Item within a list. | Denotes individual list item. | `<li>` (child of `list`) |
| `table` | Static data table. | Non-interactive tabular data. | `<table>` |
| `separator` | Visual divider or splitter. | If focusable: acts as draggable splitter with `aria-valuenow`. | `<hr>` (static) |
| `toolbar` | Action toolbar. | Groups actions (buttons, toggles, controls). | Container with `aria-label` |
| `tooltip` | Popup tooltip label. | Referenced via `aria-describedby` or `aria-labelledby`. | Element with `role="tooltip"` + `id` |
| `none` / `presentation` | Removes semantic meaning. | Strips element semantics while keeping visual/DOM structure. | N/A |

---

### Summary Matrix of Critical Relationship Attributes

| Attribute | Meaning | Common Role Combinations |
| :--- | :--- | :--- |
| `aria-controls` | Identifies element(s) whose contents/presence are controlled by this element. | `tab` &rarr; `tabpanel`<br>`combobox` &rarr; `listbox`<br>`button` (accordion) &rarr; `region`<br>`scrollbar` &rarr; scroll area |
| `aria-labelledby` | Points to element(s) that label this element. | `tabpanel` &larr; `tab`<br>`dialog` &larr; heading `id`<br>`region` &larr; heading `id` |
| `aria-describedby` | Points to element(s) providing detailed descriptions or help text. | `input` / `dialog` / `button` &larr; helper text / `tooltip` |
| `aria-owns` | Informs accessibility tree of hierarchical child relationships when DOM hierarchy differs. | `treeitem` &rarr; nested `group`<br>`combobox` &rarr; detached `listbox` popup |
| `aria-activedescendant` | Holds ID of currently focused virtual child without shifting actual DOM focus. | `combobox` / `listbox` / `tree` / `grid` &rarr; active item ID |
