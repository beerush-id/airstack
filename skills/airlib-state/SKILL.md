---
name: airlib-state
description: Use when declaring reactive state, managing mutations, deriving computed values, running side-effects, executing async queries, managing collections, or scoping state in an AirLib project
---

# AirLib State Router

The routing guide for state management and reactivity in **AirLib**.

IMPORTANT: Read only what you need. Match your state problem or question to the matrix below, then read only the corresponding topic document in `contents/`. Do not load all files into context.

---

## State Decision Matrix: What are you building?

| What question are you trying to answer? | Topic Guide to Read |
|---|---|
| **"How do I create reactive state, mutate properties in-place, or validate data shapes?"** | [contents/mutable.md](./contents/mutable.md) |
| **"How do I create read-only state for consumers while restricting writes to a contract?"** | [contents/immutable.md](./contents/immutable.md) |
| **"How do I compute derived values, build stable ViewModels, or aggregate collections in $O(1)$?"** | [contents/derived.md](./contents/derived.md) |
| **"How do I run side-effects on data change, read state without subscribing, or handle cleanup?"** | [contents/effects.md](./contents/effects.md) |
| **"How do I fetch async data, handle loading/error status, cancel requests, or do optimistic updates?"** | [contents/async.md](./contents/async.md) |
| **"How do I manage large virtualized datasets, track row selection, or sort without GC churn?"** | [contents/collections.md](./contents/collections.md) |
| **"How do I choose between global, headless, local, and cookie-persisted state without SSR leaks?"** | [contents/scoping.md](./contents/scoping.md) |

---

## Symbol & Code Lookup

Saw a symbol, function, or primitive in existing code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `mutable`, `count.value`, `recursive` | [contents/mutable.md](./contents/mutable.md) |
| `immutable`, `writable`, `inherit`, `override` | [contents/immutable.md](./contents/immutable.md) |
| `derived`, `derived.as`, `derived.reduce`, `get [property]()` | [contents/derived.md](./contents/derived.md) |
| `effect`, `effect.client`, `effect.async`, `untrack`, `awaited`, `snapshot`, `stringify`, `subscribe`, `sleep`, `debouncer`, `microtask`, `microbatch` | [contents/effects.md](./contents/effects.md) |
| `query`, `query.data`, `query.status`, `query.start`, `query.abort`, `query.promise`, `undoable` | [contents/async.md](./contents/async.md) |
| `superList`, `superList.values`, `superList.selection`, `superList.select`, `superList.toggle` | [contents/collections.md](./contents/collections.md) |
| `cookies`, `cookiePair`, `syncCookies`, `createContext` | [contents/scoping.md](./contents/scoping.md) |

---

## Questions & Tasks Covered by Each Topic

### [Mutable State & Deep Reactivity](./contents/mutable.md)
Load this topic when you need to answer:
- How do I declare reactive state so that changing a property automatically updates the UI?
- How do I mutate nested objects or arrays without spread operators (`...state`) or `setState`?
- How do I make primitive values (numbers, strings, booleans) reactive?
- How do I prevent deep proxy recursion overhead on large nested datasets?

### [Immutable State & Write Contracts](./contents/immutable.md)
Load this topic when you need to answer:
- How do I expose read-only state to consumers to prevent accidental mutations?
- How do I create a private write contract for authorized state modifications?
- How do I restrict a write contract to specific allowed property keys (least-privilege writers)?
- How do I merge props non-destructively without stripping fine-grained reactivity (`override`)?
- How do I deeply layer default and override configurations (`inherit`)?

### [Derived State & Computed Values](./contents/derived.md)
Load this topic when you need to answer:
- When should I use inline getters vs standalone computed signals?
- How do I combine multiple independent state sources into a single reactive calculation?
- How do I create multi-property ViewModels with stable references and direct property access?
- How do I incrementally aggregate large collections without $O(N)$ re-scans?

### [Side Effects & Dependency Tracking](./contents/effects.md)
Load this topic when you need to answer:
- How do I run side-effects automatically whenever reactive dependencies change?
- How do I clean up resources (timers, event listeners) when an effect re-runs or unmounts?
- How do I read reactive state inside an effect without subscribing to it?
- How do I serialize reactive state safely into plain JSON without over-subscribing?
- How do I restrict DOM side-effects to the browser during SSR?
- How do I maintain dependency tracking across asynchronous gaps (`await`)?
- How do I subscribe globally to any mutation in an object tree?

### [Asynchronous State & Queries](./contents/async.md)
Load this topic when you need to answer:
- How do I manage async data fetching with automatic status tracking (`pending`, `success`, `error`)?
- How do I avoid optional chaining with structural initial data?
- How do I defer an async request until a user action or manual trigger?
- How do I implement search-as-you-type with automatic cancellation of in-flight requests?
- How do I perform optimistic UI updates via direct mutation of async state?
- How do I await async queries during SSR or in route loaders?

### [Large Collections & Virtualization](./contents/collections.md)
Load this topic when you need to answer:
- How do I eliminate garbage collection churn during virtualization using memory-reused row slots?
- How do I track multi-row checkbox selection automatically without manual `Set` plumbing?
- How do I filter rows without mutating array indices or allocating new arrays?
- How do I automatically insert incoming items into sorted order using continuous binary search?

### [State Scoping, Architecture & Cookies](./contents/scoping.md)
Load this topic when you need to answer:
- When should state remain strictly local to a component instance?
- How do I build headless domain stores (factories or classes) decoupled from UI presentation?
- How do I share state across a component tree without prop drilling or server request pollution?
- How do I manage persistent state synchronized across server and browser using cookies?
- How do I avoid hydration mismatches when reading cookies on static pre-rendered pages?
- When is global module state safe to use, and why does it cause cross-request data leaks in SSR?
