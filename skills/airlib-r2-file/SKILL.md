---
name: airlib-r2-file
description: Use when building cloud filesystem storage, document-driven applications, binary streaming, POSIX paths, or Cloudflare R2 and D1 backends in an AirLib project
---

# AirLib R2 File Router

The isomorphic cloud filesystem and edge delivery guide for applications built with **@irpclib/r2-file** on Cloudflare R2, D1, and Workers.

IMPORTANT: Read only what you need. Match your architectural concern to the decision matrix below, then read only the corresponding topic guide in `contents/`. Do not load all files into context.

---

## Filesystem Decision Matrix: What are you building?

| What architectural concern are you addressing? | Topic Guide to Read |
|---|---|
| **"How do I write, read, list, search, copy, move, symlink, or soft-delete files and folders?"** | [contents/file-operations.md](./contents/file-operations.md) |
| **"How do I resolve user home paths, enforce multi-tenancy, clamp mount roots, or declare access control rules?"** | [contents/paths-security.md](./contents/paths-security.md) |
| **"How do I configure the edge worker, colocate with full-stack AirLib apps, bind R2 and D1, or stream audio/video?"** | [contents/worker-deployment.md](./contents/worker-deployment.md) |

---

## Symbol & Code Lookup

Saw an unfamiliar symbol, method, or configuration option in filesystem code? Look it up here:

| Symbol / Keyword Seen in Code | Topic Guide to Read |
|---|---|
| `write`, `read`, `stat`, `exists`, `mkdir`, `list`, `search`, `copy`, `move`, `link`, `remove`, `restore`, `IRPCFile`, `IRPCBlob`, `@irpclib/r2-file` | [contents/file-operations.md](./contents/file-operations.md) |
| `fsContext`, `setContext`, `homeDir`, `mountPoint`, `accessRules`, `ownerId`, `FileOperation`, `strict`, `enforced`, `@irpclib/r2-file/context` | [contents/paths-security.md](./contents/paths-security.md) |
| `createWorker`, `createFs`, `FileAdapter.use`, `FileDriver`, `@irpclib/r2-file/adapter`, `resolveBinding`, `FileWorkerConfig`, `BUCKET`, `DB`, `FILE_API_KEY`, `FILE_SECRET`, `@irpclib/r2-file/worker`, `@irpclib/r2-file/fs`, `@irpclib/irpc/wrangler` | [contents/worker-deployment.md](./contents/worker-deployment.md) |

---

## Questions & Tasks Covered by Each Topic

### [Filesystem Operations](./contents/file-operations.md)
Load this topic when you need to answer:
- How do I write typed JSON, plain text, Base64, or binary files to storage?
- How do I read file content as parsed JSON or stream binary bytes with reactive progress tracking?
- How do I check if a file exists or inspect its metadata without downloading its content?
- How do I list directory contents with multi-field sorting, filtering, and pagination?
- What identifies a file, and what happens to that identity on move or rename?
- How do I search files by name and indexed metadata using D1 B-tree indexes?
- How do I duplicate or move file and directory trees without table locks or database migrations?
- How do I create symbolic links that dynamically resolve to target resources?
- How do I implement soft deletion, inspect the recycle bin, and restore deleted files?

### [Paths & Access Control](./contents/paths-security.md)
Load this topic when you need to answer:
- How do home-relative (`~`), mount-absolute (`/`), and working-directory (`./`) paths resolve?
- How does universal root clamping (`/.. === /`) prevent path traversal and silent redirection?
- How do I isolate tenant workspaces (`mountPoint`) while returning clean canonical paths to clients?
- How do I inject ambient security context (`fsContext`) in authentication middleware?
- Does the owner field isolate users, and when are access rules actually enforced?
- How do I grant granular capability rules across team folders and public assets?
- How do I prevent accidental catastrophic deletion using the strict deletion policy?

### [Worker & Edge Deployment](./contents/worker-deployment.md)
Load this topic when you need to answer:
- How do I initialize the filesystem edge worker with R2 storage and D1 relational indexing?
- How do I colocate the filesystem service inside an existing full-stack AirLib application in `src/worker.ts`?
- How do I configure `wrangler.jsonc` with R2 bucket bindings and D1 database IDs?
- How do I run filesystem operations directly inside Cloudflare Workers using `createFs`?
- How do I react to file changes (indexing, auditing) when the filesystem emits no events?
- How do I deliver files with HTTP 206 Partial Content range seeking for video and audio scrubbing?
- How do I generate signed, expiring download URLs for private assets?
- How do I handle typed errors (`ENOENT`, `EEXIST`, `EACCES`, `EFBIG`, `ENOTEMPTY`)?
