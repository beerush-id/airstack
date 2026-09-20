# Image Delivery & URL Formatting

This guide establishes the conventions for serving optimized images, constructing responsive URLs, and formatting image queries with `@irpclib/r2-image`.

---

## Native HTML Delivery

Images stored in R2 are served through standard HTTP `GET` requests using native HTML `<img>` elements. No framework wrappers, DOM-polluting containers, or vendor-locked URL domains are required:

```html
<!-- Native HTML <img> with manual query parameters -->
<img src="/photos/hero.jpg?s=640&f=webp" alt="Hero" loading="lazy" />

<!-- Native HTML <img> with url() helper -->
<img src={url('/photos/hero.jpg', { size: 640, format: 'webp' })} alt="Hero" loading="lazy" />
```

The `url()` helper formats the delivery URL with query parameters:

```typescript
const heroUrl = url('/photos/hero.jpg', {
  size: 640,
  format: 'webp',
  quality: 85,
});
// Result: /photos/hero.jpg?s=640&f=webp&q=85
```

---

## Longest-Edge Orientation Normalization (`size` / `s`)

Hardcoded width and height parameters distort layouts when users upload photos of varying orientations. The `size` (or `s`) parameter constrains whichever dimension is longest, scaling the opposing axis proportionally:

- **Landscape images**: caps width to `size` and scales height proportionally.
- **Portrait images**: caps height to `size` and scales width proportionally.
- **Square images**: scales both axes equally.

```typescript
import { url } from '@irpclib/r2-image';

// Bounds the longest edge to 800px regardless of aspect ratio
const responsiveUrl = url('/gallery/photo.jpg', { size: 800, format: 'webp' });
```

---

## Query Parameter Reference

The `url()` helper and image endpoint support the following options:

| Parameter | Query Key | Type | Description |
|---|---|---|---|
| **Named Preset** | `name`, `v` | `string` | Resolves a pre-configured variant defined in the worker configuration. |
| **Longest Edge** | `s`, `size` | `number` | Bounds the maximum dimension across width and height while maintaining aspect ratio. |
| **Target Width** | `w`, `width` | `number` | Sets an explicit pixel width. |
| **Target Height** | `h`, `height` | `number` | Sets an explicit pixel height. |
| **Image Format** | `f`, `format` | `'webp' \| 'avif' \| 'png' \| 'jpeg'` | Encodes output image format. |
| **Quality** | `q`, `quality` | `number` (1–100) | Compression quality (default: 80). |
| **Fit Strategy** | `fit` | `'cover' \| 'contain' \| 'inside'` | Content fitting strategy when both width and height are specified. |
| **Gaussian Blur** | `b`, `blur` | `number` | Applies Gaussian blur radius (useful for LQIP placeholders). |
