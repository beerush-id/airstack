# Navigation Specification

The roving link group and navigation landmark. Delivers vertical keyboard traversal across the links it contains,
wrapping at both ends, under a single tab stop — and is the baseline that `breadcrumb` and `pagination` extend.

- **Entity**: `navigation`
- **WAI-ARIA Role**: `navigation` (omitted when bound to native `<nav>`)

### Composite Parts (Entity Tree)

- **`Navigation`**: Container coordinator (`role="navigation"`, `aria-label` / `aria-labelledby`, arrow travel).
- Member links follow the `Link` contract ([link.md](../widgets/link.md)).

### Placement (user ruling 2026-10-13)

`navigation` is a composite, not a landmark. It owns behaviour — roving focus across member links — so it lives in
`src/composites/` and `test/composites/`, on the same reasoning that placed `breadcrumb` there. The role-only
`specs/landmarks/navigation.md` is retired: a controller whose entire output is `role="navigation"` plus an
`aria-label` is two attributes with a dependency wrapped around them, and earns nothing over writing them by hand.

### Boundary

A horizontal bar of menu items is `menu-bar` ([menu.md](menu.md)), whose members are menu items rather than links.
An ordered trail of ancestors with a terminal page is `breadcrumb`. A numbered page list holding a page position is
`pagination`. `navigation` is the unordered peer set: no order, no terminal member, no position.

---

## The Three Semantic Layers

| Part / Role      | HTML Semantic              | WAI-ARIA Semantic                                                                   | Aria Package Semantic Contract                                                     |
|:-----------------|:---------------------------|:------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------|
| **`Navigation`** | Native `<nav>` or `<div>`. | `role="navigation"` (omitted on native `<nav>`), `aria-label` / `aria-labelledby`. | Hosts the accessible name and coordinates vertical traversal across member links.  |

---

## Architectural & Behavioral Contracts

### 1. Options & Props Contracts

#### `NavigationProps`

```ts
export interface NavigationProps {
  /** Accessible label compiled to aria-label. No default — an unnamed navigation invents no name. */
  label?: string;
  /** Element ID providing the accessible name, compiled to aria-labelledby. */
  labelledby?: string;
}
```

#### `NavigationAttributes`

```ts
export interface NavigationAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
```

#### Options

`AriaOptions`. `native` defaults to **`true`** — the opposite of the static landmarks. A static landmark exists to
give a custom host a role it lacks, so it defaults to a custom host; a behaving group is worth binding to a real
`<nav>` because the roving travel is the reason to install it, and `native` then only suppresses the redundant role.

### 2. Overload Contract

```ts
// Navigation: roving link group and navigation landmark
export function aria<E extends BaseElement = HTMLElement>(
  role: 'navigation',
  props?: NavigationProps,
  options?: AriaOptions
): NavigationAria<E>;
```

### 3. Baseline Architecture (`NavigationBase`)

`NavigationBase` is abstract and holds everything the three link groups share. `BreadcrumbAria`, `PaginationAria`,
and `NavigationAria` extend it and supply only what differs.

1. **No `update()` in the baseline.** The base constructor never compiles attributes; each concrete subclass calls
   `this.update()` as its own last construction step. A base that compiles during `super()` reads subclass inputs
   before they are assigned — the defect that silently stripped `role` from every server-rendered landmark
   (user ruling 2026-10-13). The base constructor therefore takes both parameters with **no defaults**; a default
   there is unreachable, since every subclass passes both.

2. **Ambient publication.** The base publishes itself into `navCtx` on construction. `LinkAria` reads a single
   `navCtx` to learn it is grouped — one lookup, not one per group kind. `breadcrumbCtx` and `paginationCtx` do not
   exist.

3. **Overridable inputs.** Two protected getters carry everything a subclass varies:
   - `orientation`: the axis the arrow keys travel. `'horizontal'` in the base, overridden to `'vertical'` by
     `NavigationAria`.
   - `defaultLabel`: the accessible name used when the author gives none. `undefined` in the base, `'Breadcrumbs'`
     and `'Pagination'` in those subclasses.

4. **Member selector.** Travel runs over `a[href]:not([aria-disabled="true"]), [role="link"]:not([aria-disabled="true"])`,
   queried live at key time so dynamically added links join without re-registration.

---

## State & Lifecycle Rules

1. **Role Compilation**: `role="navigation"` on a generic host; omitted when `native: true`, because a `<nav>`
   already implies it. The role derives from `native` alone — never from the host tag and never from the element's
   position in the tree — so SSR and hydration compile identically.

2. **Naming**: `label` compiles to `aria-label`, `labelledby` to `aria-labelledby`, both reactively; either may be
   cleared and the attribute withdraws. Both may be present at once and neither takes precedence. A navigation with
   no name emits no name: the controller invents no fallback, because two unnamed navigations on a page are
   indistinguishable and only the author knows which is which.

3. **Traversal** (vertical):
   - `Down` / `Up` move DOM focus to the next / previous enabled link, wrapping at both ends.
   - `Home` / `End` move focus to the first / last enabled link.
   - Disabled links are passed over in every direction.
   - `Left` / `Right` are never handled and keep their browser behaviour, since the group travels vertically.
   - Travel is focus-only (`manual`): moving focus never activates a link. Activation stays with the link itself.

4. **Single Tab Stop**: the container takes no `tabindex` of its own. The single stop is produced by the `Link`
   contract — the current link holds `tabindex="0"` and every other grouped link parks at `-1`, reached with the
   arrows. Mark the active link `current` so the stop lands where readers expect.

5. **What It Emits Nothing Of**: no `value`, no `aria-current`, no `aria-activedescendant`, no `aria-orientation`,
   no `aria-multiselectable`, and no selection state of any kind. A navigation is a focus collection, not a choice
   collection; it never marks a member current on the author's behalf.

6. **Ownership**: `label` and `labelledby` are consumed inputs and are pushed into `omittedAttrs`, so they appear in
   `ownKeys` and `restProps(['children'])` is the whole omission list. Neither leaks to the DOM as a stray attribute.

7. **Inheritance**: `breadcrumb` locks the axis horizontal and adds an ordered trail with a terminal page;
   `pagination` locks it horizontal and adds the page position (`page`, `total`, `canBackward`, `canForward`,
   `prev()`, `next()`). Neither re-implements traversal, naming, role compilation, or context publication.

---

## Open Gaps (contract stated, not yet implemented)

1. **Tab stop with no current link.** `LinkAria` parks every grouped link at `-1` unless it is current, so a
   navigation with no current link has no tab stop at all and cannot be reached by keyboard. `spec.md` already names
   the fix — "first enabled" is a tab-stop fallback, never a selection fallback. Needs its own RED.

2. **Author-settable `orientation`.** The axis is fixed per role today (`NavigationAria` overrides the base getter to
   `'vertical'`); there is no `orientation` prop, so the docs promise none. Adding it means a `NavigationProps`
   member, `aria-orientation` compilation, and a decision about whether `breadcrumb` and `pagination` accept it or
   stay locked horizontal.
