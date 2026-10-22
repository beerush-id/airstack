# AirLib AUI Implementation Plan

**Goal:** Create AirLib AUI React components from the AirLib Headless Kits, an `@airlib/aui` package containing native CSS and minimal framework-agnostic TypeScript utilities, and documentation with live demos.

AUI stands for Aria User Interface and is the design language of the AirLib kits. Its styling is inspired by Material Design 3, but it is not an M3 implementation: tokens, component naming, and visual treatment follow AUI's own vocabulary, and M3 conformance is not a requirement anywhere in this plan.

**Architecture:** Headless Kits own behavior, accessibility, state coordination, and their emitted attributes/tokens. React AUI declares component structure, marks controller-mutated props as `Bindable<T>`, and delegates class composition to the shared resolver in `@airlib/aui/utils`, which uses `classx`. `@airlib/aui` owns token-driven native CSS and framework-independent presentation utilities; the documentation app composes both packages.

**Tech stack:** React, TypeScript, `@airlib/react` with `classx` and `Bindable`, AirLib Headless Kits including `@airlib/aria`, native CSS up to the CSS anchor-positioning compatibility baseline, framework-agnostic AUI utilities, and AirLib MDX documentation.

**Execution:** Implement the tasks in Section 7 in order. Deliver each component family with its CSS, documentation, demos, and verification before marking it complete. Apply the package contracts and completion criteria throughout implementation.

**Allowed skills:** Use only the `airlib` skill family and `web-apis`; optionally use `design-system`. Load only the relevant skill/topic for the current task. Do not invoke other skills.

## 0. Authoritative decisions

- Delivered implementations on disk are the source of truth: extend the current packages and never rewrite working code to match older plan wording.
- Framework-agnostic for `@airlib/aui/utils` means no React/Solid imports, no DOM access, no browser globals, and no CSS side effects. `@airlib/core` (`classx`, `ClassInput`, type helpers) is allowed there and does not violate framework-agnosticity.
- `ui-kits/aui/src/utils.ts` owns the shared vocabulary once: `auiConfig` / `configure` / `register`, `resolveSize` / `resolveVariant` / `resolveColor` / `branded`, `resolveRoleClass` / `resolveFamilies`, the short `$` aliases, and the shared class constants, using only `@airlib/core`. `ui-kits/react-aui/src/config.ts` re-exports that module instead of duplicating it, and `ui-kits/react-aui/src/utils/common.ts` stays empty.
- Every component registers its fallbacks with `register(role, defaults)` and composes classes with the shared resolver, passing its own role and registered defaults. No component carries a private resolver.
- Main config stays lean: per-role slots are type-only (`button?: ComponentStyles`), not inlined growing objects, so users can override globally (`sizeMap`/`brand`/`overrides`) or per role (`auiConfig.button`) without bloating the main entry.

## 1. Scope and boundaries

| Location | Responsibility |
| --- | --- |
| `ui-kits/react-aui` | `@airlib/react-aui`: React component declarations, public prop types, `classx` composition, configurable presentation fallbacks, and exports. No authored styles or automatic CSS imports. |
| `ui-kits/aui` | `@airlib/aui`: framework-independent native CSS, tokens, `theme`/`base`/`component`/`utility` layers, shared size/variant/color-variant utilities, minimal TypeScript utilities/types, individual CSS imports, and barrels. |
| `apps/react-aui` | Installation guidance, component API documentation, live demos, shared presentation vocabulary, configuration/override examples, theming guidance, and accessibility guidance. |
| `apps/air-web` documentation layout | Read-only reference for documentation layout and conventions. Consult only the relevant docs layout when needed, together with the applicable AirLib skill. |
| `apps/air-web/pages/(docs)/aria` | Source of component scope, Headless Kit usage, supported behavior, composition, and interaction examples. Reference only. |
| `apps/air-web/pages/(docs)/aria` stylesheets | Reference for tokens, declarations, variants, and visual treatment. Convert required styles into native CSS under `ui-kits/aui/src`; keep the reference files unchanged. |

### Global constraints

- Keep implementation changes within `ui-kits/react-aui`, `ui-kits/aui`, and `apps/react-aui`.
- In both packages, keep implementation in `src/` and tests in a sibling `test/` directory. Mirror source groups and utility paths under `test/`; never colocate tests with implementation files. Configure test discovery for `test/` and keep tests out of production compilation and published artifacts.
- Group components by category, including `widgets` and `composites`. Use the same group for a component's React declaration, AUI stylesheet, and documentation page; do not maintain separate taxonomies.
- Use PascalCase React filenames and kebab-case CSS/documentation filenames, for example `widgets/Button.tsx`, `components/widgets/button.css`, and `docs/widgets/button.page.mdx`.
- Use only the allowed skills and Headless Kits documentation to learn framework/Headless APIs. Do not read, search, trace, or delegate investigation into dependency source or internals, including core, React, or Headless Kit packages, installed dependencies, generated bundles, or declarations.
- Inspect only implementation targets and the explicitly listed documentation/reference stylesheet locations. The reference stylesheets are a visual/token reference, not permission to follow imports into dependency packages.
- If the allowed documentation does not establish an API contract, ask for clarification; do not infer internals or dig into dependencies.
- Request a scope extension if implementation requires changes to unrelated app files; this does not waive the dependency-reading prohibition.
- Do not perform Git operations, publish packages, or delete existing files/artifacts.
- Strictly no dev/build commands, including indirect invocation through scripts or hooks. The dev server is always running and builds automatically; use that server and its generated outputs. Do not start, restart, or replace it, and do not inspect processes to verify its stated status.
- Preserve existing work; integrate into the current packages rather than replacing their scaffolds.
- No magic strings: give repeated/domain-significant strings named constants. Keep constants local when not reused across modules; export and reuse a single definition when shared. Do not scatter class names, variant names, or configuration keys across declarations and resolvers.
- No clarification comments in code, ever. Comments must carry non-obvious meaning only (why a decision exists, how to consume an opt-in entrypoint) — never restate what the code already says. The only comments that belong in code are JSDoc on public API.
- Read a file before writing it, every time — disk may hold concurrent edits you have not seen. A failed exact-match edit means your picture is stale: stop and re-read instead of pushing ahead. Never overwrite app-owned files (e.g. `apps/react-aui`, which owns its layer order and MDX imports); extend them.
- Mark every prop the controller can change as `Bindable<T>`, including `value` where applicable; derive the binding pattern from the allowed AirLib skills and Headless Kits documentation.
- Prefer modern CSS for presentation concerns expressible natively. Use CSS anchor-positioning support as the browser compatibility baseline and ceiling: features supported at that baseline or earlier are allowed; newer features are not.
- Component scope comes from the ARIA documentation, not from the number of stylesheets in the reference inventory.
- Do not port SolidJS examples, duplicate headless behavior, introduce a styling runtime, or add unrelated components.
- Each delivered component includes its React declaration, required CSS, documentation, demo, and verification.

## 2. Implementation starting points

- `@airlib/react-aui` declares `@airlib/aria`, `@airlib/aui`, and `@airlib/react` as dependencies and React / React DOM as peers. Its root export points to compiled JavaScript and declarations, and `sideEffects` is `false`. Preserve the JavaScript-only package boundary.
- `@airlib/aui` exports its source CSS barrel, source subpaths, a compiled bundle path, and `@airlib/aui/utils` as a separate JavaScript/types entrypoint. It declares CSS side effects so bundlers retain stylesheet imports, and it builds CSS and utilities as separate outputs.
- The ARIA directory contains 56 component/topic documentation pages. A topic can contain compound parts or describe supporting behavior; it does not necessarily imply one exported React component.
- The Button reference demonstrates `setup`, `aria('button', props)`, `ref`, and `restProps`. Follow each component's own reference contract rather than applying Button's interface universally.
- The reference theme uses `@theme`; reference Button styles also use `@utility`, `@apply`, and `@extend`. Convert all preprocessing constructs, not just Tailwind class names.
- Reference declarations depend on tokens such as `--spacing` and `--radius-full`. Supply their required values explicitly in the `theme` layer instead of relying on Tailwind defaults.
- Extend the docs landing page and pass-through layout into the documentation index and shell described in Task 2.

For each component, resolve its public API, DOM structure, state attributes, and CSS dependency graph before implementing its declaration and stylesheet.

## 3. Package contracts

### React declarations

- Use the documented Headless Kit to own interaction behavior, keyboard handling, accessibility attributes, and state coordination.
- Prefer the semantic native host demonstrated by the reference. Only expose alternative hosts where the Headless Kit supports them.
- Declare markup, component parts, children, refs, and public props using the established AirLib React composition pattern.
- Preserve supported event handlers, DOM attributes, accessible naming, form behavior, and consumer refs without replacing internal headless wiring.
- Preserve controlled/uncontrolled behavior where the reference supports it; do not invent an additional state model in the wrapper.
- Declare controller-mutated props with `Bindable<T>` rather than a plain `T`, for example `value: Bindable<T>`. Apply this to each prop the documented controller can update, preserving the documented optionality and binding semantics.
- Consume headless-generated attributes and tokens directly. Do not mirror them into local state, manually reconstruct them, or add inline conditional/nullish fallbacks for values already owned by the controller.
- Delegate class composition to the single resolver exported from `@airlib/aui/utils` and call it from the declaration, for example `className={resolveRoleClass('button', props, auiConfig.button)}`. Use `resolveFamilies` for structures composed from several roles. The resolver uses AirLib `classx`; components must not duplicate resolution logic, implement a competing class merger, or manually concatenate strings.
- Resolve `size`, `variant`, and `color` from explicit props first, then configured fallbacks inside the resolver. Keep fallback definitions centralized and separate from controller-owned values; do not spread ad hoc `{condition ?? fallback}` expressions through markup.
- Default `config.overrides` to `false`. In this mode, compose generated utility/component classes additively with `props.className`.
- When `config.overrides === true` and the consumer supplies a class, use only `props.className`: suppress generated base, utility, component, size, variant, and color-variant classes.
- A consumer class is exactly what `overrides` replaces. With no `props.className` there is nothing to override, so the generated classes are emitted as in additive mode.
- Class overrides affect presentation only; retain semantic hosts, Headless Kit behavior, refs, events, and accessibility/state attributes.
- Use stable `aui-*` class names. Compose shared structure classes before component-specific classes, for example `['aui-control', 'aui-button', 'aui-control-sm']`, followed by variant/color classes and the consumer classes in additive mode.
- Keep class composition reactive to supported prop/config changes using AirLib patterns. Do not freeze presentation props into a one-time class string.
- Presentation props select classes and tokens through the shared AUI vocabulary. Do not calculate colors, spacing, typography, or animation values in JavaScript.
- No CSS imports, CSS-in-JS, Tailwind utilities, or library-authored inline presentation styles. Importing AUI's TypeScript utilities must not import its CSS. Consumer-provided DOM styling remains a consumer concern.
- Any runtime positioning or sizing required by the Headless Kit remains owned by that kit; the React wrapper must not reproduce it.
- Without AUI CSS, components must remain semantically correct and operable. AUI supplies presentation, including visually hidden treatments where needed.
- Export public components and their props from the package entrypoint. Group compound parts with their owning component rather than invent unrelated standalone components.

### AUI CSS and TypeScript utilities

- Ship browser-valid CSS with no Tailwind processing, JavaScript initialization, or generated utility dependency. CSS must work independently of the optional TypeScript utility imports.
- Keep TypeScript utilities minimal and framework-agnostic: shared size/variant/color-variant types, configuration/fallback contracts, and reusable class-selection data or helpers needed by consumers. No React, AirLib runtime, DOM access, style injection, or component behavior in AUI utilities.
- Define one shared presentation vocabulary across components. Use `size`, `variant`, and `color` consistently; components expose applicable subsets rather than inventing synonyms for the same meaning.
- TypeScript utilities expose shared named constants, types, and class-selection data consumed by React AUI's resolver. Do not duplicate the resolver, reimplement `classx`, or generate CSS.
- Keep single-module constants local; export constants reused across modules from one owning module. Define shared size/variant/color-variant values once and derive types from that definition instead of repeating literal unions and lookup strings.
- Prefer CSS anchor positioning for positioning concerns and native `:hover`, `:focus`, `:focus-visible`, `:has()`, `:not()`, and headless attribute selectors for visual state. Do not add JavaScript conditionals, listeners, or state solely to reproduce what CSS can express.
- Preserve Headless Kit behavior that genuinely requires JavaScript. CSS-first presentation does not mean replacing its accessibility or interaction controller.
- Layer CSS in a fixed order: `theme`, then `base`, then `component`, then `utility`, then `reduced-motion`. Declare the cascade order once in `ui-kits/aui/src/index.css` and reuse it from every import mode; HTML class attribute order is not CSS precedence.
- `theme` owns tokens and theme defaults. `base` owns shared element defaults, optional reset, and keyboard focus treatment. `component` owns unique structure and component-token mappings, including the shared `.aui-control` action structure. `utility` owns reusable concerns — size, variant, color-variant, spacing, layout, text, and touch targets — and is declared after `component` so utilities can override component mappings.
- Whenever CSS rules repeat, extract the shared concern into a utility and compose it. Component-specific classes such as `.aui-control-sm` map shared size tokens to component tokens rather than duplicate shared size declarations.
- Reuse semantic tokens across variants and color variants so the same vocabulary produces consistent treatment across all components.
- Use native custom properties, selectors, pseudo-classes/elements, media queries, standard CSS imports, and cascade layers.
- Keep primitive/semantic theme tokens separate from component tokens. Preserve useful reference token names while exposing the `aui-*` class contract.
- Supply every shared token consumed by a shipped component, including values previously supplied implicitly by Tailwind.
- Drive presentation through tokens: use `calc(var(--spacing) * 4)` rather than fixed pixel spacing and `color-mix()` with color tokens rather than hard-coded component colors. Apply the same rule to sizing, typography, radii, borders, elevation, opacity, and motion.
- Define necessary literal design values once in primitive tokens; do not inline or repeat those values in utility/component declarations. Structural CSS keywords and arithmetic factors are not new design tokens.
- Keep component-specific token mappings with the relevant component CSS and permit application overrides without rewriting the component rules.
- Use the actual headless DOM contract for disabled, selected, expanded, checked, invalid, and other supported states. Do not invent duplicate state attributes for CSS.
- Scope styles to documented component hooks; avoid globally restyling unrelated HTML elements.
- Keep any global reset/default stylesheet explicitly opt-in. A component import must not impose a page-wide reset.
- Support theme inheritance and application token overrides, light/dark schemes, visible keyboard focus, reduced motion, and forced-color accessibility where applicable.
- Keep the package usable with equivalent non-React markup and consumers outside React. CSS and TypeScript utilities must not depend on framework internals.

### Import contract

The application chooses between loading the full library and loading individual component styles:

```tsx
import { Button } from '@airlib/react-aui';
import '@airlib/aui';
```

```tsx
import { Button } from '@airlib/react-aui';
import '@airlib/aui/components/widgets/button.css';
```

- Each component stylesheet imports its required theme/base/utility and compound-part dependencies. Importing Button alone must not require a hidden full-library import.
- The barrel imports the same component stylesheets, so selective and barrel imports produce equivalent presentation.
- Individual component imports must not pull unrelated component families.
- Use one consistent cascade order across selective imports, mixed imports, and the barrel. Define the `theme`, `base`, `component`, `utility`, `reduced-motion` order once in a shared dependency.
- Keep `@airlib/aui` as the CSS barrel and expose the framework-agnostic TypeScript utilities separately through `@airlib/aui/utils`, with compiled JavaScript and type declarations. Neither entrypoint imports the other.
- Add the AUI utility dependency to React AUI without introducing automatic CSS loading or a dependency from AUI back to React/Solid/DOM. `@airlib/core` in AUI utils is allowed and does not violate framework-agnosticity.
- Mark published CSS as side-effectful so application bundlers retain stylesheet imports. Keep the React package and AUI's TypeScript utilities tree-shakeable.
- Preserve and validate the existing AUI CSS bundle export. Package native CSS artifacts and compile TypeScript utilities as separate outputs; no Tailwind processing is required by either path.

## 4. File responsibilities

Create or update the following implementation targets. Reuse an existing implementation file if the corresponding component already has one.

| Target | Responsibility |
| --- | --- |
| `ui-kits/react-aui/src/index.ts` | Public component, prop-type, and configuration exports. |
| `ui-kits/react-aui/src/config.ts` | Re-export of `@airlib/aui/utils` as the single source of truth. No duplicate config; `overrides` defaults to `false`, per-role slots type-only (`button?: ComponentStyles`). |
| `ui-kits/react-aui/src/utils/common.ts` | Intentionally empty. The resolver lives once in `@airlib/aui/utils` (`resolveRoleClass` / `$class` via `classx` from `@airlib/core`); do not duplicate it here. |
| `ui-kits/aui/test/utils.test.ts` | Resolver precedence, configured fallbacks, shared class constants, additive mode, and replacement mode tests. |
| `ui-kits/react-aui/src/<group>/<Component>.tsx` | One component family and its compound parts, controller-mutated props typed as `Bindable<T>`, and class composition delegated to `resolveRoleClass`; PascalCase filenames within the shared group. |
| `ui-kits/react-aui/test/<group>/<Component>.test.tsx` | Controller binding, resolver integration, forwarding, and accessibility regression tests, mirroring source groups in the separate test tree. |
| `ui-kits/react-aui/src/<group>/index.ts` | Group component/type barrel, re-exported by the package entrypoint. |
| `ui-kits/react-aui/package.json` | JavaScript/types exports and the isolated `@airlib/aui` utilities dependency, without CSS imports. |
| `ui-kits/aui/src/theme/index.css` | Explicit primitive/semantic tokens and theme defaults in the `theme` layer. |
| `ui-kits/aui/src/index.css` | Canonical `theme`, `base`, `component`, `utility`, `reduced-motion` cascade order and the full-library CSS barrel, independent of TypeScript utilities. |
| `ui-kits/aui/src/base/index.css`, `ui-kits/aui/src/base/focus.css` | Shared scoped defaults and keyboard focus treatment in the `base` layer. |
| `ui-kits/aui/src/base/reset.css` | Explicitly opt-in global defaults, if required. |
| `ui-kits/aui/src/utilities/size.css` | Shared size tokens and utilities. |
| `ui-kits/aui/src/utilities/variant.css` | Shared visual variant utilities. |
| `ui-kits/aui/src/utilities/color-variant.css` | Shared semantic color-variant utilities. |
| `ui-kits/aui/src/utilities/layout.css`, `ui-kits/aui/src/utilities/spacing.css`, `ui-kits/aui/src/utilities/text.css`, `ui-kits/aui/src/utilities/touch.css` | Other shared concerns extracted from repeated component rules. |
| `ui-kits/aui/src/components/widgets/control.css` | Reusable `.aui-control` structure and treatment for action components. |
| `ui-kits/aui/src/utils.ts` | Framework-agnostic (only `@airlib/core`, no React/Solid/DOM) presentation vocabulary plus `auiConfig` / `configure` / `register` plus `resolveSize` / `resolveVariant` / `resolveColor` / `branded` plus `resolveRoleClass` / `$class` / `resolveFamilies` / `$families` plus the shared class constants and `AuiConfig` with type-only per-role slots, exported through `@airlib/aui/utils`. |
| `ui-kits/aui/src/components/<group>/<topic>.css` | Unique component rules and token mappings in the same group as React, including required theme/base/utility imports. |
| `ui-kits/aui/src/components/<group>/index.css` | Group stylesheet barrel. |
| `ui-kits/aui/src/components/index.css` | Component layer barrel importing the group barrels. |
| `ui-kits/aui/package.json` | Independent CSS and utilities exports, grouped CSS subpaths, selective CSS side effects, and CSS/JavaScript/type artifacts. |
| `apps/react-aui/pages/docs/getting-started.page.mdx` | Overview, installation/import modes, and grouped component index. |
| `apps/react-aui/pages/docs/nav.ts`, `apps/react-aui/pages/docs/layout.tsx` | Documentation navigation organized by the shared component groups and content shell. |
| `apps/react-aui/pages/docs/<group>/<topic>.page.mdx` | Overview, configurable interactive demo, usage with properties/applicable presentation dimensions, and related-component next steps. |
| `apps/react-aui/pages/docs/theming.page.mdx` | Tokens, CSS layers, shared size/variant/color vocabulary, framework-agnostic utilities, theme overrides, and selective imports. |

`<group>` is the shared component category, such as `widgets` or `composites`. Assign each component family a category from the source documentation and keep that assignment identical across React, AUI, and docs. `<Component>` is the PascalCase component name; `<topic>` is its kebab-case source slug. Button maps to these exact files:

- `ui-kits/react-aui/src/widgets/Button.tsx`
- `ui-kits/aui/src/components/widgets/button.css`
- `apps/react-aui/pages/docs/widgets/button.page.mdx`

Supporting topics such as `selection` should document and expose the appropriate composition contract; do not manufacture a rendered component solely to match a page filename. Shared theme/base/utilities remain outside component groups; the shared grouping rule applies to component families, not framework-specific infrastructure.

Keep docs-only layout styles within the docs scope and separate from library component styles. Live demos must use the actual React AUI components and AUI CSS through public entrypoints. Do not create demo-only component implementations or visual overrides that misrepresent the package output.

## 5. Component coverage and delivery order

Each source is `apps/air-web/pages/(docs)/aria/<topic>.page.mdx`. Each completed row must cover all public parts and documented states of its topics, not merely the first example.

These rows are delivery batches, not filesystem categories. Place each component in its shared category (`widgets`, `composites`, or another source-defined group) across React, AUI, and docs; do not turn batch labels into a second grouping system.

The references below are candidate mappings from the ARIA reference stylesheets and the AUI stylesheets already delivered, not claims of exact behavioral equivalence. Inspect and adapt each reference to the actual headless DOM contract during its implementation.

| Delivery batch | Source topics | Reference stylesheet / treatment |
| --- | --- | --- |
| First complete slice | `button` | `components/widgets/button.css`; required focus, touch, and state primitives. |
| Actions | `link`, `toggle`, `toggle-group` | Link, button, button-group, and segmented-button references as applicable. |
| Content and landmarks | `divider`, `image`, `header`, `main`, `footer`, `section`, `sidebar` | Divider, page, app-bar, and side-sheet references where appropriate; avoid invented visuals for semantic-only wrappers. |
| Navigation | `navigation`, `breadcrumb`, `toolbar`, `pagination` | Navigation layouts and toolbar; derive missing treatments from shared tokens. |
| Text and field composition | `field`, `text-input`, `search-input`, `code-input`, `number-stepper` | Field, text-field, textarea, and search-bar references; adapt to the source's actual inputs and parts. |
| Choice controls | `checkbox`, `checkbox-group`, `radio`, `radio-group`, `switch`, `slider` | Corresponding control styles and token-based group layouts. |
| Forms and files | `form`, `file-picker` | Compose existing controls; add only the missing form/file-specific presentation. |
| Collection selection | `option`, `selection`, `listbox`, `select`, `combobox` | List, select, field, and menu references where structurally applicable. |
| Disclosure and tabs | `disclosure`, `accordion`, `tabs` | Collapsible, accordion, and tabs references. |
| Overlays and menus | `popover`, `tooltip`, `dialog`, `confirm`, `menu`, `context-menu` | Overlay utilities, tooltip, dialog, and menu references; preserve the headless lifecycle. |
| Feedback | `announcer`, `progress`, `meter`, `toast` | Progress and snackbar references; preserve live-region semantics and distinguish progress from a meter. |
| Dates | `date-picker`, `date-range-picker` | Date-picker reference plus the source-defined range states and composition. |
| Structured data and search | `grid`, `tree`, `feed`, `reorder`, `search` | Table, list, and search-bar references where appropriate; grid is not assumed to be a native table. |
| Multi-part layout and progression | `carousel`, `splitter`, `stepper` | Carousel and layout references; token-based treatments for missing components. |

All 56 source topics are represented. Compound components can require more than one React export. Reference-only components such as avatars, badges, cards, color pickers, FABs, and windows are not automatically part of the React scope; shared internal styling dependencies can be reused without creating those public components.

## 6. CSS conversion procedure

Apply this procedure to the CSS dependencies of each delivered component rather than migrating the entire reference inventory up front.

| Reference construct | Native CSS conversion |
| --- | --- |
| `@theme` | Declare primitive/semantic custom properties in the `theme` layer, and component-token mappings in the `component` layer. Preserve inheritance and app overrides. |
| `@utility aui-button` | Split reusable action rules into `.aui-control` in the `component` layer; put unique Button rules/token mappings in `.aui-button` in the `component` layer. |
| `@apply ...` | Expand to native CSS declarations in the owning `theme`/`base`/`component`/`utility` layer. Extract repeated declarations into shared utilities instead of copying them into components. |
| `@extend ...` | Extract and compose shared utility classes or shared selectors. Do not inline repeated rule sets; CSS imports alone do not reproduce extension semantics. |
| Framework-only variants/directives/functions | Replace with native selectors, media queries, and CSS values; map sizes, variants, and color variants to the shared AUI vocabulary. |
| Implicit framework tokens or fixed component values | Define primitive values once, then reference semantic/component tokens; derive spacing with `calc()` and color treatments with `color-mix()`. |

- [ ] Follow the component's variable references and utility dependencies until every required declaration is available through its selective import.
- [ ] Preserve meaningful reference variants, sizes, focus treatment, disabled treatment, typography, and motion using the shared vocabulary; do not mechanically port unused utilities or inconsistent per-component names.
- [ ] Move repeated rules to the utility layer and replace fixed presentation values with token references before completing a component stylesheet.
- [ ] Evaluate native CSS features using the allowed `web-apis` skill. Use the browser support baseline for CSS anchor positioning as the compatibility ceiling; do not use features requiring newer support, even if present in the reference stylesheets.
- [ ] Prefer native anchor positioning and pseudo-class/attribute selectors over presentation-only JavaScript branches. Consume the Headless Kit's existing attributes and tokens instead of adding mirrored state or manual fallback expressions.
- [ ] Keep relative colors, `light-dark()`, nesting, and other native features only when they fit the anchor-positioning baseline. If support cannot be established from the allowed references, ask before adopting the feature; do not add speculative polyfills or compatibility machinery.
- [ ] Verify that pseudo-elements used for focus, touch targets, state layers, and icons do not compete for the same rendering slot.
- [ ] Ensure published CSS contains no unresolved Tailwind or custom preprocessing syntax and no imports into the reference files under `apps/air-web`.
- [ ] Verify selective imports in isolation; the full docs barrel can otherwise hide missing dependencies.

## 7. Implementation tasks

### Task 1: Deliver Button and the shared presentation contract

**Files:** `ui-kits/react-aui/src/index.ts`, `ui-kits/react-aui/src/config.ts`, `ui-kits/react-aui/src/widgets/index.ts`, `ui-kits/react-aui/src/widgets/Button.tsx`, `ui-kits/react-aui/test/widgets/Button.test.tsx`, `ui-kits/react-aui/src/utils/common.ts`, `ui-kits/aui/test/utils.test.ts`, `ui-kits/aui/src/utils.ts`, `ui-kits/aui/src/index.css`, `ui-kits/aui/src/theme/index.css`, `ui-kits/aui/src/utilities/size.css`, `ui-kits/aui/src/utilities/variant.css`, `ui-kits/aui/src/utilities/color-variant.css`, `ui-kits/aui/src/components/widgets/control.css`, `ui-kits/aui/src/components/widgets/button.css`, both package manifests/exports, and `apps/react-aui/pages/docs/widgets/button.page.mdx`.

**Consumes:** The documented Button Headless Kit contract, reference Button tokens/declarations, and the class/configuration contracts in Section 3.

**Produces:** Public `Button` and `ButtonProps`, configurable fallbacks, default-additive `classx` composition, shared AUI size/variant/color vocabulary and utilities, a self-contained Button stylesheet, and documentation/demo coverage under the matching `widgets` group.

- [ ] Define shared presentation constants/types and the configurable fallback contract in AUI utilities; expose React AUI configuration using those definitions with `overrides: false` as the default.
- [ ] Record the native host, ref forwarding contract, supported props, utility classes, component classes, and token mappings using only allowed skills and the Headless Kits documentation.
- [ ] Identify controller-mutated props from the documented contract and type each as `Bindable<T>` where applicable; do not infer mutation behavior from dependency source.
- [ ] Keep Button-only strings in local named constants and export shared class/presentation constants from their owning module.
- [ ] Write regression cases for a non-submitting default Button inside a form, explicit submit behavior, disabled activation, children, event forwarding, and consumer ref access.
- [ ] Add composition tests for configured fallbacks when props are absent, explicit props taking precedence, additive custom classes, replacement classes, and overrides enabled without a consumer class (generated classes retained).
- [ ] Test the small-Button class sequence `['aui-control', 'aui-button', 'aui-control-sm']` plus the applicable variant/color-variant classes, without depending on HTML class order for cascade precedence.
- [ ] Run those cases and confirm they fail for the missing behavior rather than a broken test setup.
- [ ] Implement and test the shared `resolveRoleClass` / `$class` resolver with `classx`, named class constants, configured fallbacks, and additive/replacement modes.
- [ ] Declare Button using the documented `setup` / `aria` pattern and `className={$families(['aui-control', 'aui-button'], props, auiConfig.button)}`. Keep generated attributes/tokens intact and retain Headless Kit behavior in both class modes.
- [ ] Establish the `theme`, `base`, `component`, `utility`, `reduced-motion` cascade order. Convert required tokens and extract shared action, size, variant, color-variant, focus, touch, and state rules into the appropriate layers.
- [ ] Keep Button CSS limited to unique structure and token mappings. Replace fixed presentation values with token references and native calculations; use CSS selectors for presentation state instead of JavaScript conditions.
- [ ] Wire selective CSS, the CSS barrel, and the isolated `@airlib/aui/utils` JavaScript/types export. Retain CSS side effects without importing styles through utilities.
- [ ] Write the Button page in this order: Overview, Interactive demo, Usage (Properties, Sizes, Variants, Color Variants), and Next Steps.
- [ ] Build the interactive demo with real React AUI controls for size, variant, color variant, fallback configuration, and class override mode. Bind controls to the rendered Button's props/configuration and use only the shipped AUI treatment for the component preview.
- [ ] Demonstrate additive custom classes, replacement classes, disabled/form behavior, and token overrides within the documented demo/usage sections.
- [ ] Verify live configuration changes, unstyled behavior, selective-import presentation, barrel presentation, keyboard activation, focus visibility, and light/dark rendering.

**Acceptance:** Button composes props and configurable fallbacks with `classx`; default mode adds consumer classes, while `config.overrides === true` replaces generated classes with a supplied consumer class and keeps them when none is supplied. Headless behavior remains intact. CSS imports are optional, both styled import modes agree, and AUI utility imports work without React or CSS side effects.

### Task 2: Establish the documentation shell and integration guide

**Files:** `apps/react-aui/pages/docs/getting-started.page.mdx`, `apps/react-aui/pages/docs/nav.ts`, and `apps/react-aui/pages/docs/theming.page.mdx`.

**Consumes:** The verified Button slice and package import contract.

**Produces:** A usable documentation entrypoint, component navigation, installation guidance, and theming guidance.

- [ ] When documentation conventions are needed, consult the relevant `apps/air-web` docs layout and load `airlib-markdown`; use `airlib-routing` for layout/route composition conventions. Keep reads concern-scoped and reference files unchanged.
- [ ] Follow those conventions while retaining the shared component groups and required page structure in Section 8.
- [ ] Explain the separation between Headless Kits, React declarations/class composition, and AUI CSS/TypeScript utilities.
- [ ] Document the required React/AirLib peer dependencies and AUI utility dependency using supported package versions.
- [ ] Show full-library and individual-component CSS imports, optional global defaults, framework-agnostic utility imports, and consumer token overrides.
- [ ] Document the shared size/variant/color-variant vocabulary, configurable fallbacks, `classx` composition, and `config.overrides` with default-additive and replacement examples.
- [ ] Explain the `theme`/`base`/`component`/`utility` layers and demonstrate one shared token or utility affecting multiple component families consistently.
- [ ] Build navigation using the same component groups as React and AUI. Add component and Next Steps links as their pages become available rather than publishing broken links.
- [ ] Apply the exact component page structure in Section 8 and keep the docs shell's presentation separate from the component CSS being demonstrated.
- [ ] Use the already-running server's AirLib route-scaffolding workflow for grouped documentation routes; do not hand-author generated route boilerplate or run dev/build commands.
- [ ] Verify grouped URLs, direct navigation, page reloads, Next Steps links, keyboard navigation, narrow-screen readability, and code example overflow.

**Acceptance:** Readers can install the packages, select an import mode, use Button, and customize its theme without consulting source files or requiring Tailwind.

### Task 3: Deliver the remaining component groups

**Files:** The per-topic React declarations/tests, CSS entrypoints, public barrels, and MDX pages defined in Sections 4 and 5.

**Consumes:** The established import/DOM contracts and each topic's own source documentation.

**Produces:** Complete component families, delivered one at a time in the dependency-aware order listed in the inventory.

For each topic, execute this checklist independently:

- [ ] Read its source page and only the relevant reference CSS/dependencies.
- [ ] Assign its shared component group and matching React/CSS/docs paths. Keep PascalCase React filenames and kebab-case CSS/docs filenames; add it to the corresponding group barrels and navigation.
- [ ] List public parts, host elements, accessible relationships, emitted attributes/tokens, supported states, keyboard interactions, form behavior, and state ownership from that source. Use allowed skills/documentation only; do not inspect dependencies to fill gaps.
- [ ] Mark controller-mutated props as `Bindable<T>` and specify tests for controller-to-consumer updates, supported controlled/uncontrolled behavior, ref/event composition, configurable fallbacks, and additive/replacement class modes.
- [ ] Confirm the tests expose missing wrapper behavior before implementing the declaration.
- [ ] Declare the React surface with the shared resolver — `className={resolveRoleClass(role, props, auiConfig[role])}`, or `resolveFamilies` for multi-role structures — after `register(role, defaults)`. Do not duplicate resolution logic, calculate presentation values in JavaScript, or reconstruct controller-owned attributes/tokens with manual fallback expressions.
- [ ] Map size, variant, and color props to the shared vocabulary. Keep component-only constants local and import/export shared constants rather than repeat magic strings.
- [ ] Convert component CSS to token-based declarations within the established layers. Extract every repeated rule set into a shared utility and keep only unique structure/token mappings in component rules.
- [ ] Prefer CSS anchor positioning, pseudo-classes, and headless attribute/token selectors for applicable presentation concerns. Reject newer-than-baseline CSS features and avoid JavaScript branches for states CSS already expresses.
- [ ] Add exports and an independently usable component CSS entrypoint, importing only the required theme, base, and utility dependencies.
- [ ] Write the grouped component page in the Section 8 order: Overview, Interactive demo, Usage with Properties and applicable Sizes/Variants/Color Variants, then Next Steps.
- [ ] Build the preview and its configuration controls from actual React AUI components and AUI CSS. Verify each supported selection updates the working component without demo-only implementation or styling substitutions.
- [ ] Verify behavior without AUI CSS, presentation through both CSS import modes, class overrides, cross-component utility consistency, and the relevant accessibility/interaction cases.
- [ ] Add the completed page to grouped navigation and related-component Next Steps links; record coverage for all documented public parts.

**Acceptance:** Each component family can be reviewed and consumed independently. A component is not complete while its CSS, docs, demo, or verification is missing.

### Task 4: Verify package delivery and complete coverage

**Files:** Existing React and AUI package manifests/entrypoints, the implementation's package checks, and docs pages affected by verification findings.

**Consumes:** All delivered component slices.

**Produces:** Consistent public exports, valid CSS artifacts, complete documentation coverage, and documented verification results.

- [ ] Reconcile the 56 source topics against implemented public parts and docs pages; account explicitly for supporting topics that do not introduce rendered components.
- [ ] Verify React's published JavaScript and declarations resolve every documented public export, including each advertised subpath.
- [ ] Verify the AUI root, component subpaths, and advertised bundle resolve to included CSS artifacts, and `@airlib/aui/utils` resolves to JavaScript and type declarations.
- [ ] Reconcile AUI's build/prepublish contract with separate native CSS packaging and TypeScript utility compilation; neither path depends on Tailwind.
- [ ] Confirm React and AUI utility imports do not cause CSS imports, CSS imports survive consumer bundling, and AUI utilities work without React/Solid imports, DOM access, or browser globals (`@airlib/core` allowed).
- [ ] Confirm selective CSS entrypoints contain all required theme/token/utility dependencies and no unrelated component families; layer precedence is identical across import modes and ordering.
- [ ] Audit shared size/variant/color vocabulary, configurable fallbacks, and additive/replacement class behavior across component families.
- [ ] Audit repeated CSS declarations and fixed presentation values; move shared concerns into utilities and literal design values into primitive tokens.
- [ ] Verify no shipped CSS depends on Tailwind, custom directive expansion, or reference files under `apps/air-web`.
- [ ] Check representative nested compositions, including controls inside dialogs, menus/popovers, forms, and repeated collection items.
- [ ] Verify server rendering and hydration for IDs, refs, state attributes, and browser-only headless lifecycles.
- [ ] Resolve documentation examples against the actual exported API and the tested CSS hooks.

**Acceptance:** All in-scope topics are accounted for, each public import is deliverable, and no unresolved packaging, behavior, styling, or documentation gap is described as complete.

## 8. Documentation contract per component

Follow the `apps/air-web` docs layout conventions and the `airlib-markdown` skill for MDX authoring and interactive demos. Consult only the relevant layout/topic when needed; do not invent a separate documentation convention.

Use this exact structure on every component page at `docs/<group>/<topic>.page.mdx`:

```
# AUI {Role}

{OVERVIEW}

{INTERACTIVE_DEMO}

## Usage
```

The interactive demo is an unlabeled `:::interactive` block between the overview prose and `## Usage` — never a `## Interactive demo` heading. Do not conflate the block with a section.

Documentation voice: pages describe what the component does and how to use it — never how it is implemented. No resolver/`classx`/`Bindable`/controller/headless-wiring internals, no test helpers, no token-variable dumps. Behavior (additive vs replacement classes, fallback precedence, keyboard support) is documented through usage and examples; token and layer mechanics belong to the theming guide.

### Overview

The overview is the prose directly after the `# Title` — never an empty `# Title` followed by a `## Overview` heading. Explain what the component is, why it exists, and the concern it addresses. Include its relationship to compound parts or Headless Kit behavior where relevant.

### Interactive demo block (no heading)

- Render the actual React AUI component with its actual AUI CSS. What the reader sees must be the component they receive from the packages, not a demo-specific recreation.
- Provide interactive configuration controls for applicable properties, including size, variant, and color variant. Bind those controls to the preview's real props/configuration so changes update the working component.
- Use React AUI components and AUI CSS for the demo controls as well as the preview; compose from components already delivered instead of introducing substitute UI implementations.
- Demonstrate configurable fallbacks and additive/replacement classes where applicable. Include meaningful behavioral states such as disabled, checked, expanded, or invalid according to the component contract.
- Keep presentation/layout styling for the demo container separate from the showcased component. Do not silently override component visuals to make the demo look different from the shipped CSS.
- Use the existing AirLib MDX interactive-demo pattern.

### Usage

Start with the React import, grouped component CSS import, and a minimal working example. Explain compound parts and composition where applicable; link to the full-library import guide instead of duplicating it on every page.

#### Properties

Document public props, supported values, configured fallbacks, events, refs, state ownership, and native host behavior. Show controller-mutated props as `Bindable<T>` and demonstrate their documented binding behavior. Explain resolver-based class composition and `config.overrides`, including default-additive behavior and replacement of generated classes by a supplied consumer class. Distinguish configurable presentation fallbacks from values/attributes/tokens already owned by the Headless Kit. Include relevant accessible naming, keyboard/focus behavior, and Headless Kit constraints with the properties they affect.

#### Sizes

Include only when sizes apply. Show supported shared size values, their configured fallback, working usage, and relevant size tokens/utilities.

#### Variants

Include only when variants apply. Explain supported visual variants using the shared vocabulary, their configured fallback, and working usage.

#### Color Variants

Include only when color variants apply. Explain supported semantic color variants, their configured fallback, working usage, and related theme tokens.

### Next Steps

Link to related components with a short explanation of the relationship or composition use case. Use the actual grouped documentation routes and do not publish links to pages that do not exist.

Do not copy reference-page demo styling, recreate components inside examples, or expose unsupported props solely for demonstration. Omit inapplicable Usage subsections rather than creating empty sections.

## 9. Verification requirements

Use the already-running documentation server for browser verification and inspect artifacts produced by the automatic build. Never run dev/build commands, start or restart a server, or invoke a test/check script that indirectly triggers dev/build. Run targeted tests only through standalone test tooling that respects these restrictions; avoid scripts that delete existing artifacts. If automatic output is unavailable or stale, report the blocker rather than triggering a manual build.

| Concern | Required evidence |
| --- | --- |
| Declaration behavior | Tests cover semantic host, accessible attributes, supported state transitions, event/ref composition, children, and form semantics. |
| Class composition | Component declarations call the dedicated `resolveRoleClass` / `$class` resolver. Its `classx` composition uses named constants, and explicit props override configured fallbacks. Supported prop/config changes update the output. |
| Override behavior | Default `overrides: false` adds `props.className`; with `true`, a supplied `className` emits only consumer classes, and no `className` keeps the generated classes. Behavior and accessibility remain intact. |
| Bindable contract | Every controller-mutated prop is typed as `Bindable<T>` with the documented optionality. Type checks and interaction tests cover supported controller/consumer updates without duplicate wrapper state. |
| Headless integration | Keyboard and focus behavior match documentation. Emitted attributes/tokens are consumed directly, without mirrored state or redundant manual fallback expressions. |
| Constants | No scattered magic strings. Single-module constants remain local; cross-module values use one exported definition. |
| CSS-first compatibility | Presentation uses anchor positioning, pseudo-classes, and headless attribute/token selectors where applicable; no presentation-only JavaScript substitutes or CSS features newer than the anchor-positioning baseline. |
| Styling independence | React works without AUI CSS; AUI CSS works with equivalent non-React markup; its TypeScript utilities run without framework, DOM, or CSS dependencies. |
| Shared language | Size, variant, and color-variant names/types and utility treatment agree across applicable component families. |
| CSS layers and isolation | `theme`/`base`/`component`/`utility` precedence is stable across import orders; selective and barrel modes agree; tokens/utilities resolve without Tailwind or docs globals. |
| CSS reuse and tokens | Repeated rules reside in shared utilities. Presentation values derive from tokens, `calc()`, and native color operations rather than fixed values duplicated in components. |
| Accessibility | Keyboard-only operation, visible focus, accessible names, relevant live-region behavior, forced-color treatment, and reduced motion. |
| Visual behavior | Browser inspection of variants, interaction states, light/dark themes, narrow layouts, long text, and relevant RTL cases. |
| Overlay/data edge cases | Focus return, Escape/dismissal, nested overlays, empty collections, disabled items, and dynamic content where supported by the source. |
| SSR and hydration | No server access to browser-only globals, hydration mismatch, unstable IDs, or broken headless attachment. |
| Distribution | Documented exports and CSS artifacts resolve in a consumer; CSS is not discarded as an unused side effect. |
| Group alignment | Every component's React, AUI, and documentation files use the same group; React filenames are PascalCase and CSS/docs filenames are kebab-case. Group barrels and public CSS imports resolve correctly. |
| Documentation | Pages follow Overview → Interactive demo → Usage (Properties and applicable Sizes/Variants/Color Variants) → Next Steps. Preview/configuration controls use actual React AUI and AUI CSS; selections update real props/configuration. Grouped navigation and related links work, and console/network checks show no introduced errors. |

Browser interaction is required to claim UI verification. Static review, type checking, and tests alone are not evidence that the demos render and behave correctly. If a check cannot be run, report it as unverified.

## 10. Completion criteria

- [ ] The ARIA reference topics and their public compound parts are fully accounted for.
- [ ] React AUI declarations delegate to the shared resolver, backed by `classx`, without authored styling or automatic AUI CSS imports.
- [ ] Configurable fallbacks, default-additive classes, and `config.overrides === true` replacement behavior are implemented consistently across components.
- [ ] Controller-mutated props use `Bindable<T>` and preserve the documented binding behavior.
- [ ] Headless Kits own behavior, accessibility coordination, and their emitted attributes/tokens; wrappers do not duplicate state or add redundant fallback expressions.
- [ ] Domain/class/configuration strings use local constants when local and a single exported definition when shared.
- [ ] Native CSS handles presentation where possible, with no features newer than the CSS anchor-positioning compatibility baseline.
- [ ] API implementation is based only on the allowed skills and Headless Kits documentation, without dependency source/declaration digging.
- [ ] AUI ships native CSS and minimal framework-agnostic TypeScript utilities through independent entrypoints, with no Tailwind/custom preprocessing dependency.
- [ ] Shared size/variant/color-variant vocabulary and `theme`/`base`/`component`/`utility` layers are consistent across component families.
- [ ] Repeated CSS rules are delegated to utilities, and presentation values derive from tokens instead of fixed component values.
- [ ] Both whole-library and component-specific CSS imports work independently of the docs app; TypeScript utilities load without CSS or framework dependencies.
- [ ] React declarations, AUI stylesheets, and documentation share component groups and consistent PascalCase/kebab-case filename mapping.
- [ ] Every component page follows Overview, Interactive demo, Usage (Properties and applicable Sizes/Variants/Color Variants), and Next Steps.
- [ ] Interactive previews and configuration controls use actual React AUI components and AUI CSS; changes affect the real component rather than a demo-specific recreation.
- [ ] Grouped navigation, component imports, and related-component Next Steps links resolve correctly.
- [ ] Package artifacts, behavior, accessibility, themes, and browser interactions have verification evidence.
- [ ] Source documentation, the reference stylesheets, and unrelated project files remain unchanged unless separately authorized.

## 11. Locked decisions

These decisions are fixed and constrain implementation.

### 11.1 Bindable contract

- `Bindable<T>` is only for props the controller writes to (read + write, e.g. `value`).
- Inputs the controller only reacts to (e.g. `disabled`, `type`, `size`, presentation props) stay plain — not `Bindable`.
- Button therefore declares `type?: 'button' | 'submit' | 'reset'` and `disabled?: boolean` as plain props, has no `value` prop, and uses no `Bindable`. Add `Bindable<T>` only for a topic whose documented contract proves the controller writes that prop.

### 11.2 Shared presentation vocabulary

- Sizes: `xs | sm | md | lg | xl | xxl`.
- Variants: `filled | elevated | tonal | outlined | text`.
- Colors: `primary | secondary | tertiary | error | success | warning | info` — the prop is `color` (short DX names, never `colorVariant`).
- Fallbacks: `size=md`, `variant=filled`, `color=primary`.
- Defined once in `@airlib/aui/utils` (`ui-kits/aui/src/utils.ts`) and reused by `ui-kits/react-aui/src/config.ts` and the resolver. No duplicated literal unions.

### 11.3 CSS compatibility

- Keep reference `light-dark()` and `oklch(from var(--seed-color) ...)` relative colors as written in native CSS.
- Anchor positioning is the baseline and the ceiling; `light-dark()` and relative colors are covered by that baseline. Do not conservatively rewrite them unless verification proves otherwise.
- Still convert `@theme` → `theme` layer tokens, `@utility` → the shared `component` layer structure, `@apply` → native declarations, `@extend` → shared utility composition.
- Token prefix is `--aui-`, not `--air-`. Rename reference `--air-*` component tokens to `--aui-*` during conversion (e.g. `--air-button-height` → `--aui-button-height`). Global primitive/semantic tokens (`--spacing`, `--color-*`, `--radius-*`, `--font-*`, etc.) stay as they are unless they carry the `--air-` prefix, in which case they also become `--aui-*`.
- Cascade order is `theme, base, component, utility, reduced-motion`, declared once in `ui-kits/aui/src/index.css`.

### 11.4 Demo controls

- Demo configuration controls use real React AUI components and AUI CSS.
- When a control a demo needs (for example a select or a toggle) is not delivered yet, build that minimal AUI slice first rather than substituting a native-only or demo-only implementation.

### 11.5 Config plumbing

- No provider and no React context. React is only a renderer.
- Global configuration goes through `import { configure } from '@airlib/react-aui'; configure({ ... })`.
- The resolver takes fallback values only (`size`/`variant`/`color`) and reads the replacement flag itself from global config — never from parameters, never from the caller.
- `auiConfig.overrides` defaults to `false` (additive). When it is `true` and the consumer supplies a class, the resolver emits only that class, suppressing every generated class. With no consumer class there is nothing to override, so the generated classes are emitted normally.

### 11.6 Skills per task

- Task 1: `airlib` (core and routing to domain skills); `airlib-ui` `contents/components.md` (setup vs template, `Bindable` two-way contracts) and `contents/styling.md` (`classx`, utility extraction); `web-apis` `contents/css-features.md` (native baseline evaluation); `airlib-markdown` `contents/code-demos.md` (interactive demo anatomy); `airlib-testing` (`withContext` and testing-library patterns).
- Task 2: additionally `airlib-routing` and the `airlib-markdown` router topics for the docs shell.
