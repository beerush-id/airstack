import { createPackage, IRPCBlob, type IRPCPackage } from '@irpclib/irpc';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { HTTPTransport } from '../../src/index.js';
import { HTTPRouter } from '../../src/router.js';

/** Posts one JSON-RPC message the way an MCP client does over Streamable HTTP. */
function rpc(message: Record<string, unknown>) {
  return new Request('https://api.example.com/mcp', {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', ...message }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  });
}

describe('HTTPRouter resolveMcp', () => {
  let files: IRPCPackage;
  let router: HTTPRouter;

  beforeEach(() => {
    files = createPackage({ name: 'files', version: '1.0.0' });
    const transport = new HTTPTransport({ baseURL: 'https://api.example.com' });
    files.use(transport);
    router = new HTTPRouter(transport);

    const read = files.declare<(input: { path: string }) => Promise<string>>('fs.read', {
      description: 'Reads a text file.',
      schema: { input: [z.object({ path: z.string() })] },
      mcp: { readOnlyHint: true },
    });
    files.construct(read, async ({ path }) => {
      if (path === '~/missing') throw new Error('No such file: ~/missing');
      return `content of ${path}`;
    });

    const copy = files.declare<(src: string, dest: string) => Promise<{ copied: string }>>('fs.copy', {
      schema: { input: [z.string(), z.string()] },
      mcp: { args: ['src', 'dest'] },
    });
    files.construct(copy, async (src, dest) => ({ copied: `${src} -> ${dest}` }));

    const open = files.declare<(path: string) => Promise<IRPCBlob>>('fs.open', { mcp: { args: ['path'] } });
    files.construct(
      open,
      async (path) => new IRPCBlob(`/files${path}?sig=x`, { type: 'image/png', size: 3, name: 'a.png' })
    );

    const internal = files.declare<() => Promise<string>>('fs.internal');
    files.construct(internal, async () => 'secret');
  });

  it('answers initialize with the server info and the tools capability', async () => {
    const response = await router.resolveMcp(
      rpc({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'files', version: '1.0.0' },
      },
    });
  });

  it('accepts notifications without a reply', async () => {
    const response = await router.resolveMcp(rpc({ method: 'notifications/initialized' }));

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
  });

  it('answers ping', async () => {
    const response = await router.resolveMcp(rpc({ id: 2, method: 'ping' }));

    expect(await response.json()).toEqual({ jsonrpc: '2.0', id: 2, result: {} });
  });

  it('lists the tools of the packages it serves', async () => {
    const response = await router.resolveMcp(rpc({ id: 3, method: 'tools/list' }));
    const { result } = await response.json();

    expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual(['fs.read', 'fs.copy', 'fs.open']);
    expect(result.tools[1].inputSchema).toMatchObject({ required: ['src', 'dest'] });
  });

  it('calls a tool that takes one object with the arguments as that object', async () => {
    const response = await router.resolveMcp(
      rpc({ id: 4, method: 'tools/call', params: { name: 'fs.read', arguments: { path: '~/a.txt' } } })
    );

    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 4,
      result: { content: [{ type: 'text', text: 'content of ~/a.txt' }], isError: false },
    });
  });

  it('calls a tool with named arguments in their positions, and returns object results as structured content', async () => {
    const response = await router.resolveMcp(
      rpc({ id: 5, method: 'tools/call', params: { name: 'fs.copy', arguments: { dest: '~/b', src: '~/a' } } })
    );

    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 5,
      result: {
        content: [{ type: 'text', text: JSON.stringify({ copied: '~/a -> ~/b' }) }],
        structuredContent: { copied: '~/a -> ~/b' },
        isError: false,
      },
    });
  });

  it('returns a blob result as a link to its content, resolved against the request', async () => {
    const response = await router.resolveMcp(
      rpc({ id: 9, method: 'tools/call', params: { name: 'fs.open', arguments: { path: '/a.png' } } })
    );

    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 9,
      result: {
        content: [
          {
            type: 'resource_link',
            uri: 'https://api.example.com/files/a.png?sig=x',
            name: 'a.png',
            mimeType: 'image/png',
            size: 3,
          },
        ],
        isError: false,
      },
    });
  });

  it('reports a failing tool as a tool error, so the model can see it', async () => {
    const response = await router.resolveMcp(
      rpc({ id: 6, method: 'tools/call', params: { name: 'fs.read', arguments: { path: '~/missing' } } })
    );
    const { result } = await response.json();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No such file: ~/missing');
  });

  it('refuses functions that are not tools, as unknown tools', async () => {
    const response = await router.resolveMcp(
      rpc({ id: 7, method: 'tools/call', params: { name: 'fs.internal', arguments: {} } })
    );

    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: { code: -32602, message: 'Unknown tool: fs.internal' },
    });
  });

  it('refuses unknown methods', async () => {
    const response = await router.resolveMcp(rpc({ id: 8, method: 'resources/list' }));

    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 8,
      error: { code: -32601, message: 'Method not found: resources/list' },
    });
  });

  it('refuses a body that is not JSON', async () => {
    const request = new Request('https://api.example.com/mcp', { method: 'POST', body: '{nope' });
    const response = await router.resolveMcp(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: null, error: { code: -32700 } });
  });

  it('refuses GET, since it opens no server stream', async () => {
    const response = await router.resolveMcp(new Request('https://api.example.com/mcp'));

    expect(response.status).toBe(405);
  });
});
