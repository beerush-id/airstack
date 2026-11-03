---
name: airlib-r2-image
description: Use when building image storage, dynamic resizing, responsive image delivery, format optimization (WebP/AVIF), or Cloudflare R2/Containers media backends in an AirLib project
---

# AirLib R2 Image Router

The image optimization, storage, and edge delivery guide for applications built with **@irpclib/r2-image** on Cloudflare Workers, R2, and Containers.

IMPORTANT: Read only what you need. Match your architectural concern to the decision matrix below, then read only the corresponding topic guide in `contents/`. Do not load all files into context.

---

## Image Decision Matrix: What are you building?

| What architectural concern are you addressing? | Topic Guide to Read |
|---|---|
| **"How do I upload images, eagerly generate variants, track progress, or cascade-delete assets?"** | [contents/storage-uploads.md](./contents/storage-uploads.md) |
| **"How do I construct responsive image URLs, normalize photo orientations, or format variants for UI display?"** | [contents/image-delivery.md](./contents/image-delivery.md) |
| **"How do I configure the Cloudflare Worker, bind the private resizer container, or colocate image endpoints in a full-stack app?"** | [contents/worker-deployment.md](./contents/worker-deployment.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or configuration option in image code? Look it up here:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `upload`, `upload.later`, `resize`, `info`, `remove`, `configure`, `IRPCFile`, `ImageUploadOptions`, `@irpclib/r2-image` | [contents/storage-uploads.md](./contents/storage-uploads.md) |
| `url`, `Resize`, `size`, `s`, `fit`, `blur`, `quality`, `format`, `@irpclib/r2-image` | [contents/image-delivery.md](./contents/image-delivery.md) |
| `createWorker`, `ImageResizer`, `Container`, `resolveBinding`, `ImageWorkerConfig`, `allowedSizes`, `onDemand`, `ghcr.io/beerush-id/r2-image:latest`, `@irpclib/r2-image/worker`, `@irpclib/irpc/wrangler`, `@cloudflare/containers` | [contents/worker-deployment.md](./contents/worker-deployment.md) |

---

## Questions & Tasks Covered by Each Topic

### [Image Storage & Uploads](./contents/storage-uploads.md)
Load this topic when you need to answer:
- How do I upload an image file from a browser or server to Cloudflare R2?
- How do I eagerly generate responsive thumbnails during the upload request?
- How do I bind upload progress to reactive UI components with `.later()`?
- How do I pre-render image variants on the client device using WebAssembly to eliminate server container costs?
- How do I inspect stored image metadata (size, MIME type, ETag, timestamp)?
- How do I purge an original image and ensure all derived thumbnail variants are deleted in one operation?
- How do I configure global base URLs and API authentication keys for client mutations?

### [Image Delivery & URL Formatting](./contents/image-delivery.md)
Load this topic when you need to answer:
- How do I generate optimized image URLs for standard `<img>` tags?
- How do I scale photos with mixed orientations (portrait and landscape) without distortion or hardcoded dimensions?
- What query parameters are supported for formatting, quality, fit, and Gaussian blur?

### [Worker & Container Deployment](./contents/worker-deployment.md)
Load this topic when you need to answer:
- How do I configure a Cloudflare Worker to serve and transform images via private containers?
- How do I protect image infrastructure against arbitrary resizing query attacks using `allowedSizes`?
- How do I use R2 Image as an on-demand optimization layer on top of an existing R2 bucket?
- How do I colocate the image service worker inside an existing full-stack AirLib application without route collisions?
- How do I configure `wrangler.jsonc` with Cloudflare R2 bucket and Container bindings?
- How do I deploy a standalone image microservice or delivery-only gateway?
- What environment variables and secret bindings are required for production?
