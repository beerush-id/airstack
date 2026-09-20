---
name: airlib
description: Use when starting any task in an AirLib project to run dev servers, build, deploy, scaffold pages/layouts, understand project structure, or route to specialized domain skills
---

# AirLib Core Guide & Conventions

AirLib is a universal full-stack TypeScript framework unifying state management, file-based routing, type-safe RPC, and Universal Server-Side Rendering (SSR) across React and SolidJS.

---

## Core Development & Build Commands

| Task | Bun | NPM / PNPM | Notes |
|---|---|---|---|
| **Start Dev Server** | `bun dev` | `npm run dev` / `pnpm dev` | Starts Vite with `airPages()` route watcher and HMR. |
| **Build Client** | `bun run build:client` | `npm run build:client` | Runs `vite build --outDir dist/client`. |
| **Build Server** | `bun run build:server` | `npm run build:server` | Runs `vite build --ssr --outDir dist/server`. |
| **Full Production Build** | `bun run build` | `npm run build` | Builds both client and SSR server bundles sequentially. |
| **Start Bun Server** | `bun start` | `bun run dist/server/worker.js` | Runs native Bun production HTTP/SSR server. |
| **Start Node.js Server** | `npm run start:node` | `node server/node.js` | Runs Node.js / Hono production server. |
| **Start Deno Server** | `npm run start:deno` | `deno run -A server/deno.js` | Runs Deno production server. |
| **Deploy to Cloudflare** | `npx wrangler deploy` | `npx wrangler deploy` | Deploys SSR worker to Cloudflare Workers / Pages. |

---

## Standard Project Structure

```
my-air-app/
├── assets/                # Static media, SVGs, images (imported with ?asset)
├── components/            # Reusable UI components
├── pages/                 # File-based routes, layouts, and views
│   ├── (docs)/            # Group / slave route (isolated tree with independent layout & guards)
│   ├── layout.tsx         # Root application layout shell
│   ├── page.tsx           # Home page (index for root route)
│   ├── route.ts           # Root route definition (scaffolded by airPages)
│   ├── function.ts        # Colocated client-safe IRPC procedure stubs (irpc.declare)
│   └── constructor.ts     # Colocated server implementation handlers (irpc.construct)
├── public/                # Static assets served untouched
├── server/                # Multi-runtime SSR server entrypoints
│   ├── bun.js             # Bun runtime server
│   ├── node.js            # Node.js (Hono) server
│   ├── deno.js            # Deno runtime server
│   └── worker.ts          # Edge worker entry
├── src/                   # Application runtime source
│   ├── api.ts             # IRPC package setup and transport configuration
│   ├── app.css            # Global styling and design tokens
│   ├── app.tsx            # Root application entry component (<UIRouter>)
│   ├── client.tsx         # Client hydration bootstrap
│   ├── router.ts          # Router initialization (createRouter)
│   ├── worker.ts          # Universal SSR request renderer (createApp)
│   └── global.d.ts        # TypeScript declarations (<reference types="@airlib/vite/ambient" />)
├── index.html             # Universal HTML shell (<!--ssr-head-->, <!--ssr-outlet-->)
├── vite.config.ts         # Vite configuration with airPages() plugin
└── wrangler.toml          # Cloudflare deployment configuration
```

---

## Route Directory Anatomy & Assisted File-Based Routing

Each route directory in `pages/` collocates its full-stack concerns:
- **`page.tsx` / `layout.tsx`**: UI view layer rendered by `page(route).render()`.
- **`route.ts`**: Route lifecycle, authentication guards (`.guard()`), data providers (`.provide()`), and caching/SSG options (`route.config()`).
- **`function.ts`**: Client-safe IRPC procedure stubs (`irpc.declare()`) consumed by the route and view.
- **`constructor.ts`**: Server execution logic (`irpc.construct()`) binding backend handlers to `function.ts` stubs.

IMPORTANT:
- To add a page or layout, ONLY create an empty file (e.g. `touch pages/about/page.tsx` or write an empty `page.tsx`, `page.mdx`, or `layout.tsx`). The dev server scaffolds the content and `route.ts` automatically.
- NEVER manually write route boilerplate, import from `./route.js`, or create `route.ts`.
- `route.ts` is ONLY edited when explicitly attaching guards (`.guard()`), data providers (`.provide()`), or options (`route.config()`).
- Stubs in `function.ts` and handlers in `constructor.ts` sit right next to their corresponding `route.ts`, or at parent folder levels to share logic across child routes.

---

## Route Types & File Conventions

| Pattern | File Path | URL Path | Description |
|---|---|---|---|
| **Root Layout** | `pages/layout.tsx` | `/` | Persistent shell wrapped around all root routes. |
| **Index Page** | `pages/products/page.tsx` | `/products` | Matches the parent directory path exactly. |
| **Named Page** | `pages/sale.page.tsx` | `/sale` | Flat file route without creating a sub-folder. |
| **Dynamic Route** | `pages/products/[id]/page.tsx` | `/products/:id` | Dynamic parameter accessible via `state.params.id`. |
| **Catch-All Route** | `pages/[...rest]/page.tsx` | `/*` | Wildcard route; segments arrive in `state.params['*']` as an array. |
| **Slave / Group Route** | `pages/(docs)/layout.tsx` | `/docs` | Isolated route tree with independent layout shell, guards, and providers. |
| **Markdown Page** | `pages/faq.page.mdx` | `/faq` | MDX prose with frontmatter metadata and live `$state`. |

---

## Specialized Skills Directory

When a task requires deep domain capabilities, load the specialized skill:

| What are you building? | Load This Skill |
|---|---|
| **Components, slots, browser signals, images, dynamic classes/styles (`classx`/`stylex`), unique IDs (`uuid`/`shortId`/`uIndex`), `<Head>` SEO** | `airlib-ui` |
| **Reactive mutable/immutable state, derived ViewModels, effects, async queries, collections, optimistic updates (`undoable`), timing helpers (`sleep`/`debouncer`/`microtask`), hierarchical layering (`inherit`), cookies** | `airlib-state` |
| **Server RPC functions, handlers, streaming, transports, CRUD adapters, guards, webhooks** | `airlib-irpc` |
| **Route declarations, programmatic navigation, data loaders (`.provide()`), route guards, modals, sitemaps** | `airlib-routing` |
| **Form state management, input validation schemas, dirty tracking, submission handling** | `airlib-form` |
| **Documentation sites, content-driven pages, guides, technical blogs** | `airlib-markdown` |
| **Multi-step asynchronous pipelines, retry policies, execution branching** | `airlib-workflow` |
| **Client-side persistent storage (localStorage, sessionStorage, in-browser KV/tables)** | `airlib-storage` |
| **Cloudflare R2 filesystem storage (`~/...`) and binary streaming** | `airlib-r2-file` |
| **Dynamic image optimization and format transformation on Cloudflare R2** | `airlib-r2-image` |

---

## Symbol & Package Lookup

| Symbol / Keyword Seen in Code | Skill to Load |
|---|---|
| `setup`, `template`, `Slot`, `Snippet`, `LIVE_*`, `Image`, `classx`, `stylex`, `uuid`, `shortId`, `uIndex`, `Head`, `@airlib/react`, `@airlib/solid`, `@airlib/react/utils`, `@airlib/solid/utils` | `airlib-ui` |
| `mutable`, `immutable`, `derived`, `effect`, `computed`, `ref`, `undoable`, `inherit`, `sleep`, `debouncer`, `microtask`, `microbatch`, `@airlib/core`, `@airlib/react`, `@airlib/solid`, `@airlib/react/utils`, `@airlib/solid/utils` | `airlib-state` |
| `irpc`, `declare`, `construct`, `stream`, `RemoteState`, `IRPCTransport`, `@irpclib/irpc` | `airlib-irpc` |
| `rootRoute`, `route`, `guard`, `provide`, `render`, `redirect`, `modal`, `sitemap`, `@airlib/router` | `airlib-routing` |
| `createForm`, `TextInput`, `EmailInput`, `Textarea`, `formState`, `@airlib/react-form`, `@airlib/solid-form` | `airlib-form` |
| `.page.mdx`, `.mdx`, `$state`, `:::note`, `:::tip`, `:::code-group`, `:::interactive`, `:badge`, `@airlib/react/mdx` | `airlib-markdown` |
| `plan`, `plan<T>()`, `WorkflowStepper`, `.switch()`, `.when()`, `.with()`, `.later()`, `WORKFLOW_STORE`, `@irpclib/irpc`, `@airlib/core` | `airlib-workflow` |
| `persistent`, `session`, `createKVStore`, `kv`, `createTable`, `@airlib/storage`, `@airlib/storage/db` | `airlib-storage` |
| `write`, `read`, `stat`, `exists`, `mkdir`, `list`, `search`, `copy`, `move`, `link`, `remove`, `restore`, `fsContext`, `createFs`, `createWorker`, `@irpclib/r2-file`, `@irpclib/r2-file/worker`, `@irpclib/r2-file/fs` | `airlib-r2-file` |
| `upload`, `url`, `resize`, `info`, `remove`, `createWorker`, `ImageResizer`, `@irpclib/r2-image`, `@irpclib/r2-image/worker` | `airlib-r2-image` |

---

## Questions & Tasks Covered by Each Skill

### `airlib-ui` — UI & Components
Load this skill when you need to answer:
- How do I build an interactive component?
- How do I update a specific piece of UI without re-rendering the whole component?
- How do I conditionally show/hide elements or render lists?
- How do I combine dynamic CSS classes (`classx`) and merge style objects (`stylex`) cleanly?
- How do I generate unique identifiers (`uuid`, `shortId`) or auto-incrementing scoped counters (`uIndex`)?
- How do I listen to hotkeys, text selection, or mouse coordinates without manual `addEventListener`?
- How do I render responsive images without layout shift?
- How do I set document head metadata, Open Graph cards, or SEO JSON-LD tags?

### `airlib-state` — State & Reactivity
Load this skill when you need to answer:
- How do I declare state so that changing a property automatically updates the UI?
- How do I mutate nested objects or arrays without spread operators or `setState`?
- How do I share state across different components or store data outside components?
- How do I compute derived values (e.g. filtered lists, totals) that recalculate automatically?
- How do I run a side-effect or watcher whenever specific data changes?
- How do I manage async queries with automatic status tracking?
- How do I update the UI immediately with isolated transactions and roll back on failure (`undoable`)?
- How do I delay execution (`sleep`), debounce frequent events (`debouncer`), or schedule microtasks/microbatches (`microtask`, `microbatch`)?
- How do I deeply layer and inherit configurations dynamically without mutation (`inherit`)?

### `airlib-irpc` — Server Calls & Realtime
Load this skill when you need to answer:
- How do I call a backend function from the frontend with full type safety?
- How do I write the server-side logic for an API endpoint?
- How do I stream live data (like stock prices, chat, or progress) from server to client?
- How do I check authentication or validate incoming payloads on API calls?
- How do I handle automatic request caching, deduplication, or reconnects?
- How do I batch-generate CRUD database operations with generic drivers?

### `airlib-routing` — Pages & Navigation
Load this skill when you need to answer:
- How do I create a new page or URL route (e.g. `/profile/:id`)?
- How do I create nested layouts with persistent headers or sidebars?
- How do I redirect users if they are not logged in or lack permissions?
- How do I load or pre-fetch data before a page renders?
- How do I show modal routes with shareable URLs and preserved background views?
- How do I pre-render static pages (SSG/ISR) or ship zero-JavaScript pages (`noscript`)?
- How do I configure static, dynamic, or multi-language XML sitemaps?

### `airlib-form` — Forms & Validation
Load this skill when you need to answer:
- How do I connect form inputs (text, checkboxes, dropdowns) to state?
- How do I validate user input against a schema and display error messages?
- How do I track whether an input has been touched or modified (dirty state)?
- How do I handle the submit button state (submitting, success, error) and prevent double submission?

### `airlib-markdown` — Extended Markdown & Documentation
Load this skill when you need to answer:
- How do I create MDX documentation pages (`.page.mdx`) and bind live route state (`$state`)?
- How do I write callout boxes (admonitions like `:::tip`, `:::warning`, `:::danger`) and collapsible sections?
- How do I build tabbed code blocks across frameworks (`:::code-group`) or interactive live demos (`:::interactive`)?
- How do I import an `.mdx` file as a zero-runtime component inside a `.tsx` page?

### `airlib-workflow` — Multi-Step Pipelines
Load this skill when you need to answer:
- How do I run a sequence of async steps without messy nested `try/catch` blocks?
- How do I branch logic based on intermediate results (e.g. choosing between payment gateways or AI models)?
- How do I retry a failed step or perform cleanup/rollback on failure?
- How do I display step-by-step progress in the UI while a task is running?

### `airlib-storage` — Browser Storage (Client-Only)
Load this skill when you need to answer:
- How do I store, retrieve, or query data directly in the browser (localStorage, sessionStorage, in-browser KV/tables)?
- How do I persist client-side state across browser sessions strictly in the browser?

### `airlib-r2-file` — Cloudflare R2 Filesystem
Load this skill when you need to answer:
- How do I write, read, search, list, copy, move, symlink, or soft-delete files with POSIX paths (`~`, `/`, `./`)?
- How do I stream binary files with HTTP 206 Range seeking or generate signed expiring URLs?
- How do I enforce tenant isolation (`mountPoint`) and ambient security access rules (`fsContext`)?
- How do I colocate the filesystem worker in `src/worker.ts` with `resolveBinding` or run direct operations with `createFs`?

### `airlib-r2-image` — Cloudflare Image Optimization
Load this skill when you need to answer:
- How do I upload images, generate eager responsive variants, or cascade-delete assets in Cloudflare R2?
- How do I serve images via native `<img>` tags with orientation normalization (`size`) and dimension whitelisting (`allowedSizes`)?
- How do I configure Cloudflare Worker entrypoints and private container resizers (`ImageResizer`) in a full-stack AirLib project?
