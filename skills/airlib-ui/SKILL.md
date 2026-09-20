---
name: airlib-ui
description: Use when building UI components, reactive views, fine-grained rendering, browser signals, or responsive images in an AirLib project
---

# AirLib UI Router

The routing guide for user interface development in **AirLib**.

IMPORTANT: Read only what you need. Match your problem or goal to the matrix below, then read only the corresponding topic document in `contents/`. Do not load all files into context.

---

## UI Decision Matrix: What are you building?

| What question are you trying to answer? | Topic Guide to Read |
|---|---|
| **"How do I create a component, manage its state, or bind two-way state with a parent?"** | [contents/components.md](./contents/components.md) |
| **"How do I create a component with customizable sections, fallback content, or scoped slot data?"** | [contents/slots.md](./contents/slots.md) |
| **"How do I update only a specific piece of the UI or conditionally show elements?"** | [contents/rendering.md](./contents/rendering.md) |
| **"How do I listen for keyboard hotkeys, track mouse cursor, or capture copy/paste?"** | [contents/browser.md](./contents/browser.md) |
| **"How do I render optimized, responsive images without layout shifts?"** | [contents/images.md](./contents/images.md) |
| **"How do I toggle CSS classes dynamically or manage themes?"** | [contents/styling.md](./contents/styling.md) |
| **"How do I set page title, meta tags, Open Graph cards, or structured JSON-LD data?"** | [contents/head.md](./contents/head.md) |

---

## Symbol & Code Lookup

Saw a symbol, component, or utility in existing UI code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `setup`, `template`, `$bind`, `Bindable`, `createContext`, `setContext`, `getContext`, `renderDynamic`, `$use`, `derived`, `onMount`, `onCleanup`, `uuid`, `shortId`, `uIndex` | [contents/components.md](./contents/components.md) |
| `<Slot>`, `<Component.Snippet>`, `snippets` | [contents/slots.md](./contents/slots.md) |
| `<Snippet>`, `snippet()`, `<Show>`, `<For>` | [contents/rendering.md](./contents/rendering.md) |
| `LIVE_KEYBOARD`, `LIVE_CURSOR`, `LIVE_SCROLL`, `LIVE_SELECTION`, `LIVE_DND`, `LIVE_MEDIA`, `LIVE_WINDOW`, `LIVE_NETWORK`, `LIVE_GEO`, `LIVE_CLIPBOARD`, `acceptInteractions`, `cursorRef`, `scrollRef`, `keyboardRef`, `mediaQuery` | [contents/browser.md](./contents/browser.md) |
| `<Image>`, `?asset` | [contents/images.md](./contents/images.md) |
| `classx`, `stylex` | [contents/styling.md](./contents/styling.md) |
| `<Head>`, `Head.config` | [contents/head.md](./contents/head.md) |

---

## Questions & Tasks Covered by Each Topic

### 1. [Components & Views](./contents/components.md)
Load this topic when you need to answer:
- When should I use native HTML markup vs a lightweight presentation view vs a stateful component?
- How do I build a self-governing component that manages its own state and behavior?
- How do I establish two-way state binding with a parent component without writing manual callback event plumbing?
- How do I build compound components (like Accordions, Tabs, or RadioGroups) coordinated via ambient context?
- When should I render children directly vs handling polymorphic render props?
- How do I hook into component mount and unmount lifecycles?
- How do I inject dependencies or access context?

### 2. [Component Slots](./contents/slots.md)
Load this topic when you need to answer:
- How do I create a component with customizable layout regions (e.g. sidebar, header, footer) and default fallback content?
- How do I inject custom markup into specific named sections of a child component?
- How do I pass internal component state into a customizable slot so the consumer can render it?

### 3. [Fine-Grained Rendering](./contents/rendering.md)
Load this topic when you need to answer:
- How do I update a fast-changing counter or metric without re-rendering the surrounding layout?
- How do I isolate reactive updates to an inline fragment or a named sub-view?
- How do I conditionally show or hide elements based on async loading, success, or error states?
- How do I safely render polymorphic child content (static elements, accessors, or render functions)?

### 4. [Browser Signals](./contents/browser.md)
Load this topic when you need to answer:
- How do I listen for keyboard hotkeys and modifier combinations across the app?
- How do I track mouse cursor coordinates, active mouse buttons, or pointer positions relative to an element?
- How do I monitor scroll position, scroll direction, or container scroll offsets?
- How do I track user text selections, render selection highlight overlays, or read/write the clipboard?
- How do I build drag-and-drop interactions with floating previews and drop targets?
- How do I adapt UI based on media queries (dark mode, screen size, touch capability) or detect user inactivity/idle timeouts?

### 5. [Responsive Images](./contents/images.md)
Load this topic when you need to answer:
- How do I display responsive images with automatic WebP generation at build time?
- How do I eliminate Cumulative Layout Shift (CLS) when loading images?
- How do I configure image sizes and responsive breakpoints?

### 6. [Styling](./contents/styling.md)
Load this topic when you need to answer:
- When should I keep classes inline vs extracting a local variable vs creating a utility class?
- How do I conditionally toggle CSS classes based on reactive component state?
- How do I set up dynamic runtime themes (dark/light mode) vs static design tokens?

### 7. [Document Head & SEO](./contents/head.md)
Load this topic when you need to answer:
- How do I set page title, description, and canonical URLs for a page?
- How do I configure social preview cards for Open Graph and Twitter with automatic fallbacks?
- How do I embed structured JSON-LD data for search engine indexing?
