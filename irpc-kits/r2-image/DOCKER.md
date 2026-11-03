# R2 Image Resizer

Stateless, high-throughput image resizing microservice powered by [Bun](https://bun.sh) and native Rust image transformations via [@napi-rs/image](https://image.napi.rs).

Designed for **fire-and-forget** image processing inside Cloudflare Containers (Durable Objects), Docker, Kubernetes, or standalone services.

---

## Quick Start

### Docker

```bash
# Run standalone container on port 8080
docker run -d -p 8080:8080 ghcr.io/beerush-id/r2-image:latest
```

### Bun CLI

```bash
# Run directly with bunx
bunx @irpclib/r2-image
```

---

## HTTP API

The service exposes a minimal, zero-overhead HTTP interface accepting binary payloads.

### 1. Healthcheck

Verify container liveness and readiness:

```http
GET /health
```

**Response**: `200 OK` (`text/plain: OK`)

---

### 2. Transform Image

Stream raw image bytes in the request body with target parameters in the query string.

```http
POST /resize?w=300&h=200&f=webp&q=85
Content-Type: application/octet-stream

<raw image bytes>
```

#### Query Parameters

| Parameter | Alias | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `width` | `w` | `number` | Original | Target width in pixels. If height is omitted, aspect ratio is preserved. |
| `height` | `h` | `number` | Original | Target height in pixels. If width is omitted, aspect ratio is preserved. |
| `format` | `f` | `string` | `webp` | Target format: `webp`, `avif`, `png`, or `jpeg` (`jpg`). |
| `quality` | `q` | `number` | `80` | Compression quality from `1` to `100`. |
| `fit` | — | `string` | `cover` | Crop strategy: `cover`, `contain`, or `inside`. |
| `blur` | `b` | `number` | `0` | Gaussian blur radius in pixels (useful for LQIP placeholders). |

#### Response Headers

| Header | Value | Description |
| :--- | :--- | :--- |
| `Content-Type` | `image/webp`, `image/avif`, etc. | Output image MIME type. |
| `Content-Length` | `<bytes>` | Exact size of the transformed payload. |

#### Status Codes

- `200 OK`: Transformation successful, binary stream returned.
- `400 Bad Request`: Empty image body, invalid parameters, or decompression bomb protection triggered (> 64 MP).
- `405 Method Not Allowed`: Method is not `POST` (or `GET` for `/health`).

---

## Usage Examples

### Basic Resize

```bash
curl -X POST "http://localhost:8080/resize?w=640&h=360&f=webp" \
  --data-binary @hero.png \
  -H "Content-Type: application/octet-stream" \
  -o hero-640.webp
```

### Blurred Placeholder (LQIP)

```bash
curl -X POST "http://localhost:8080/resize?w=24&h=24&blur=10&f=webp" \
  --data-binary @avatar.jpg \
  -o avatar-lqip.webp
```

### Aspect-Ratio Preserving Thumbnail

```bash
# Specifying only width scales height proportionally
curl -X POST "http://localhost:8080/resize?w=150&f=avif&q=75" \
  --data-binary @product.jpg \
  -o product-thumb.avif
```

---

## Configuration

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port for the HTTP server to listen on. |

---

## Cloudflare Containers Integration

To use this container with Cloudflare Workers:

```jsonc
// wrangler.jsonc
{
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
  }
}
```

```ts
// src/index.ts
import { Container } from '@cloudflare/containers';

export class ImageResizer extends Container {
  defaultPort = 8080;
}
```

---

## License

MIT © [AirLib](https://airlib.dev)
