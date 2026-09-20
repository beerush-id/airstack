---
name: airlib-routing
description: Use when creating pages, structuring URLs, declaring nested layouts, protecting routes with authentication guards, pre-fetching route data with providers, handling navigation, or configuring sitemaps in an AirLib project
---

# AirLib Routing Router

The routing guide for applications built with **@airlib/router** in AirLib.

IMPORTANT: Read only what you need. Match your problem or goal to the matrix below, then read only the corresponding topic document in `contents/`. Do not load all files into context.

---

## Routing Decision Matrix: What are you building?

| What question are you trying to answer? | Topic Guide to Read |
|---|---|
| **"How do I define URL routes, create nested layout shells, display modal routes, pre-render static pages (SSG/ISR), or configure zero-JS builds?"** | [contents/routes-layouts.md](./contents/routes-layouts.md) |
| **"How do I navigate between pages, pass parameters and query strings, or track active links in UI?"** | [contents/navigation.md](./contents/navigation.md) |
| **"How do I restrict page access, redirect unauthorized users, or handle permission errors?"** | [contents/guards.md](./contents/guards.md) |
| **"How do I load data before page render, chain dependent queries, or cache and retry data requests?"** | [contents/data-loaders.md](./contents/data-loaders.md) |
| **"How do I generate XML sitemaps for search engines, handle dynamic URL paths, or support multiple languages?"** | [contents/sitemaps.md](./contents/sitemaps.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or component in existing code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `createRouter`, `page()`, `modal()`, `.render()`, `UIRouter`, `router.catch()`, `keepAlive`, `static`, `noscript`, `airPages` | [contents/routes-layouts.md](./contents/routes-layouts.md) |
| `<Link>`, `navigate()`, `route.url()`, `activeClass`, `fullMatch`, `preloadMode`, `router.state.activating`, `router.state.progress` | [contents/navigation.md](./contents/navigation.md) |
| `.guard()`, `redirect()`, `route.catch()`, `route.state.authenticated` | [contents/guards.md](./contents/guards.md) |
| `.provide()`, `state.data`, `context.data`, `context.params`, `context.query`, `maxAge`, `maxRetries`, `retryDelay`, `retryMode` | [contents/data-loaders.md](./contents/data-loaders.md) |
| `sitemap`, `router.sitemap()`, `hreflang`, `changefreq`, `priority`, `resolveAsset` | [contents/sitemaps.md](./contents/sitemaps.md) |

---

## Questions & Tasks Covered by Each Topic

### [Routes & Layouts](./contents/routes-layouts.md)
Load this topic when you need to answer:
- How do I define a tree of URL routes without central JSX route tables?
- How do I separate route path definitions from UI rendering logic?
- How do I build nested layouts where parent shells persist during child navigation?
- How do I define index routes for parent URLs?
- How do I render a route as an overlay modal while keeping the underlying page mounted (`modal()`)?
- How do I create independent route branches (like authentication pages) that do not inherit the main application shell?
- How do I pre-render static HTML pages at build time (SSG) or configure on-demand ISR?
- How do I ship zero-JavaScript pages with no client hydration scripts (`noscript`)?
- How do I catch route errors with global or per-route error boundaries?

### [Navigation](./contents/navigation.md)
Load this topic when you need to answer:
- How do I link to routes type-safely using route objects instead of hardcoded URL strings?
- How do I pass route parameters and query strings to links with compile-time type validation?
- How do I highlight active navigation items and handle exact vs hierarchical matching?
- How do I trigger navigation programmatically from form submissions or event handlers?
- How do I replace the current browser history entry instead of pushing a new entry?
- How do I generate URL strings from route objects without navigating?
- How do I preload route data when a user hovers over a link?
- How do I display a global navigation progress bar during page transitions?

### [Guards & Authentication](./contents/guards.md)
Load this topic when you need to answer:
- How do I verify user permissions and authentication before a route component mounts?
- How do I redirect users to login or fallback pages during navigation?
- How do multiple guards on the same route execute?
- How do parent guards protect all child routes automatically?
- How do guards automatically re-evaluate when global reactive state changes?
- How do I display custom access denied or error barrier components when guards fail?

### [Data Loaders & Providers](./contents/data-loaders.md)
Load this topic when you need to answer:
- How do I load asynchronous data before a page component renders?
- How do I pass URL parameters and query strings into data fetchers?
- How do I chain dependent data queries so downstream loaders receive upstream results?
- How do I automatically re-run data loaders when reactive signals or application state change?
- How do I cache loader data by URL parameters to avoid redundant network requests?
- How do I configure automatic retries with backoff delays for transient network failures?
- What is the difference between route-scoped data (`state.data`) and tree-scoped data (`context.data`)?

### [Sitemaps](./contents/sitemaps.md)
Load this topic when you need to answer:
- How does AirLib automatically serve `/sitemap.xml` for registered routes?
- How do I exclude specific routes or entire subtrees (such as admin panels) from the sitemap?
- How do I customize search engine priority and change frequency per route?
- How do I generate dynamic sitemap URLs from a database or CMS API?
- How do I configure multi-language alternates with language prefixes (`hreflang`)?
- How do I generate sitemaps programmatically in custom server or worker environments?
