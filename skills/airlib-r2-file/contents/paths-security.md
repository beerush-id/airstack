# Paths & Access Control

POSIX path normalization, ambient execution context, tenant mount isolation, and granular capability access rules for `@irpclib/r2-file`.

---

## POSIX Path Conventions

R2 File standardizes path resolution across client stubs and edge workers using standard POSIX rules. All operations accept paths in one of three conventions:

### Home-Relative Paths

Paths prefixed with `~` expand relative to the active user's `$HOME` directory (`ctx.homeDir ?? '/home'`).

```ts
import { write } from '@irpclib/r2-file';

// If ctx.homeDir is '/users/alice', resolves to: /users/alice/notes.txt
// If ctx.homeDir is unset, defaults to: /home/notes.txt
await write('~/notes.txt', 'Alice notes');
```

- **User Isolation**: Keeps client code clean and agnostic of internal user directory structure.
- **Access Rule Exemption**: Operations inside the user's `homeDir` bypass external path capability checks by default.

### Mount-Root Absolute Paths

Paths starting with `/` are canonical across the entire filesystem mount partition.

```ts
import { read } from '@irpclib/r2-file';

// Canonical mount path: unaffected by user identity or active working directory
await read('/shared/team-a/spec.md');
```

- **Immune to Path Drift**: Absolute paths resolve identically regardless of the active user or current working directory (`cwd`). Storing canonical paths in database records guarantees all collaborators reference the same resource.
- **Access Rule Validation**: If active access rules are configured, accessing a path outside `homeDir` requires a matching authorized rule.

### Working-Directory Relative Paths

Paths starting with `./` or `../` resolve relative to the active working directory (`cwd`).

```ts
import { read } from '@irpclib/r2-file';

// If cwd is '/users/alice/projects/app', resolves to: /users/alice/projects/app/config.json
await read('./config.json');
```

---

## Universal Root Clamping

Traditional filesystems often silently clamp parent traversal at artificial boundaries (such as clamping `~/../..` back to `~/`). This causes silent data corruption where an operation intended for an upper directory is executed inside the user folder.

R2 File enforces a single universal clamping boundary at the mount root `/`:

```ts
/.. === /
/users/alice/../../.. === /
```

- **Clean Syntactic Resolution**: Parent traversal (such as `~/..` resolving to `/users`) is syntactically preserved.
- **Explicit Access Boundaries**: Escaping an unauthorized folder is rejected explicitly with `HandlerError('EACCES', 'Permission denied')`, never by silent path redirection.

---

## Storage Mount Isolation

When configuring a filesystem worker or instance, a physical `mountPoint` partitions storage for multi-tenant isolation:

```ts
import { createWorker } from '@irpclib/r2-file/worker';

export default createWorker({
  mountPoint: '/tenants/org_alpha',
});
```

- **Inward Resolution**: The storage engine automatically prepends `mountPoint` to storage keys before querying R2 or D1.
- **Outward Stripping**: All returned `FileInfo.path` properties reflect canonical paths from the client's perspective (e.g. `/documents/report.pdf`). The underlying partition `/tenants/org_alpha` is completely hidden and never leaked over the wire.

---

## Ambient Execution Context

Authentication and tenancy context flow ambiently through `fsContext`. Middleware populates the context once per request, eliminating the need to thread user credentials through individual calls:

```ts
export type FsContext = {
  ownerId?: string;                // Active user or actor ID
  onBehalf?: string;               // Impersonated actor ID
  homeDir?: string;                // User's home folder ($HOME)
  accessRules?: AccessRuleEntry[]; // Declarative path and capability rules
  enforced?: boolean;              // Privileged admin override flag
};
```

### Setting Context in Worker Middleware

Use `setContext()` from `@irpclib/irpc` within `worker.router.use()` to attach credentials to the active request:

```ts
import { setContext } from '@irpclib/irpc';
import { createWorker } from '@irpclib/r2-file/worker';
import { fsContext } from '@irpclib/r2-file/context';

const fileWorker = createWorker({
  endpoint: '/r2-file-irpc',
});

fileWorker.router.use(async () => {
  const user = await authenticateRequest();

  // Populate ambient filesystem context for all downstream operations
  setContext(fsContext, {
    ownerId: user.id,
    homeDir: `/users/${user.id}`,
    accessRules: [
      `/teams/${user.teamId}/**`,
      { path: '/public/**', allow: ['read', 'list'] },
    ],
  });
});

export default fileWorker;
```

---

## Declarative Access Rules

Paths outside a user's `homeDir` require matching access rules. Rules specify target path patterns and permitted operations:

```ts
export type FileOperation =
  | 'mkdir'
  | 'write'
  | 'read'
  | 'stat'
  | 'exists'
  | 'list'
  | 'search'
  | 'copy'
  | 'move'
  | 'link'
  | 'remove'
  | 'restore';

export type AccessRule = {
  path: string;            // Target pattern
  allow?: FileOperation[]; // Permitted operations (full access when omitted)
};

export type AccessRuleEntry = string | AccessRule;
```

### Pattern Semantics

- **Exact Match (no wildcards)**: `'/shared/config.json'` matches only that specific file.
- **Shallow Wildcard (`*`)**: `'/teams/*'` matches immediate child items inside `/teams`, excluding nested directories.
- **Recursive Wildcard (`**`)**: `'/projects/**'` matches the directory and all descendants at any depth.
- **Universal Root (`/**` or `/`)**: Matches all files across the filesystem.

### Rule Examples

```ts
const accessRules: AccessRuleEntry[] = [
  // Full access to team directory and all descendants
  '/teams/engineering/**',

  // Read-only capability for public assets
  {
    path: '/public/**',
    allow: ['read', 'stat', 'exists', 'list'],
  },

  // Single-file capability grant
  {
    path: '/shared/company-handbook.pdf',
    allow: ['read'],
  },
];
```

When an operation accesses an unauthorized path or attempts an unlisted capability, the request rejects immediately with `HandlerError('EACCES', 'Permission denied')`.

IMPORTANT: Rules are enforced only when `accessRules` is an array. Leaving it unset means no restriction at all, including outside `homeDir`. To confine a user to their home, set `accessRules: []`.

### Ownership Is Recorded, Not Enforced

`ownerId` (or `onBehalf`) is stamped on every write, but it never filters `list()` or `search()`. Isolation between users comes only from paths: a `mountPoint` per tenant, or a `homeDir` plus an `accessRules` array. Never rely on the owner field to hide one user's files from another.

---

## Deployment Scopes

R2 File supports three architectural deployment models:

### Open System
- **Scope**: Application asset storage, public downloads, static file pipelines.
- **Setup**: Root is `'/'`, no tenant isolation, universal rules.
- **Paths**: Resolve directly from the mount root.

### User-Scoped System
- **Scope**: SaaS applications with private user storage and shared team workspaces.
- **Setup**: Users receive `homeDir: '/users/:userId'` (`~`).
- **Paths**: Personal files live under `~`. Shared collaboration uses canonical `/shared/...` paths authorized via `accessRules`.

### Multi-Tenant System
- **Scope**: B2B platforms hosting isolated corporate accounts.
- **Setup**: Each tenant worker or session mounts via `mountPoint: '/tenants/:orgId'`.
- **Paths**: Completely isolated storage spaces. Paths within each tenant resolve cleanly starting from `/`.

---

## Strict Deletion Policy

To guard against catastrophic recursive deletions (such as an accidental client `remove('/', { recursive: true })`), drivers support strict mode:

```ts
import { createWorker } from '@irpclib/r2-file/worker';

export default createWorker({
  strict: true,
});
```

When `strict: true` is active:
- Deleting empty directories succeeds normally.
- Deleting a non-empty directory via `remove(path, { recursive: true })` halts immediately with `ENOTEMPTY`, even if `{ force: true }` is passed by the client.
- Purging non-empty directories requires explicit server-side enforcement (`fsContext.enforced = true`), restricting recursive wipes to authorized administrative workflows.
