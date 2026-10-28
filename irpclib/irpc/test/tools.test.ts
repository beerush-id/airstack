import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import {
  createPackage,
  type IRPCCall,
  type IRPCPackage,
  IRPCRouter,
  IRPCTransport,
  type RemoteState,
  StubError,
  stream,
} from '../src/index.js';

class NoopTransport extends IRPCTransport {
  public async dispatch(_calls: IRPCCall[]): Promise<void> {}
}

describe('IRPCPackage functions by name', () => {
  let irpc: IRPCPackage;

  beforeEach(() => {
    vi.useRealTimers();
    irpc = createPackage({ name: 'tools', version: '1.0.0' });
  });

  describe('call', () => {
    it('calls the stub declared under the name with the given arguments', async () => {
      const add = irpc.declare<(a: number, b: number) => Promise<number>>('math.add');
      irpc.construct(add, async (a, b) => a + b);

      await expect(irpc.call('math.add', 2, 3)).resolves.toBe(5);
    });

    it('goes through the stub, so its hooks run', async () => {
      const read = irpc.declare<(input: { path: string }) => Promise<string>>('fs.read');
      irpc.construct(read, async ({ path }) => `content of ${path}`);
      const hook = vi.fn();
      irpc.hook(read, hook);

      await irpc.call('fs.read', { path: '~/a.txt' });

      expect(hook).toHaveBeenCalledWith(expect.objectContaining({ args: [{ path: '~/a.txt' }] }));
    });

    it('returns what the stub returns, a remote state for a streaming function', async () => {
      const watch = irpc.declare<() => RemoteState<{ ticks: number }>>({
        name: 'clock.watch',
        stream: true,
        seed: () => ({ ticks: 0 }),
        coalesce: false,
      });
      irpc.construct(watch, () =>
        stream(
          (state, resolve) => {
            state.data.ticks = 3;
            resolve();
          },
          { ticks: 0 }
        )
      );

      const state = irpc.call('clock.watch') as RemoteState<{ ticks: number }>;

      expect(typeof state.subscribe).toBe('function');
      await expect(state).resolves.toEqual({ ticks: 3 });
    });

    it('throws for a name nothing was declared under', () => {
      expect(() => irpc.call('nope.missing')).toThrow(StubError);
      expect(() => irpc.call('nope.missing')).toThrow('IRPC "nope.missing" is not declared in tools/1.0.0.');
    });
  });

  describe('entries', () => {
    it('lists every declared function as [name, stub], in declaration order', () => {
      const read = irpc.declare<(input: { path: string }) => Promise<string>>('fs.read');
      const list = irpc.declare<(input: { path: string }) => Promise<string[]>>('fs.list');

      expect([...irpc.entries()]).toEqual([
        ['fs.read', read],
        ['fs.list', list],
      ]);
    });

    it('includes the functions a CRUD declaration creates', () => {
      irpc.crud('note', () => ({ id: '', text: '' }));

      expect([...irpc.entries()].map(([name]) => name)).toEqual([
        'note.get',
        'note.create',
        'note.update',
        'note.delete',
      ]);
    });
  });

  describe('tools', () => {
    it('gives every declared function as its stub, by name', () => {
      const copy = irpc.declare<(src: string, dest: string) => Promise<boolean>>('fs.copy');
      const stat = irpc.declare<(path: string) => Promise<number>>('fs.stat', { mcp: { readOnlyHint: true } });

      expect(irpc.tools()).toEqual({ 'fs.copy': copy, 'fs.stat': stat });
    });

    it('gives stubs that are called like any stub', async () => {
      const copy = irpc.declare<(src: string, dest: string) => Promise<string>>('fs.copy', {
        schema: { input: [z.string(), z.string()] },
      });
      irpc.construct(copy, async (src, dest) => `${src} -> ${dest}`);
      const tools = Object.assign({}, irpc.tools());

      await expect(tools['fs.copy']?.('~/a', '~/b')).resolves.toBe('~/a -> ~/b');
    });
  });
});

describe('IRPCRouter getTools', () => {
  let transport: NoopTransport;
  let files: IRPCPackage;

  beforeEach(() => {
    transport = new NoopTransport();
    files = createPackage({ name: 'files', version: '1.0.0' }).use(transport);
  });

  it('describes the tools of every package it serves, as MCP tools', () => {
    const notes = createPackage({ name: 'notes', version: '1.0.0' }).use(transport);
    files.declare<(input: { path: string }) => Promise<string>>('fs.read', {
      description: 'Reads a text file.',
      schema: { input: [z.object({ path: z.string() })] },
      mcp: { readOnlyHint: true },
    });
    files.declare<() => Promise<void>>('fs.internal');
    notes.declare<() => Promise<string[]>>('notes.list', { description: 'Lists notes.', mcp: true });

    expect(new IRPCRouter(transport).getTools()).toEqual([
      {
        name: 'fs.read',
        description: 'Reads a text file.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
      },
      { name: 'notes.list', description: 'Lists notes.', inputSchema: { type: 'object', properties: {} } },
    ]);
  });

  it('takes the title and description from the mcp options over the function’s own', () => {
    files.declare<(input: { path: string }) => Promise<boolean>>('fs.remove', {
      description: 'Removes a file.',
      schema: { input: [z.object({ path: z.string() })] },
      mcp: { title: 'Delete file', description: 'Moves a file to the trash.', destructiveHint: true },
    });

    expect(new IRPCRouter(transport).getTools()[0]).toMatchObject({
      name: 'fs.remove',
      title: 'Delete file',
      description: 'Moves a file to the trash.',
      annotations: { destructiveHint: true },
    });
  });

  it('describes named positional arguments as one object, leaving optional ones out of required', () => {
    files.declare<(src: string, dest: string, opt?: { overwrite: boolean }) => Promise<boolean>>('fs.copy', {
      schema: { input: [z.string(), z.string(), z.object({ overwrite: z.boolean() }).optional()] },
      mcp: { args: ['src', 'dest', 'opt'] },
    });

    expect(new IRPCRouter(transport).getTools()[0].inputSchema).toEqual({
      type: 'object',
      properties: {
        src: { type: 'string' },
        dest: { type: 'string' },
        opt: {
          type: 'object',
          properties: { overwrite: { type: 'boolean' } },
          required: ['overwrite'],
          additionalProperties: false,
        },
      },
      required: ['src', 'dest'],
    });
  });

  it('describes named arguments without schemas as untyped and not required', () => {
    files.declare<(path: string, options?: object) => Promise<boolean>>('fs.exists', {
      mcp: { args: ['path', 'options'] },
    });

    expect(new IRPCRouter(transport).getTools()[0].inputSchema).toEqual({
      type: 'object',
      properties: { path: {}, options: {} },
    });
  });

  it('refuses to describe positional arguments its mcp options do not name', () => {
    files.declare<(a: number, b: number) => Promise<number>>('math.add', {
      schema: { input: [z.number(), z.number()] },
      mcp: true,
    });

    expect(() => new IRPCRouter(transport).getTools()).toThrow(
      'IRPC "math.add" takes positional arguments, so its mcp options must name them (args).'
    );
  });

  it('refuses names that do not match the input schemas', () => {
    files.declare<(src: string, dest: string) => Promise<boolean>>('fs.copy', {
      schema: { input: [z.string(), z.string()] },
      mcp: { args: ['src'] },
    });

    expect(() => new IRPCRouter(transport).getTools()).toThrow(StubError);
  });
});
