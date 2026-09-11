# AirLib R2 Image

High-performance media delivery, edge caching, and isomorphic uploads for Cloudflare Workers, Cloudflare R2, and Cloudflare Containers.

Built on [**IRPC**](https://airlib.dev/docs/remote-function) and [**@napi-rs/image**](https://image.napi.rs).

---

## Architecture & Core Concerns

**AirLib R2 Image** unifies asset ingestion, transformation, and distribution into a dual-plane architecture designed for zero egress fees and minimal edge compute overhead:

- **Ingestion & Control Plane (`/irpc`)**: A type-safe isomorphic RPC surface providing streaming file uploads (`IRPCFile`), observable progress tracking, metadata inspection, and cascading lifecycle mutations.
- **Edge Delivery Plane (`GET /*`)**: A high-throughput binary delivery pipeline serving `<img>` tags and HTTP clients directly from Cloudflare Edge Cache (`caches.default`) and R2 storage.
- **Dedicated Container Resizer**: Offloads CPU-intensive image resizing to private Cloudflare Containers (Durable Objects) or Service Bindings powered by native Rust image transformations (`@napi-rs/image`).
- **Eager Variant Generation & Lockdown Mode**: Generates responsive variants and blurred placeholders (LQIP) during upload so they are warm on delivery. In strict environments (`onDemand: false`), dynamic transforms are locked down to prevent compute spikes.

---

## Installation

```bash
bun add @irpclib/r2-image @irpclib/irpc
```

When deploying containerized resizers with Cloudflare Workers:

```bash
bun add -D @cloudflare/containers
```

---

## Media Asset Lifecycle

Every asset flows through a four-stage lifecycle designed for predictability and zero cache desynchronization:

### 1. Ingestion: Uploading & Variant Preparation

Clients can generate server-side presets and responsive breakpoints eagerly during upload, or provide client pre-rendered crops directly. Progress is streamed over an observable RPC channel.

#### Server-Side Eager Variants
```ts
import { IRPCFile } from '@irpclib/irpc';
import { upload } from '@irpclib/r2-image';

async function uploadAvatar(file: File) {
  const avatar = new IRPCFile(
    { name: file.name, size: file.size, type: file.type },
    file
  );

  // Eagerly generates and warms variants in R2 during upload
  const stream = upload('users/u_42/avatar.png', avatar, {
    resize: [
      { name: 'display', width: 256, height: 256, format: 'webp' },
      { name: 'thumb', width: 64, height: 64, format: 'webp' },
      { name: 'lqip', width: 24, height: 24, blur: 10, format: 'webp' },
    ],
  });

  // Track upload and transformation steps
  stream.subscribe((state) => {
    console.log(`[${state.step}] progress: ${state.progress}%`);
  });

  const result = await stream;
  console.log('Saved to:', result.path); // '/users/u_42/avatar.png'
}
```

#### Client Pre-Rendered Variants
When variants are cropped or generated in the browser/client, pass `variants` to store them directly without container invocation:

```ts
import { resize, upload } from '@irpclib/r2-image';

// Pre-render crop in client to save network bandwidth and compute
const clientThumb = await resize(avatar, { width: 64, height: 64, format: 'webp' });

// Stored directly to R2, bypassing container resizer
await upload('users/u_42/avatar.png', avatar, {
  variants: [{ name: 'thumb', file: clientThumb, format: 'webp' }],
});
```

### 2. Delivery: Serving & Edge Caching

Deterministic URLs map to original assets or rendered variants. Assets are cached at the Cloudflare edge with immutable headers and ETag validation.

```ts
import { url } from '@irpclib/r2-image';

// Semantic named presets
const thumbUrl = url('/users/u_42/avatar.png', { name: 'thumb' });

// Orientation-agnostic cap on the longest edge (?s=640)
const feedUrl = url('/photos/travel.jpg', { size: 640 });

// Dynamic dimension and format targeting (?w=800&h=450&fit=cover&f=webp&q=80)
const heroUrl = url('/catalog/hero.png', {
  width: 800,
  height: 450,
  fit: 'cover',
  format: 'webp',
  quality: 80,
});
```

When `onDemand: false` is configured, only pre-rendered variants and originals are delivered, returning clean 404s for arbitrary dynamic transforms.

### 3. Mutation: Asset Replacement & Cache Invalidation

Overwriting an asset at an existing path automatically purges all stale variants and eagerly regenerates active variants defined in the request or worker config.

```ts
// Overwriting photo.png immediately purges old variants and warms new presets
await upload('users/u_42/avatar.png', newAvatarFile, {
  resize: [{ name: 'display', width: 256, height: 256, format: 'webp' }],
});
```

### 4. Teardown: Deleting & Storage Cleanup

Deleting an asset triggers a cascading purge across all pre-rendered and on-demand variants in R2 without affecting sibling files in the same directory.

```ts
import { info, remove } from '@irpclib/r2-image';

// Inspect asset metadata and dimensions
const metadata = await info('/users/u_42/avatar.png');
console.log(metadata?.size, metadata?.uploadedAt);

// Atomically delete original asset and all associated variants
await remove('/users/u_42/avatar.png');
```

---

## Security & Access Control

- **Mutation Gating**: Protects `upload` and `remove` behind `R2_IMAGE_API_KEY` while keeping binary delivery endpoints (`GET /*`) open for public consumption.
- **Allowed Sizes Whitelist (`allowedSizes`)**: Guards against DoS and uncontrolled compute by restricting allowed transformation dimensions or presets. Disallowed sizes are gracefully skipped:
  - **On upload**: Disallowed variant specifications are skipped without error.
  - **On on-demand delivery**: Dynamic transformation is skipped and the original image is served directly, preventing container execution and cache pollution.
- **Origin Validation & Hotlink Protection**: Restricts asset delivery to domains specified in `R2_IMAGE_ORIGINS`, responding to browser CORS preflight (`OPTIONS`) requests automatically.
- **Private Container Network Isolation**: Containers run in a private network sandbox without public IP addresses or routes. All traffic is mediated by the Worker.

---

## Deployment & Setup

### 1. Worker Entrypoint (`src/index.ts`)

Export the `ImageResizer` class extending `Container` from `@cloudflare/containers` alongside the primary worker fetch handler:

```ts
import { Container } from '@cloudflare/containers';
import { createWorker } from '@irpclib/r2-image/worker';

export class ImageResizer extends Container {
  defaultPort = 8080;
}

export default createWorker({
  // Default variants to generate on upload when not specified in upload()
  sizes: [
    { name: 'display', width: 800, height: 600, format: 'webp' },
    { name: 'thumb', width: 120, height: 120, format: 'webp' },
  ],
  // Whitelist guard: numbers match width/height; objects match exact presets
  allowedSizes: [
    120, 256, 800,
    { name: 'thumb', width: 120, height: 120, format: 'webp' },
  ],
  onDemand: true, // Set to false to disable dynamic transformations
  cache: {
    browserTtl: 86400,
    edgeTtl: 604800,
  },
});
```

### 2. Cloudflare Bindings (`wrangler.jsonc`)

Cloudflare Workers can pull the prebuilt container image directly from GHCR without maintaining a local `Dockerfile`:

```jsonc
{
  "name": "media-service",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-11",
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "production-images"
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

> [!TIP]
> To build a custom container image instead of using the prebuilt registry image, refer to [DOCKER.md](file:///Users/mahdaen/Domains/beerush.io/anchor/irpc-kits/r2-image/DOCKER.md).

### 3. Container Privacy & Network Boundaries

| Concern | Guarantee |
| :--- | :--- |
| **Public Exposure** | **Strictly Private.** Cloudflare Containers have no public IPs or DNS routes. Direct internet access is impossible. |
| **Ingress Path** | Invocations occur exclusively via internal Durable Object RPC (`env.RESIZER.get(...)`). |
| **Edge Cache Shield** | Repeat requests are served from `caches.default`. The container is never invoked for cached variants. |
| **Lockdown Defense** | When `onDemand: false` is set, unrendered dynamic transforms are rejected at the edge with 404, preventing container execution by public clients. |
| **Flexible Topologies** | `RESIZER` also accepts a Cloudflare Service Binding (`Fetcher`) or private HTTP URL (`string`). |

### 4. Environment Variables & Bindings

| Variable | Type | Description |
| :--- | :--- | :--- |
| `IMAGES` | R2 Bucket Binding | Cloudflare R2 bucket storing original media and cached variants. |
| `RESIZER` | Container / Service Binding | Durable Object namespace, Service Binding Fetcher, or HTTP URL for the resizer container. |
| `R2_IMAGE_API_KEY` | Secret (Optional) | Required authentication token for mutating RPC operations (`upload`, `remove`). |
| `R2_IMAGE_ORIGINS` | Var (Optional) | Comma-separated allowed origins (e.g. `https://myapp.com`) for CORS and hotlink enforcement. |

---

## License

MIT © [AirLib](https://airlib.dev)

