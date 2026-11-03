# Image Storage & Uploads

This guide establishes the conventions for uploading images, eagerly generating responsive variants, tracking progress in reactive UI components, and managing lifecycle operations using `@irpclib/r2-image`.

---

## Uploading Images to Cloudflare R2

The `upload()` function transfers binary assets packaged as `IRPCFile` instances to Cloudflare R2 via IRPC. It supports immediate server-side variant generation and reactive status tracking:

```typescript
import { IRPCFile } from '@irpclib/irpc';
import { upload } from '@irpclib/r2-image';

const payload = new IRPCFile(
  { name: file.name, size: file.size, type: file.type },
  file
);

// Uploads original and generates responsive variants in R2 in a single request
const result = await upload('/users/1/avatar.png', payload, {
  sizes: [
    { name: 'thumbnail', width: 128, height: 128, format: 'webp' },
    { name: 'preview', size: 800, format: 'webp' },
  ],
});

console.log('Saved to:', result.path, `(${result.size} bytes)`);
```

---

## Reactive UI Component Integration (`.later()`)

In reactive user interfaces, wrap the upload operation with `upload.later()`. This binds the asynchronous execution lifecycle directly to component rendering:

#### React
```tsx
import { setup } from '@airlib/react';
import { IRPCFile } from '@irpclib/irpc';
import { upload } from '@irpclib/r2-image';

export const AvatarUploader = setup(() => {
  const uploader = upload.later();

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const payload = new IRPCFile(
      { name: file.name, size: file.size, type: file.type },
      file
    );

    uploader.dispatch('/users/avatar.png', payload, {
      sizes: [
        { name: 'thumb', width: 128, height: 128, format: 'webp' },
        { name: 'preview', size: 800, format: 'webp' },
      ],
    });
  };

  return () => {
    if (uploader.status === 'pending') {
      return (
        <div className="uploading-state">
          <span>{uploader.data?.progress ?? 'Processing image...'}</span>
          <span className="step-tag">Step: {uploader.data?.step}</span>
        </div>
      );
    }

    return (
      <input type="file" accept="image/*" onChange={onFileChange} />
    );
  };
});
```

#### SolidJS
```tsx
import { setup } from '@airlib/solid';
import { IRPCFile } from '@irpclib/irpc';
import { upload } from '@irpclib/r2-image';

export const AvatarUploader = setup(() => {
  const uploader = upload.later();

  const onFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const payload = new IRPCFile(
      { name: file.name, size: file.size, type: file.type },
      file
    );

    uploader.dispatch('/users/avatar.png', payload, {
      sizes: [
        { name: 'thumb', width: 128, height: 128, format: 'webp' },
        { name: 'preview', size: 800, format: 'webp' },
      ],
    });
  };

  return () => {
    if (uploader.status === 'pending') {
      return (
        <div class="uploading-state">
          <span>{uploader.data?.progress ?? 'Processing image...'}</span>
          <span class="step-tag">Step: {uploader.data?.step}</span>
        </div>
      );
    }

    return (
      <input type="file" accept="image/*" onChange={onFileChange} />
    );
  };
});
```

---

## Eager Server-Side Variant Presets

Passing `sizes` to `upload()` instructs the private container resizer to render and store variants immediately during upload. The caller only receives a response once all requested assets are safely persisted to R2:

```typescript
interface Resize {
  name?: string;                             // Preset name accessed via ?name=preset
  size?: number;                             // Longest-edge bound (aspect ratio preserved)
  width?: number;                            // Explicit pixel width
  height?: number;                           // Explicit pixel height
  format?: 'webp' | 'avif' | 'png' | 'jpeg'; // Compression format (default: 'webp')
  quality?: number;                          // Quality 1-100 (default: 80)
  fit?: 'cover' | 'contain' | 'inside';      // Fit strategy
  blur?: number;                             // Gaussian blur radius for LQIP placeholders
}
```

### Example
```typescript
await upload('/products/item-1.jpg', payload, {
  sizes: [
    { name: 'thumb', width: 120, height: 120, format: 'webp' },
    { name: 'catalog', size: 600, format: 'webp' },
    { name: 'zoom', size: 1600, format: 'webp' },
    { name: 'lqip', width: 24, blur: 5, format: 'webp' },
  ],
});
```

---

## Client-Side Pre-Rendering (`resize`)

To eliminate server container execution and compute billing, pre-render variants on the client device using WebAssembly before uploading:

```typescript
import { resize, upload } from '@irpclib/r2-image';

// Pre-render variant on the client device
const thumbFile = await resize(rawFile, {
  width: 128,
  height: 128,
  format: 'webp',
});

// Upload original and pre-rendered variant directly to R2
await upload('/users/avatar.png', rawFile, {
  variants: [
    { name: 'thumb', file: thumbFile, format: 'webp' },
  ],
});
```

> [!NOTE]
> Client-side resizing executes `@napi-rs/image` via WebAssembly (`.wasm`). It trades off server container compute billing in exchange for client device processing, additional upload bandwidth, and WASM bundle size.

---

## Metadata Inspection (`info`)

Retrieve storage details and headers for any stored image:

```typescript
import { info } from '@irpclib/r2-image';

const metadata = await info('/users/1/avatar.png');

if (metadata) {
  console.log('Path:', metadata.path);
  console.log('MIME Type:', metadata.type);
  console.log('File Size:', metadata.size);
  console.log('Uploaded At:', metadata.uploadedAt);
  console.log('ETag:', metadata.etag);
}
```

---

## Cascading Asset Deletion (`remove`)

Deleting an asset automatically purges the original file and every co-located variant matching the file prefix:

```typescript
import { remove } from '@irpclib/r2-image';

// Purges the source asset and all generated variants in R2
await remove('/users/1/avatar.png');
```

---

## Client Configuration (`configure`)

In `src/api.ts`, configure the base URL for public delivery and custom endpoint paths for mutation operations:

```typescript
import { configure } from '@irpclib/r2-image';

configure({
  baseUrl: 'https://images.example.com',
  endpoint: '/r2-image-irpc',
  apiKey: process.env.IMAGE_SERVICE_API_KEY,
});
```
