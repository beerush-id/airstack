---
name: airlib-irpc
description: Use when calling server code, fetching data, streaming real-time updates, configuring network protocols, managing database operations, validating inputs, handling webhooks, or distributing services in an AirLib project
---

# AirLib IRPC Router

The routing guide for Isomorphic Remote Procedure Calls (IRPC) in **AirLib**.

IMPORTANT: Read only what you need. Match your problem or goal to the matrix below, then read only the corresponding topic document in `contents/`. Do not load all files into context.

---

## IRPC Decision Matrix: What are you building?

| What question are you trying to answer? | Topic Guide to Read |
|---|---|
| **"How do I define remote functions (colocated `function.ts`), call them from UI components, or configure caching and retries?"** | [contents/declarations.md](./contents/declarations.md) |
| **"How do I write colocated server logic (`constructor.ts`), stream live updates continuously, push data progressively, or clean up resources on disconnect?"** | [contents/handlers.md](./contents/handlers.md) |
| **"How do I choose network protocols (HTTP, WebSocket, Web Workers), send credentials, or handle connection lifecycles?"** | [contents/transports.md](./contents/transports.md) |
| **"How do I generate standard database operations (create, read, update, delete) for an entity, connect database drivers, or chain caching layers?"** | [contents/crud.md](./contents/crud.md) |
| **"How do I authenticate users, enforce role permissions, build request session context, or validate arguments before sending?"** | [contents/interceptors.md](./contents/interceptors.md) |
| **"How do I receive incoming third-party REST webhooks (like Stripe or GitHub) and run server functions from them?"** | [contents/webhooks.md](./contents/webhooks.md) |
| **"How do I distribute functions across microservices, publish type-safe client packages to NPM, or persist live state across serverless instances?"** | [contents/distribution.md](./contents/distribution.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or class in existing code? Look it up here to find the relevant guide:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `irpc.declare`, `.once()`, `.with()`, `.when()`, `.later()`, `standalone`, `keepAlive`, `coalesce`, `bypassLocal`, `IRPCReader`, `IRPCFile`, `IRPCBlob`, `irpc.invalidate` | [contents/declarations.md](./contents/declarations.md) |
| `irpc.construct`, `stream()`, `reader.pipe()`, `createContext()`, `getContext()`, `setContext()`, `withContext()`, `envCtx`, `getEnv()`, `cookies` | [contents/handlers.md](./contents/handlers.md) |
| `HTTPTransport`, `HTTPRouter`, `WebSocketTransport`, `WebSocketRouter`, `BroadcastTransport`, `BroadcastRouter`, `UnhandledCall`, `transport.sign()` | [contents/transports.md](./contents/transports.md) |
| `irpc.crud`, `irpc.exclude`, `IRPCCrudDriver`, `IRPCCrudAdapter`, `IRPCCrudMeta`, `IRPCCrudAdapter.next()` | [contents/crud.md](./contents/crud.md) |
| `router.use()`, `irpc.guard()`, `GuardError`, `irpc.hook()`, `getAbortSignal()` | [contents/interceptors.md](./contents/interceptors.md) |
| `router.resolveRest()`, `router.resolveJson()` | [contents/webhooks.md](./contents/webhooks.md) |
| `createPackage`, `bypassLocal`, `irpc.href`, `IRPC_STORE`, `Durable`, `durable.use()`, `durable.get()` | [contents/distribution.md](./contents/distribution.md) |

---

## Questions & Tasks Covered by Each Topic

### [Declarations & Client Execution](./contents/declarations.md)
Load this topic when you need to answer:
- How do I define a type-safe contract between client and server without managing HTTP routes or endpoints?
- How do I pass positional parameters, nested objects, or no arguments to a remote function?
- How do I upload binary files or defer downloading large files until requested?
- When should a remote function return a single response vs a continuous live stream?
- How do I call remote functions in UI components (immediate run, dependency-tracked re-fetch, lazy fetch, or manual click trigger)?
- How do I track execution lifecycle states (`idle`, `pending`, `success`, `error`) in the UI?
- How do I avoid redundant network requests through caching, deduplicate simultaneous identical calls, or retry on connection failure?
- How do I force procedure calls through the network transport when running in the same process as handlers?
- How do I validate function arguments and return shapes at runtime before execution?

### [Server Handlers & Reactive Streaming](./contents/handlers.md)
Load this topic when you need to answer:
- How do I write the server-side implementation for a declared remote function?
- How do I isolate request context across concurrent server requests so user sessions never leak?
- How do I execute server operations inside an isolated or pre-seeded request scope?
- How do I access serverless platform environment bindings without threading them through function parameters?
- How do I call other remote functions within the server without network serialization overhead?
- How do I continuously push real-time data or LLM tokens to the client over an open connection?
- How do I execute multiple slow database queries in parallel and stream each field to the UI as soon as it resolves?
- How do I pipe an active streaming response from an internal service directly through to the client?
- How do I automatically close database cursors, event listeners, or socket subscriptions when a client disconnects or aborts?
- How do I access authenticated user data or request-scoped variables inside server functions?
- How do I read or set authentication cookies inside server functions without touching HTTP headers manually?
- Why do server business logic errors fail immediately while network errors get retried?

### [Network Transports & Routers](./contents/transports.md)
Load this topic when you need to answer:
- How do I switch network protocols (HTTP, WebSocket, or local thread) without changing any UI calls or business logic?
- How do I batch multiple simultaneous UI function calls into a single HTTP request automatically?
- How do I signal that an edge worker cannot resolve or handle an incoming RPC route?
- How do I establish a persistent real-time connection with automatic reconnection and upgrade-time authentication?
- Why should large file uploads use standard HTTP instead of WebSocket connections?
- How do I run heavy computation in a browser Web Worker or sync state across browser tabs with zero server infrastructure?
- How do I attach API tokens or credentials to all outgoing network requests?
- How are active connections and streams cleaned up when a user navigates away, times out, or disconnects?
- How do I connect remote functions to a custom transport protocol?

### [Standardized CRUD & Driver Adapters](./contents/crud.md)
Load this topic when you need to answer:
- How do I generate standard database operations (create, read, update, delete) for an entity in a single declaration?
- How do I restrict an entity to read-only or omit specific operations?
- How do I write a generic database driver that handles operations for any database table or collection?
- How do I connect entity operations to database drivers on the server?
- How do I put an in-memory cache (like Redis) in front of a database so cache hits avoid database queries?
- How do I intercept only read operations for caching without writing boilerplate for creates or updates?
- How do I add custom generic operations (such as filtered list queries) to all entities?
- When should I write a custom server handler for a single entity operation instead of using generic database drivers?

### [Interceptors, Guards & Spec Hooks](./contents/interceptors.md)
Load this topic when you need to answer:
- What is the lifecycle order of requests from initial browser click to server handler execution?
- How do I parse incoming headers (like authorization tokens) and build shared session data for all incoming calls?
- How do I restrict access based on user roles and cancel in-flight database queries if a user disconnects?
- How do I reject unauthorized requests with standardized permission error codes?
- How do I validate function arguments in the browser before sending and re-verify them on the server to prevent tampering?

### [Webhooks & REST Translation](./contents/webhooks.md)
Load this topic when you need to answer:
- Why can't third-party webhooks (like Stripe or GitHub) talk directly to internal remote function protocols?
- How do I define a remote function to receive an incoming JSON webhook payload?
- How do I translate incoming HTTP webhook requests into function executions in edge environments (Bun, Cloudflare Workers)?
- How do I handle incoming webhooks in traditional Node.js servers (Express, Fastify)?
- How do I return specific HTTP status codes (like 200 OK or plain text) required by webhook providers to acknowledge receipt?
- How do I verify HMAC signatures or security headers on incoming webhook requests?

### [Distribution, Monitoring & Durable State](./contents/distribution.md)
Load this topic when you need to answer:
- How do package names and versions prevent silent contract mismatches between client and server?
- How do I direct different groups of functions to separate backend microservices without an API gateway?
- How do I publish type-safe client contracts to an NPM package while excluding server implementation files?
- How do I switch function execution between remote servers and local Web Workers dynamically at runtime?
- How do I monitor in-flight requests, call durations, and error rates across the entire system in real time?
- How do I maintain a single shared persistent state (like multiplayer presence or chat rooms) across short-lived serverless workers?
