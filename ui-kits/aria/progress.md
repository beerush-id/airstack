# ARIA Package — TDD Implementation Tracker

> **SCOPE LOCK: `ui-kits/aria` only.** This file is the compaction-proof goal memory. If context is compacted, re-read `spec.md` + this file + the single focused role spec. Nothing else.
>
> **BANS (absolute): GIT IS BANNED — never run git commands. NO DESTRUCTIVE ACTIONS — no delete/overwrite/reset of source or tests except the single TDD target file via RED→GREEN. NO CODE COMMENTARY — never add clarification, rationale, personal notes, report references, or parity remarks as source or test comments; code must be self-explanatory, describe/it strings carry test intent, rationale lives in specs and this tracker. Tracker edits here are the only free writes.

## 1. Goal (do not lose)

- **Implement all specs in `ui-kits/aria/specs/` and verify each with TDD, role-driven bottom-up, one spec at a time.**
- Each spec must deliver what it promises and do it well before moving on.
- Tests are DX-first: developer usage perspective first (`<role>.test.ts`), then coverage (`<role>.coverage.test.ts`).
- `spec.md` + `specs/` are the source of truth. `src/` is never the driver for tests.
- **Bottom-up = role-first, not core-first. Core exists to serve roles. Never pre-map utilities/core without a failing role test demanding it.** Utilities emerge only as demanded by the current role's RED.

Done per spec = both test files green + coverage report at 100% on every column for the role's source file(s) + role documented in `apps/air-web/pages/(docs)/aria` for developers. Done overall = every spec below is `[x]` with all three complete, no spec conflicts open.

## 2. Non-negotiable rules

1. **TDD Iron Law:** no production code without a failing test first. RED → verify RED fails for the right reason → GREEN minimal → verify GREEN → REFACTOR.
2. **Spec-driven, never implementation-driven:** during RED, read only `spec.md` + the single focused role spec. Do NOT read `src/` to design tests.
3. **Conflict gate (mandatory):** if a spec has conflict, contradiction, or incompleteness, STOP. Report to user and confirm before any TDD on that spec.
4. **Existing tests:** may be outdated but their concern may still be valid. Do NOT change/replace expectations unless they conflict with the spec. If conflict, report first.
5. **DX is the verdict:** the package exists to serve developers. Any API that degrades DX is a failure — report to discuss, do not silently implement.
6. **One spec at a time:** single focus pointer in §5. No parallel spec work. No broad `src/**/*.ts` digs (web-apis Hard Gate).
7. **Test layout per role:**
   - `test/<area>/<role>.test.ts` — usage-based, developer perspective (SSR → Mount → Interaction → Teardown).
   - `test/<area>/<role>.coverage.test.ts` — edge cases, guards, reconciliation, teardown completeness.
   - Wrap in `withContext` per `airlib-testing` (sync asserts, `act()` for DOM, mock only external I/O).
8. **No commentary in code:** no clarification, rationale, personal notes, report references, or parity remarks as comments in source or tests — ever. Minimal factual API docs matching the file's existing convention are the only exception. Rationale belongs in specs and this tracker, never beside the code.
9. **Native parity on custom hosts:** a role that has a native element MUST behave like the native element when bound to a custom host. Custom-host gaps vs native behavior (activation, modifier/middle-click, disabled lockout, semantics) are spec violations, not enhancements. Link proved it: Enter synthesis, Ctrl/Cmd/Shift + middle-click new-tab, disabled lockout on both hosts.

## 3. Bottom-up order (role-first, demand-driven)

Correction: earlier version listed Foundation first — that was backwards and code-driven. Core/utils serve roles; they are proven only through a concrete role's failing usage test. So: start from the smallest concrete role, let core emerge on demand. Never inventory or pre-build utilities.

### First role (start here)
- [x] `specs/widgets/button.md` — FIRST ITEM (tests 28/28 green, coverage 100% all columns, docs closed by user). Demand-driven: only the `spec.md` core pieces button's RED actually needs (`.attributes` value plane, `.current`/`.ref`, `.props`, `native` vs pure-ARIA, `.refine`/`.destroy` as used) get touched. Nothing else.

### Then leaf widgets (single element, in demand order)
Tier W1 — primitives / stateless (button already tracked above, do not repeat):
- [x] `specs/widgets/divider.md` — DONE (tests 8/8, divider.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/link.md` — DONE (usage + coverage green, link.ts + context.ts 100% all columns, docs to spec contract; incl. custom-host `auxclick` middle-click parity).
- [x] `specs/widgets/image.md` — DONE (usage 6/6 + coverage 8/8, image.ts 100% all columns, docs to spec contract; status report-only, unit-owned loader, epoch invalidation).
- [x] `specs/widgets/alert.md` — CONSOLIDATED into announcer (user decision 2026-10-05): assertive urgency compiles `role="alert"`; `AlertAria`/spec/tests removed, alert doc page is a migration redirect. Alert's old contract is covered by announcer's assertive tests.

Tier W2 — boolean / selectable leaf:
- [x] `specs/widgets/toggle.md` — DONE (usage 13/13 + coverage 3/3, toggle.ts 100% all columns, docs to button-voice convention; fixed shared listener-order bug + change events). Ruling: disabled custom hosts keep `tabindex="-1"` (tests + parity with link win over the spec table's "removed"; stale F-89 note superseded).
- [x] `specs/widgets/checkbox.md` — DONE (usage 24/24 + coverage 10/10, checkbox.ts 100% all columns, docs to button-voice convention). Rulings: tests win — separate `indeterminate` prop (spec amended), disabled custom keeps `tabindex=-1` (number in `.attributes`), `invalid` kept (spec amended); mixed activation resolves toward checked via `toggle()` override; custom commits fire `change`+`input`; `aria-checked` shielded from refiners; explicit `aria-required="false"` baseline on custom. Incidental: fixed ambient `selectionGroup` leak in disposal test (set moved inside tree).
- [x] `specs/widgets/radio.md` — DONE (usage 17/17 + coverage 12/12, radio.ts 100% all columns, docs to button-voice convention). Rulings: tests win — spec amended for standalone projection, disabled composition, member-vs-group keyboard split, roving tabindex, form isolation, value plane, teardown; select-only setter (`checked=false`/`deselect()`/re-activation are no-ops); `aria-checked` shielded from refiners; `value`/`name`/`aria-checked` in ownKeys; `role` stays consumer-refinable (checkbox parity). Incidental: fixed ambient `selectionGroup` leak in disposal test (set moved inside tree).
- [x] `specs/widgets/switch.md` — DONE (usage 11/11 + coverage 14/14, switch.ts 100% all columns, docs to button-voice convention). Rulings: tests win — spec amended (checked projection not on, Enter inverts on keydown, button-native keeps ARIA mirrors, group-disablement cascades, disabled custom tabindex -1). Incidental root-cause fix in `selection.ts`: `coordinated` guard — valueless members stay local (fixing the group-lockout re-arm failure) while still inheriting disabled; switch adds custom-host `input` dispatch + `value`/`name`/`aria-checked` shielding (checkbox/radio parity). Full-suite failures otherwise identical to baseline (future-scope only).
- [x] `specs/widgets/option.md` — DONE (usage 16/16 + coverage 11/11, option.ts 100% all columns, docs to button-voice convention). Rulings: tests win — spec amended (toggle opt-in, optional-deselect with required refusal, member owns no keystroke, native selected sync, shielding list, value-based claiming, label deferred). Incidental root-cause fixes: `selected` IDL sync in `applyAttributes` (HTMLOptionElement branch mirroring inputs); claim guard is now value-based with hint-or-required gating (repaired a radio regression the first cut caused: idempotent-alone never claims). 403's incidental holder-click re-aimed at sibling activation (same stability intent, stronger). Full-suite failures otherwise identical to baseline (future-scope only). Post-close fix (docs report): the `coordinated` guard read reactive props in the SelectionAria constructor, freezing reads into docs setup() scope — the check now lives inside the existing $static claim gate, with a red-proven regression test (`expected ['value'] to deeply equal []` without the fix).

Tier W3 — inputs & ranges:
- [x] `specs/widgets/text-input.md` — DONE (usage 18/18 + coverage 7/7, text-input.ts 100% all columns, docs to button-voice convention). Rulings: tests win — direct label/invalid props with explicit false baseline, custom disabled tabindex -1, Escape-revert + input-synthesis deferred (untested). Incidental GREEN: custom branch (kind roles, ARIA mirrors, blur-commit with disabled withhold), kind/multiline props, type omission for getter-only hosts. Full-suite failures otherwise identical to baseline (future-scope only).
- [x] `specs/widgets/search-input.md` — DONE (spec retired as text-input alias; usage 6/6 + coverage 6/6, text-input.ts 100% all columns, docs rewritten to button-voice convention with top-level demo style). Rulings: tests win — dedicated face locks `type="search"` natively, `role="searchbox"` on custom, explicit `aria-required` on the native search face, and IDL `value` sync for input/textarea in shared `applyAttributes` (attribute reflection alone leaves a dirty field stale); Escape stays platform-owned, Escape-revert defer stands. Full-suite failures otherwise identical to baseline (future-scope only).
- [x] `specs/widgets/file-picker.md` — DONE (usage 6/6 + coverage 5/5, file-picker.ts 100% all columns, docs to button-voice convention with top-level demo style). Repairs (tests, not weakened): document-delegation test appends the host (detached nodes can't reach `document`), consumer veto uses `{capture: true}` per repo convention (internal-first bubble order); cancel detail asserts `null` (CustomEvent default); files mapped via instance `defineProperty` (no DataTransfer in jsdom); constraints sync through an `effect()` in `attach()` (the update observer never tracks props read outside `createAttributes`). Full-suite failures otherwise identical to baseline (future-scope only).
- [ ] `specs/widgets/slider.md`
- [ ] `specs/widgets/stepper.md`
- [ ] `specs/widgets/number-stepper.md`
- [ ] `specs/widgets/progress.md`
- [ ] `specs/widgets/meter.md`
- [ ] `specs/widgets/splitter.md`

Tier W4 — disclosure & overlays (need scope/refiner injection):
- [ ] `specs/widgets/disclosure.md`
- [ ] `specs/widgets/dialog.md`
- [ ] `specs/widgets/confirm.md`
- [ ] `specs/widgets/tooltip.md`
- [ ] `specs/widgets/popover.md`

### Layer 2 — Composites (compose Layer 1)
Tier C1 — direct groupings:
- [ ] `specs/composites/radio-group.md` (needs radio)
- [ ] `specs/composites/checkbox-group.md` (needs checkbox)
- [ ] `specs/composites/toggle-group.md` (needs toggle)
- [ ] `specs/composites/toolbar.md` (roving takeover, focus-only)
- [ ] `specs/composites/listbox.md` (needs option)

Tier C2 — selection / paired structure:
- [ ] `specs/composites/select.md`
- [ ] `specs/composites/combobox.md`
- [ ] `specs/composites/tab.md`
- [ ] `specs/composites/accordion.md`

Tier C3 — menus / trees / grids / forms:
- [ ] `specs/composites/menu.md`
- [ ] `specs/composites/context-menu.md`
- [ ] `specs/composites/tree.md`
- [ ] `specs/composites/grid.md`
- [ ] `specs/composites/field.md`
- [ ] `specs/composites/sort.md`

Tier C4 — complex / composed:
- [ ] `specs/composites/code-input.md`
- [ ] `specs/composites/date-picker.md`
- [ ] `specs/composites/date-range-picker.md`
- [ ] `specs/composites/pagination.md`
- [ ] `specs/composites/breadcrumb.md`
- [ ] `specs/composites/carousel.md`
- [ ] `specs/composites/reorder.md`
- [ ] `specs/composites/toast.md`
- [ ] `specs/composites/feed.md`

### Layer 3 — Landmarks & Live (static, independent, last)
- [ ] `specs/landmarks/landmarks.md` (overview)
- [ ] `specs/landmarks/header.md`
- [ ] `specs/landmarks/main.md`
- [ ] `specs/landmarks/navigation.md`
- [ ] `specs/landmarks/sidebar.md`
- [ ] `specs/landmarks/footer.md`
- [ ] `specs/landmarks/search.md`
- [ ] `specs/landmarks/form.md`
- [ ] `specs/landmarks/section.md`
- [x] `specs/live/live-regions.md` (overview) + `specs/live/announcer.md` — DONE via consolidation (11/11 live tests, live.ts 100% all columns, announcer doc updated with alert role, alert page redirects). Role switch: assertive → `role="alert"`, otherwise `status`; native `<output>` omits role. Incidental fix: explicit `busy: false` now projects `aria-busy="false"` (mirrors `declaresAtomic`).

## 4. Per-spec workflow (repeat for each checkbox)

1. Read `spec.md` section + single role spec ONLY. List promised developer-observable behaviors. No `src/` reads, no git, no broad searches.
2. Scan existing `<role>.test.ts` concern only — keep expectations unless spec-conflicting. Never edit other roles' tests.
3. **Conflict check:** contradictions / gaps / DX degradation? If yes → report + wait. If no → proceed.
4. RED: write `<role>.test.ts` (usage-first, developer perspective), run, verify it fails for the right reason.
5. GREEN: minimal production code to pass ONLY what the failing test demands (core/utils pulled on demand). Verify green. No drive-by refactors, no destructive actions.
6. RED/GREEN for `<role>.coverage.test.ts`. Verify green.
7. REFACTOR (green only).
8. COVERAGE REPORT: run coverage for the role's source file(s); require 100% on all columns (stmts/branch/funcs/lines). Fix causes, never weaken assertions or suppressions. Attach or cite the report. Weigh every uncovered line by what is written: redundant defensive branch, unreachable, or YAGNI violation → remove the code; no-else-by-design → add istanbul ignore; legit but not worth a test → add istanbul ignore. Prefer a behavior test over an ignore whenever the branch states a real contract.
9. DOCUMENT: write/update the role page under `apps/air-web/pages/(docs)/aria` for developers (the readers). Retired/alias specs (e.g. `search-input`) keep their docs page live under the same convention — never orphan a page when its spec is superseded; it documents the face, not the sheet. Overview opens problem → answer (`# AirLib Headless <Role>`, the struggle, then how `aria('<role>')` solves it). Then: usage with code first, props/options, states/events, accessibility notes. Docs are DX deliverables, not afterthoughts. Demo styling lives in a top-level `<style>` block under fixed `demo-*` classes — never Tailwind or utility noise inside demo component code; state-driven visuals key off ARIA attributes, and no established visual state is ever dropped in a rewrite.
10. Mark `[x]` only when tests + 100% coverage + docs are all complete. Advance focus pointer.

## 5. Focus pointer (only one at a time)

- [x] `specs/widgets/link.md` — DONE (tests 18/18, link.ts + context.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/image.md` — DONE (tests 14/14, image.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/alert.md` — DONE (tests 10/10, alert.ts 100% all columns, docs to button-voice convention).
- [x] `specs/widgets/toggle.md` — DONE (tests 16/16, toggle.ts 100% all columns, docs to button-voice convention).
- [x] `specs/widgets/radio.md` — DONE (tests 29/29, radio.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/switch.md` — DONE (tests 25/25, switch.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/option.md` — DONE (tests 27/27, option.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/text-input.md` — DONE (tests 25/25, text-input.ts 100% all columns, docs to spec contract).
- [x] `specs/widgets/search-input.md` — DONE (retired alias; tests 12/12, text-input.ts 100% all columns, docs to button-voice convention).
- [x] `specs/widgets/file-picker.md` — DONE (tests 11/11, file-picker.ts 100% all columns, docs to button-voice convention).
- **Current:** `specs/widgets/slider.md` — next role.
- **Ruling (ownership):** controllers own their consumed input keys via `omittedAttrs` pushes at role level (checkbox/radio convention) — `ownKeys` is output attribute names plus consumed input names. Completed: live (`politeness`/`atomic`/`busy`/`relevant`), link (`current`), image (`src`/`alt`/`status`), toggle (`value`), checkbox (`value`); radio/switch/option/text-input already complete; `role`/`type`/`disabled`/`tabindex`/`aria-disabled` owned once in core via `COMMON_ATTRIBUTES` (button/link/file-picker carry no common-key pushes); divider's `orientation` covered globally. `label` stays manual where the component reads it directly (announcer). Docs `restProps([...])` lists now carry only component-consumed keys. RED-proven by new `Attribute Shielding Contract` ownKeys tests (7 files); full role suites green with 100% retained.
- **Next:** `specs/widgets/divider.md` (only after button reaches full `[x]`).
- **Explicitly NOT started:** foundation-in-vacuum, utils mapping, composites, landmarks/live. Core pieces are pulled on demand by button's RED only.
- **Blocked / conflicts:** none.

## 6. Status legend

- `[ ]` not started · `[~]` in progress (tests green but coverage/docs pending) · `[x]` tests green + 100% coverage all columns + docs complete
- Update this file on every spec completion: checkbox + focus pointer. Never batch-mark.
