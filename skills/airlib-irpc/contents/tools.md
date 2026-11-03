# IRPC Functions as Tools

To your own code, every IRPC function is a tool: declared once, called through its stub, with the same arguments, hooks, guards and validation. The package hands them out as stubs by name; nothing about a declaration or a call changes to make it one.

Agents outside your app speak MCP, not IRPC. The router translates between the two, the same way it translates webhooks, and only for functions marked `mcp`: the package never speaks MCP.

| Who calls | How | Shape |
|---|---|---|
| Your own code (UI, kernel, other packages) | `pkg.tools()`, `pkg.call()`, the stubs | IRPC: the function's own arguments |
| An agent outside (an MCP client) | `router.resolveMcp()` over HTTP | MCP: one input object, translated by the router |

---

## Exposing a Function to Outside Agents (`mcp`)

Add `mcp: true`, or `mcp` with options, to any declaration a router may serve over MCP. The function keeps its shape: positional, one object, or none. To your own code, nothing changes.

```typescript
import { z } from 'zod';
import { irpc } from '@/src/api.js';

export type ReadNoteFn = (input: { path: string }) => Promise<string>;
export type CopyNoteFn = (src: string, dest: string, options?: { overwrite: boolean }) => Promise<boolean>;

export const readNote = irpc.declare<ReadNoteFn>('notes.read', {
  description: 'Reads a note. Paths start with ~ for the user home.',
  schema: { input: [z.object({ path: z.string() })] },
  mcp: { readOnlyHint: true },
});

export const copyNote = irpc.declare<CopyNoteFn>('notes.copy', {
  description: 'Copies a note.',
  schema: { input: [z.string(), z.string(), z.object({ overwrite: z.boolean() }).optional()] },
  mcp: { args: ['src', 'dest', 'options'] },
});
```

### `MCPOptions`

These are metadata. They only matter where the function is described or reached as an MCP tool.

| Option | Meaning |
|---|---|
| `title` | A human-readable title. |
| `description` | What the tool does, for the model. Defaults to the declaration's `description`. |
| `args` | Names the positional arguments in order, so the router can describe them as one input object and place each value back in its position. Not needed for a function that takes one object, or nothing. |
| `readOnlyHint` | The tool changes nothing. |
| `destructiveHint` | The tool may destroy or overwrite something; a caller may ask for consent first. |
| `idempotentHint` | Calling it again with the same input has no further effect. |
| `openWorldHint` | The tool reaches beyond its own system (the web, other services). |

---

## Using Tools in Your Own Code (`tools()`, `call()`, `entries()`)

`pkg.tools()` returns every declared function's stub, keyed by name, in declaration order (`mcp` plays no part). Collect them from several packages into one tool set and call them like any stub:

```typescript
Object.assign(system.tools, files.tools(), notes.tools());

await system.tools['notes.copy']?.('~/a.md', '~/b.md');
```

`pkg.call(name, ...args)` calls the stub declared under `name`, tool or not, exactly as calling the stub directly:

```typescript
const content = await irpc.call('notes.read', { path: '~/notes/today.md' });
```

- Both return what the stub returns: a Promise, or a `RemoteState` for a streaming function.
- Whether that runs a local handler or goes over the transport is the stub's own behavior; spec hooks, guards and schema validation apply as usual.
- An undeclared name throws `StubError`: `IRPC "x" is not declared in pkg/1.0.0.`

`pkg.entries()` iterates every declared function, tools or not, as `[name, stub]` pairs in declaration order. CRUD declarations contribute their four functions.

---

## Serving Tools to Outside Agents (MCP)

Outside agents (Claude, IDEs, other MCP clients) connect over MCP's **Streamable HTTP** transport. MCP is HTTP only; your own code keeps its usual transport (WebSocket included).

### Describing Tools (`router.getTools()`)

`router.getTools()` describes the functions marked `mcp`, in every package the router serves, as MCP tool definitions:

```typescript
router.getTools();
// [
//   {
//     name: 'notes.read',
//     description: 'Reads a note. Paths start with ~ for the user home.',
//     inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
//     annotations: { readOnlyHint: true },
//   },
//   {
//     name: 'notes.copy',
//     description: 'Copies a note.',
//     inputSchema: {
//       type: 'object',
//       properties: { src: { type: 'string' }, dest: { type: 'string' }, options: { type: 'object', ... } },
//       required: ['src', 'dest'],
//     },
//   },
// ]
```

- `inputSchema` is generated from the declaration's Zod schemas (Zod 4's `toJSONSchema()`); it is never written by hand.
- A function taking one object is described by that object's schema. Positional arguments named with `mcp.args` become the properties of one object; `.optional()` arguments are left out of `required`. A function taking nothing is described as an empty object.
- An argument named without a schema is described as untyped and not required, so the model only sees its name and the tool's description.
- `getTools()` throws `StubError` for a tool it can't describe: positional arguments without `mcp.args`, or `args` that don't match the number of input schemas.

### Answering MCP Requests (`router.resolveMcp()`)

`HTTPRouter.resolveMcp(req, context?, builder?)` answers one JSON-RPC message. A tool call becomes a regular call: the router turns the tool's input object into the function's arguments, runs the call through its resolver (guards, hooks, validation, context), and turns the answer into the tool result.

```typescript
// worker.ts
import { HTTPRouter } from '@irpclib/http';
import { transport } from '@/src/api.js';

const router = new HTTPRouter(transport);

export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === '/mcp') return router.resolveMcp(req);
    return router.resolve(req);
  },
};
```

| MCP message | Reply |
|---|---|
| `initialize` | `serverInfo` (the first package's name and version) and the `tools` capability. |
| `ping` | `{}` |
| `tools/list` | `{ tools: router.getTools() }` |
| `tools/call` | Runs the function. Arguments named by `mcp.args` go to their positions; otherwise the input object is the one argument. |
| A notification (no `id`) | `202` with no body. |
| Any other method | JSON-RPC error `-32601`. |

A `tools/call` result:

- Returns `content: [{ type: 'text', text }]`, where `text` is a string result as is, or anything else as JSON. An object result is also given as `structuredContent`.
- A call that throws comes back as `isError: true` with the error message, so the model can read it and recover; it is not a protocol error.
- A name that isn't a function marked `mcp` is refused as an unknown tool (`-32602`), so unmarked functions stay unreachable from outside.

Only POST is served; `GET` gets `405`, since the router opens no server-to-client stream.

Authenticate MCP clients the way you authenticate any caller: `router.use()` and `irpc.guard()` apply to tool calls too, and request data goes in through `context`.
