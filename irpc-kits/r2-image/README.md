# IRPC R2 Image

High-performance image delivery, edge caching, and isomorphic uploads for Cloudflare Workers, R2, and Cloudflare Containers.

Built on [**IRPC**](https://airlib.dev/docs/remote-function) and [**@napi-rs/image**](https://image.napi.rs).

---

## Features

- **Dual-Plane Architecture**:
  - **IRPC Plane (`/irpc`)**: Type-safe isomorphic file uploads (`IRPCFile`), metadata inspection, and deletions with reactive `.later()` bindings.
  - **Edge Delivery Plane (`GET /*`)**: Instant binary streaming for `<img>` tags powered by Cloudflare `caches.default`.
- **Private Container Resizer**: Executes inside a native Cloudflare Container (Durable Object) using `@napi-rs/image` Rust `Transformer`. Zero public exposure, scale-to-zero when idle.
- **Zero Egress Fees**: Stores raw originals and generated variants directly in Cloudflare R2.
- **Eager Variant Generation**: Generates responsive variants synchronously during upload so they are instantly warm and cached when the user finishes uploading.

---

## 1. Cloudflare Worker Deployment

### `wrangler.jsonc`

```jsonc
{
  "name": "image-service",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-11",
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "my-images-bucket"
    }
  ],
  "containers": [
    {
      "class_name": "ImageResizer",
      "image": "./Dockerfile", // or "ghcr.io/airlib-dev/r2-image-resizer:latest"
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

### Worker Entry (`src/index.ts`)

```ts
import { createWorker } from '@irpclib/r2-image/worker';

export default createWorker();
```

---

## 2. Client Application Usage

### Installation

```bash
bun add @irpclib/r2-image @irpclib/irpc @irpclib/http
```

### Configuration (Optional for Cross-Origin / Auth)

If your worker runs on a dedicated domain or requires an API key for uploads:
```ts
import { configure } from '@irpclib/r2-image';

configure({
  baseUrl: 'https://images.example.com', // Base domain for both IRPC and url()
  apiKey: 'sk_live_my_upload_key', // Optional: only if R2_IMAGE_API_KEY is configured
});
```

### Uploading Images

Destination `path` supports folders (preserves `file.name`) or explicit filepaths. Stored path is always normalized to `'/path/to/file.ext'`:

```ts
import { resize, upload, url } from '@irpclib/r2-image';
import { IRPCFile } from '@irpclib/irpc';

async function handleUpload(file: File) {
  const irpcFile = new IRPCFile(
    { name: file.name, size: file.size, type: file.type },
    file
  );

  // 1. Client-side pre-resized variant (stored directly without container invocation)
  const thumb = await resize(irpcFile, { width: 128, height: 128, fit: 'cover', format: 'webp' });

  // 2. Upload to folder (e.g. '/avatars' -> '/avatars/photo.png') or explicit filepath
  const stream = upload('/avatars', irpcFile, {
    variants: [{ file: thumb, width: 128, height: 128, format: 'webp' }],
    resize: [{ width: 512, height: 512, fit: 'cover', format: 'webp' }],
  });

  // 3. Track step and progress updates in real-time
  stream.subscribe((state) => {
    console.log(`[${state.step}] ${state.progress}`);
  });

  const result = await stream;
  console.log('Stored path:', result.path); // e.g. '/avatars/photo.png'
  console.log('Public URL:', url(result.path, { width: 128, height: 128 }));
}
```

### Image Rendering & URLs

Use `url()` to generate deterministic variant URLs:

```ts
import { url } from '@irpclib/r2-image';

// Format: /photos/vacation.png?w=600&h=400&f=webp&q=85&fit=cover
const cardImageUrl = url('/photos/vacation.png', {
  width: 600,
  height: 400,
  format: 'webp',
  quality: 85,
  fit: 'cover',
});
```

### Inspecting & Deleting Images

```ts
import { info, remove } from '@irpclib/r2-image';

// Inspect metadata
const meta = await info('/avatars/photo.png');
console.log(meta?.path, meta?.type, meta?.size);

// Delete original and all generated variants
await remove('/avatars/photo.png');
```

---

## 3. Environment Variables & Security

| Variable | Type | Description |
| :--- | :--- | :--- |
| `IMAGES` | R2 Bucket Binding | Cloudflare R2 bucket for storing originals and cached variants. |
| `RESIZER` | Container Binding | Durable Object Container namespace or Service Binding. |
| `R2_IMAGE_API_KEY` | Secret (Optional) | Secret key required for mutating operations (`upload`, `delete`). |
| `R2_IMAGE_ORIGINS` | Var (Optional) | Comma-separated allowed origins (e.g. `https://myapp.com,https://admin.myapp.com`) for CORS and hotlink protection. |

---

## License

MIT © [AirLib](https://airlib.dev)
