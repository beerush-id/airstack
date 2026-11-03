# my-air-react

AirLib for React — **Vite SSR + IRPC Starter**

## What's Included

- **Anchor** — fine-grained reactive state management
- **IRPC** — isomorphic RPC with HTTP + WebSocket transport
- **Router** — file-based routing with MDX support
- **Vite** — fast HMR and production builds

## Scripts

```bash
bun run dev       # Start dev server
bun run build     # Build for production
bun run start     # Run production worker (Bun)
bun run start:node  # Run with Node.js
bun run start:deno  # Run with Deno
```

## Project Structure

```
├── components/      # Reusable components
├── pages/           # File-based routes
│   ├── about/       # Nested route example
│   ├── constructor.ts # IRPC Backend Handlers (Server-only)
│   ├── function.ts  # IRPC Stubs/Declarations
│   ├── layout.tsx   # Shared UI wrapper
│   ├── page.tsx     # Route UI component
│   └── route.ts     # Route config (meta, guards, etc.)
└── src/
    ├── api.ts       # IRPC transport setup
    ├── app.css      # Global styles
    ├── app.tsx      # App entry (UIRouter)
    ├── client.tsx   # Client-side hydration
    ├── router.ts    # Router instance
    └── worker.ts    # Server worker with IRPC routers
```

## Quick Guides

### Imports
Always use the `@/` path alias to import files relative to the project root.
```typescript
import { irpc } from '@/src/api.ts';
```

### Route Configuration
Use `route.ts` to configure route metadata, guards, providers, or rewrites.

```typescript
// pages/route.ts
import router from '@/src/router.js';
const route = router.route();

export const rootRoute = route
  .guard(async () => {
    // Add authentication checks here
  })
  .provide({
    // Inject route-level dependencies here
    user: async (ctx) => getUser(),
  });

// Example of a rewrite (redirect)
route.route('/old-path').rewrite(rootRoute);
```

### Co-located API (IRPC)
Keep your backend handlers (`constructor.ts`) right next to your frontend stubs (`function.ts`) inside the `pages/` directory for true full-stack co-location!

## Learn More

- [AirLib](https://airlib.dev/)
- [Vite](https://vite.dev/)
- [React](https://react.dev/)