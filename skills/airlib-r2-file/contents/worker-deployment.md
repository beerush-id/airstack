# Worker & Edge Delivery

Deploying `@irpclib/r2-file` on Cloudflare Workers, configuring full-stack colocation with `resolveBinding`, direct in-worker filesystem calls, HTTP 206 Range streaming, signed URLs, and error contracts.

---

## Full-Stack Worker Colocation

Deploying the filesystem service directly inside an existing full-stack AirLib application provides unified infrastructure:
- **Zero extra microservices**: Deploy all routes, SSR, and storage operations in a single pipeline.
- **Same-origin performance**: No extra DNS lookups, TLS delays, or CORS preflight (`OPTIONS`) round-trips.
- **Shared bindings**: Access R2 bucket and D1 database bindings without network bridges.

### Application Worker (`src/worker.ts`)

Configure `src/worker.ts` so it executes seamlessly in development (`bun dev` with Vite) and production SSR. Use `resolveBinding` from `@irpclib/irpc/wrangler` to resolve local or simulated bindings during development:

```typescript
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { createWorker as createFileWorker } from '@irpclib/r2-file/worker';
import { createApp } from '@airlib/react/ssr'; // or @airlib/solid/ssr
import appRouter from './router.js';
import App from './app.js';

const fileService = createFileWorker({
  endpoint: '/r2-file-irpc',
  public: ['public/**'],
  maxSize: 25 * 1024 * 1024,
  maxEncodingSize: 500 * 1024,
  cache: {
    browserTtl: 86400,    // 1 day
    edgeTtl: 2592000,     // 30 days
  },
});

const appWorker = createApp(appRouter, App);

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Intercept filesystem IRPC mutations
    if (url.pathname === '/r2-file-irpc') {
      const resolvedEnv = await resolveBinding(env);
      return fileService.fetch(req, resolvedEnv, ctx);
    }

    // Intercept direct file delivery (e.g. /files/*)
    if (url.pathname.startsWith('/files/')) {
      const resolvedEnv = await resolveBinding(env);
      return fileService.fetch(req, resolvedEnv, ctx);
    }

    return appWorker.fetch(req, env, ctx);
  },
};
```

### Client Transport Configuration (`src/api.ts`)

When colocating with a custom endpoint, point the client transport in `src/api.ts`:

```typescript
import { configure } from '@irpclib/r2-file';

configure({
  endpoint: '/r2-file-irpc',
});
```

When running same-origin with the default `/irpc` endpoint, client operations work out of the box with zero configuration.

### Co-locating with R2 Image

R2 File acts as the authoritative storage engine for uploading, organizing, and deleting files, while R2 Image acts as an on-demand transform gateway:

```typescript
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { createWorker as createImageWorker } from '@irpclib/r2-image/worker';
import { createWorker as createFileWorker } from '@irpclib/r2-file/worker';
import { createApp } from '@airlib/react/ssr';
import appRouter from './router.js';
import App from './app.js';

const images = createImageWorker({
  allowedSizes: [128, 256, 640, 1024],
  onDemand: true,
});

const fileService = createFileWorker({
  endpoint: '/r2-file-irpc',
  public: ['public/**'],
  maxSize: 25 * 1024 * 1024,
});

const appWorker = createApp(appRouter, App);

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const resolvedEnv = await resolveBinding(env);

    // On-demand image resizing & delivery
    if (req.method === 'GET' && url.pathname.startsWith('/assets/images/')) {
      return images.fetch(req, resolvedEnv, ctx);
    }

    // Filesystem range streaming and mutations
    if (url.pathname === '/r2-file-irpc' || url.pathname.startsWith('/files/')) {
      return fileService.fetch(req, resolvedEnv, ctx);
    }

    return appWorker.fetch(req, env, ctx);
  },
};
```

---

## Direct In-Worker Filesystem

Application code running inside Cloudflare Workers with direct access to bindings can instantiate a native filesystem instance without network or RPC overhead:

```typescript
import { createFs } from '@irpclib/r2-file/fs';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const fs = createFs({
      bucket: env.BUCKET,
      indexer: env.DB,
    });

    const config = await fs.read('/shared/config.json', { encoding: 'json' });
    return Response.json(config);
  },
};
```

---

## Standalone File Microservice

For dedicated storage microservices (e.g. `files.example.com`), export `createWorker` directly:

```typescript
import { createWorker } from '@irpclib/r2-file/worker';

export default createWorker({
  public: ['public/**'],
  maxSize: 25 * 1024 * 1024,
  maxEncodingSize: 500 * 1024,
  cache: {
    browserTtl: 86400,
    edgeTtl: 2592000,
  },
});
```

Configure remote cross-origin clients in `src/api.ts`:

```typescript
import { configure } from '@irpclib/r2-file';

configure({
  baseUrl: 'https://files.example.com',
  apiKey: 'secret-mutation-key',
});
```

---

## Delivery-Only Gateway

To serve existing buckets with caching, Range streaming, and zero RPC mutation surface, disable IRPC procedures:

```typescript
import { createWorker } from '@irpclib/r2-file/worker';

const deliveryWorker = createWorker({
  callable: false,
  public: true,
});

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      return deliveryWorker.fetch(req, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

---

## Edge Delivery Features

Direct HTTP GET requests stream files from storage with CDN caching and streaming features:

### HTTP 206 Partial Content (Range Seeking)

The delivery engine natively implements RFC 7233 byte range requests:
- Reads the incoming `Range: bytes=start-end` header.
- Streams the exact requested byte slice from Cloudflare R2.
- Returns `206 Partial Content` with `Content-Range` and `Accept-Ranges: bytes` headers.
- Enables seek scrubbing in `<video>` and `<audio>` players.

### Conditional GET & ETag Caching

Every stored file tracks an authoritative `etag` and `mtime`:
- Incoming requests with `If-None-Match` or `If-Modified-Since` headers return `304 Not Modified` when unchanged.
- Prevents redundant file transfers and preserves client bandwidth.

### Signed Expiring URLs

Generate time-limited HMAC-SHA256 download links for protected files:

```
https://files.example.com/private/contracts/deal.pdf?token=<HMAC_HEX>&expires=1774000000
```

Validation behavior:
- Expired timestamps (`Date.now() > expires`) return `403 Forbidden: URL expired`.
- Invalid HMAC signatures return `403 Forbidden: Invalid signature`.

---

## Typed Error Handling

Filesystem operations throw typed `HandlerError` from `@irpclib/irpc`, ensuring safe serialization across the network:
- `message`: Public wire-safe message for client display.
- `cause`: Diagnostic details retained strictly on the server for telemetry and logs.

### Error Codes Reference

| Code | Wire Message | Trigger Condition |
| :--- | :--- | :--- |
| `ENOENT` | `'Resource not found'` | Source file, target directory, or restore item missing |
| `EEXIST` | `'Destination exists'` | Target destination already exists on copy or move |
| `EACCES` | `'Permission denied'` | Boundary escape or unauthorized path under access rules |
| `ENOTEMPTY` | `'Directory not empty'` | Non-empty directory deletion blocked under strict policy |
| `EFBIG` | `'File size exceeds limit'` | Payload exceeds configured size limits |
| `EINVAL` | `'Invalid file type'` | Unsupported MIME type or unapproved format |
| `EIO` | `'Failed to <operation>'` | Storage driver failure or unhandled operation |

### Client Error Handling

```typescript
import { write } from '@irpclib/r2-file';

try {
  await write('~/uploads/large-archive.zip', file);
} catch (error: any) {
  if (error.code === 'EFBIG') {
    alert('File exceeds the maximum upload limit.');
  } else if (error.code === 'EACCES') {
    alert('Permission denied for this path.');
  } else {
    alert(error.message);
  }
}
```

---

## Wrangler Configuration (`wrangler.jsonc`)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "r2-file-service",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-11",
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "production-file-storage"
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "production-fs-indexer",
      "database_id": "<YOUR_D1_DATABASE_ID>"
    }
  ],
  "vars": {
    "FILE_API_KEY": "secret-mutation-key",
    "FILE_SECRET": "secret-url-signing-key"
  }
}
```

---

## Environment Bindings Reference

| Binding | Type | Required | Description |
|---|---|---|---|
| `BUCKET` | R2 Bucket Binding | Yes | Storage bucket for binary file objects. |
| `DB` | D1 Database Binding | No | Relational database for directory listings, search, and write-through cache. |
| `FILE_API_KEY` | Secret | No | When set, client RPC mutations require a matching `apiKey`. |
| `FILE_SECRET` | Secret | No | Secret key used to sign and verify temporary expiring delivery URLs. |
