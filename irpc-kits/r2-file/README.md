# AirLib R2 File

A natural file system for Cloudflare Workers: `mkdir`, `write`, `read`, `stat`, `exists`, `list`, `search`, `copy`, `move`, `link`, `remove`, `restore` — one API that works from the browser, from a worker, or in-process on the server. Files live in R2; an optional D1 index makes listings and small text/JSON reads come back in sub-milliseconds.

Built on [**IRPC**](https://airlib.dev/docs/remote-function).

---

## Installation

```bash
bun add @irpclib/r2-file @irpclib/irpc
```

---

## Quick Start

Deploy one worker that stores your files and serves them:

```ts
// src/worker.ts
import { createWorker } from '@irpclib/r2-file/worker';

export default createWorker({
  public: ['banners/**'],                      // open paths; the rest need a signed URL
  cors: { origin: 'https://app.example.com' },
});
```

Then use it from anywhere like a local filesystem — same-origin needs no setup at all:

```ts
import fs from '@irpclib/r2-file';

await fs.write('~/notes/todo.md', '# Today\n- ship it');
const text = await fs.read('~/notes/todo.md', { encoding: 'text' });
```

Only when the worker lives on another origin, or you set `FILE_API_KEY`, point the stubs at it:

```ts
import { configure } from '@irpclib/r2-file';

configure({ baseUrl: 'https://files.example.com', apiKey: 'your-api-key' });
```

Inside a worker that already has the bindings, skip HTTP entirely — the exact same operations run in-process:

```ts
import { createFs } from '@irpclib/r2-file/fs';

const fs = createFs({ bucket: env.BUCKET, indexer: env.DB });
```

---

## Working With Files

Writes take text, JSON, or binary files — nothing else, and nothing to configure. Reads give back exactly the form you ask for:

```ts
// text
await fs.write('~/notes/todo.md', '# Today\n- ship it');

// JSON — objects and arrays serialize automatically
await fs.write('~/uploads/report.json', { quarter: 'Q4', growth: 0.12 });
const report = await fs.read('~/uploads/report.json', { encoding: 'json' });

// binary — stream a browser File up without buffering it
import { IRPCFile } from '@irpclib/irpc';
const photo = new IRPCFile({ name: file.name, size: file.size, type: file.type }, file);
await fs.write('~/uploads/photo.jpg', photo);

// read anything back in any form, regardless of how it was written
const asBase64 = await fs.read('~/uploads/photo.jpg', { encoding: 'base64' });
const asDataUrl = await fs.read('~/uploads/photo.jpg', { encoding: 'data-url' });

// or get a delivery reference: a URL you can hand to an <img>, plus metadata
const blob = await fs.read('~/uploads/photo.jpg');
img.src = blob.url;
```

Oversized payloads are rejected on the client before they ever upload — tune the budgets with `configure`:

```ts
configure({ maxSize: 26214400, maxEncodingSize: 512000 });
```

Organize, find, and rearrange:

```ts
await fs.mkdir('~/notes/2026');
await fs.exists('~/notes/todo.md');                      // true
await fs.stat('~/notes/todo.md');                        // size, type, timestamps
await fs.list('~/notes');                                // directory entries
await fs.search('todo');                                 // by name, recursive under home
await fs.copy('~/notes/todo.md', '/shared/todo.md');
await fs.move('~/notes/old.md', '~/archive/old.md');
await fs.link('~/notes/todo.md', '~/shortcut.md');
```

Deletes are recoverable when you want them to be:

```ts
const fs = createFs({ bucket, strict: true, softDelete: true });

await fs.remove('~/drafts', { recursive: true });   // trashed: hidden, restorable
await fs.list('~', { trash: true });                 // the recycle bin
await fs.restore('~/drafts');                        // back with original metadata
```

With `strict: true`, a non-empty directory cannot be deleted unless the server-side context explicitly enforces it — a client can never force a permanent purge.

---

## Paths & Scopes

Every path is POSIX and resolves the same everywhere:

| Form | Resolves to |
| --- | --- |
| `~/notes.txt` | the actor's home (`fsContext.homeDir`, default `/home`) |
| `/shared/spec.md` | canonical absolute path across the whole mount |
| `notes.txt`, `./a`, `../b` | against `options.cwd`, falling back to home |

`..` clamps at the root (`/.. === /`). Give each user a home and control what they can reach outside it:

```ts
import { fsContext } from '@irpclib/r2-file/context';

fsContext.set({
  ownerId: 'alice',
  homeDir: '/users/alice',
  accessRules: [{ path: '/shared/**', allow: ['read', 'write'] }],
});
```

When `accessRules` are active, any target outside home needs a matching rule, and rules grant per operation.

Three deployment shapes come out of these same primitives:

- **Open** — no identity, everything under `/`.
- **User-scoped** — one filesystem, per-user homes, sharing through canonical paths + rules.
- **Multi-tenant** — physical partitioning with `mountPoint: '/tenants/<id>'` on top of user scoping. The mount never appears in any path you get back.

---

## Serving Files

`GET` on your worker serves any stored file, so a URL is all a client needs:

```html
<img src="https://files.example.com/banners/hero.png">
<video src="https://files.example.com/clips/intro.mp4" controls></video>
```

- `public: true` opens everything; `public: ['banners/**']` opens matching patterns. Every other path needs a signed URL — exactly what `read()` without encoding hands you. Signed URLs expire, and each one is valid for its path only.
- Videos and audio seek natively — byte-range requests are honored.
- Repeat visitors revalidate with ETags and get `304`s.
- Append `?download` to force a save dialog.
- Responses cache at the edge; you control both TTLs (`cache.browserTtl`, `cache.edgeTtl`).
- Traversal attempts, encoded traversal, and null bytes are rejected before storage is touched.

---

## Access Control

- **`FILE_API_KEY`** — set it as a secret and *every* RPC call must carry it (`configure({ apiKey })` on the client). Leave it unset and the API is open; there is no partial mode.
- **`fsContext`** — per-request actor identity: home, sharing rules, enforcement. Seeded per request, never leaked across requests.
- **Signed URLs** — per-fetch access: expiring proof for one path, so you can share a private file without exposing the API.

Every rejection is a typed `HandlerError` with a filesystem code — `EIO`, `ENOENT`, `EEXIST`, `EACCES`, `ENOTEMPTY`, `EFBIG`, `EINVAL` — and a message safe to show users. Diagnostic causes never leave the worker.

---

## Deployment

### Cloudflare Bindings (`wrangler.jsonc`)

```jsonc
{
  "name": "file-service",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-11",
  "r2_buckets": [
    { "binding": "BUCKET", "bucket_name": "production-files" }
  ],
  "d1_databases": [
    { "binding": "DB", "database_name": "production-file-index", "database_id": "<d1-database-id>" }
  ]
}
```

Set `FILE_API_KEY` and `FILE_SECRET` with `wrangler secret put`.

### Environment Variables & Bindings

| Variable | Type | Description |
| --- | --- | --- |
| `BUCKET` | R2 Bucket Binding | Where file bytes are stored. |
| `DB` | D1 Database Binding (Optional) | Metadata index — omit it and R2 serves everything. |
| `FILE_API_KEY` | Secret (Optional) | When set, every RPC call must carry it. |
| `FILE_SECRET` | Secret / Var (Optional) | Signs and verifies delivery URLs. |

### `createWorker` Options

| Option | Default | Effect |
| --- | --- | --- |
| `callable` | `true` | `false` = pure file delivery, zero RPC surface (POSTs 404) |
| `public` | `false` | `true` or pattern list opens unsigned GETs |
| `secret` | env `FILE_SECRET` | Signing key for delivery URLs |
| `endpoint` | `'/irpc'` | RPC route |
| `cache.browserTtl` / `cache.edgeTtl` | 86400 / 2592000 | Cache-Control seconds |
| `cors` | — | Preflight allowance (`origin`, `methods`, `headers`) |

### Registering Stubs In Your Own Worker

Prefer to route requests yourself? Register the handlers inside any worker:

```ts
import { implement } from '@irpclib/r2-file/constructor';

implement({ bucket: env.BUCKET, indexer: env.DB, strict: true, softDelete: true });
```

### Custom Storage Setups

`createFs` builds the full filesystem from the options you pass. For a custom setup, chain drivers yourself:

```ts
import { FileAdapter } from '@irpclib/r2-file/adapter';
import { R2Driver } from '@irpclib/r2-file/drivers/r2';
import { D1Driver } from '@irpclib/r2-file/drivers/d1';

const fs = new FileAdapter({ mountPoint: '/media' })
  .use(new D1Driver(env.DB, { indexableKeys: ['tag'] }))
  .use(new R2Driver(env.BUCKET));
```

---

## Exports

| Entry | Surface |
| --- | --- |
| `@irpclib/r2-file` | isomorphic stubs, `configure` |
| `@irpclib/r2-file/fs` | `createFs` |
| `@irpclib/r2-file/adapter` | `FileAdapter`, driver contract |
| `@irpclib/r2-file/drivers/r2` | `R2Driver` |
| `@irpclib/r2-file/drivers/d1` | `D1Driver` |
| `@irpclib/r2-file/context` | `fsContext` |
| `@irpclib/r2-file/constructor` | `implement` |
| `@irpclib/r2-file/worker` | `createWorker` |

---

## License

MIT © [AirLib](https://airlib.dev)
