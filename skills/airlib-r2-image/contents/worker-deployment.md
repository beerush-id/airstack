# Worker & Container Deployment

This guide establishes the conventions for deploying `@irpclib/r2-image` on Cloudflare Workers, Cloudflare Containers, and R2 using Wrangler.

---

## Full-Stack Worker Colocation

Deploying the image service directly within your existing full-stack AirLib application provides zero-cost infrastructure unification:
- **Zero extra microservices**: Deploy everything in a single pipeline.
- **Same-origin performance**: No extra DNS lookups, TLS delays, or CORS preflight (`OPTIONS`) round-trips.
- **Isolated container compute**: Image transformations run inside isolated Cloudflare Containers without consuming V8 isolate memory.

### Application Worker (`src/worker.ts`)

Configure your application worker in `src/worker.ts` so it executes seamlessly in both development mode (`bun dev` with Vite) and production SSR. Use `resolveBinding` from `@irpclib/irpc/wrangler` to resolve local/simulated bindings during development:

```typescript
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { createWorker as createImageWorker } from '@irpclib/r2-image/worker';
import { createApp } from '@airlib/react/ssr'; // or @airlib/solid/ssr
import appRouter from './router.js';
import App from './app.js';

const images = createImageWorker({
  endpoint: '/r2-image-irpc',
  sizes: [
    { name: 'thumb', width: 128, height: 128, format: 'webp' },
    { name: 'display', size: 1024, format: 'webp' },
  ],
  allowedSizes: [128, 256, 512, 1024],
});

const appWorker = createApp(appRouter, App);

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Intercept image IRPC mutations or delivery queries
    if (url.pathname === '/r2-image-irpc' || url.pathname.startsWith('/images/')) {
      const resolvedEnv = await resolveBinding(env);
      return images.fetch(req, resolvedEnv, ctx);
    }

    return appWorker.fetch(req, env, ctx);
  },
};
```

### Cloudflare Worker Entrypoint (`server/worker.ts`)

Export the `ImageResizer` container class from `server/worker.ts` so Wrangler recognizes the container binding during Cloudflare deployment:

```typescript
import { Container } from '@cloudflare/containers';
import appWorker from '../dist/server/worker.js';

// Export the container class required by Wrangler container bindings
export class ImageResizer extends Container {
  defaultPort = 8080;
}

export default appWorker;
```

### Client Transport Configuration (`src/api.ts`)

In `src/api.ts`, configure the image client to target your custom colocated endpoint:

```typescript
import { configure } from '@irpclib/r2-image';

configure({
  endpoint: '/r2-image-irpc',
});
```

---

## Standalone Media Microservice

For dedicated image domains (e.g. `images.example.com`), export the container and worker directly:

```typescript
import { Container } from '@cloudflare/containers';
import { createWorker } from '@irpclib/r2-image/worker';

export class ImageResizer extends Container {
  defaultPort = 8080;
}

export default createWorker({
  sizes: [
    { name: 'thumb', width: 128, height: 128, format: 'webp' },
    { name: 'preview', size: 800, format: 'webp' },
  ],
  allowedSizes: [128, 256, 800, 1200],
  onDemand: true,
  cache: {
    browserTtl: 86400,    // 1 day
    edgeTtl: 2592000,     // 30 days
  },
});
```

---

## Delivery-Only Gateway (Existing Buckets)

To provide on-demand image optimization and caching for existing buckets without exposing upload or mutation endpoints:

```typescript
import { Container } from '@cloudflare/containers';
import { createWorker } from '@irpclib/r2-image/worker';

export class ImageResizer extends Container {
  defaultPort = 8080;
}

const r2Worker = createWorker({
  allowedSizes: [128, 256, 640, 1024, 1600],
  onDemand: true,
});

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
      return r2Worker.fetch(req, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

---

## Wrangler Configuration (`wrangler.jsonc`)

Cloudflare Workers pull the official prebuilt container image directly from GitHub Container Registry:

```jsonc
{
  "name": "media-service",
  "main": "server/worker.ts",
  "compatibility_date": "2026-09-11",
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "app-media"
    }
  ],
  "containers": [
    {
      "class_name": "ImageResizer",
      "image": "ghcr.io/beerush-id/r2-image:latest",
      "max_instances": 5
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "RESIZER",
        "class_name": "ImageResizer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["ImageResizer"]
    }
  ]
}
```

---

## Security & Private Network Isolation

- **No Public Ingress**: The `ImageResizer` container runs in an isolated network boundary with no public IP or DNS.
- **Worker Mediation**: Container transforms execute exclusively through private internal Durable Object RPC calls.
- **Edge Cache Shield**: Repeat requests are served directly from Cloudflare Edge Cache or R2; the container is never invoked for cached variants.
- **On-Demand Lockdown**: Setting `onDemand: false` restricts serving exclusively to pre-rendered variants, completely eliminating container execution for public visitors.

---

## Environment Bindings Reference

| Binding | Type | Required | Description |
|---|---|---|---|
| `IMAGES` | R2 Bucket Binding | Yes | Storage bucket for original media and cached variants. |
| `RESIZER` | Container / Durable Object | Yes | Private container binding executing image transformations. |
| `R2_IMAGE_API_KEY` | Secret | No | When set, mutations (`upload`, `remove`) require a matching `apiKey`. |
| `R2_IMAGE_ORIGINS` | Variable | No | Comma-separated allowed origins (e.g. `https://example.com`) for CORS enforcement. |
