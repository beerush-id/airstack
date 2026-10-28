import { IRPCRouter } from '@irpclib/irpc';
import { describe, expect, it } from 'vitest';
import { transport } from '../src/index.js';

describe('r2-file as MCP tools', () => {
  const tools = new IRPCRouter(transport).getTools();
  // Tool names are `r2-file.<function>`; the tests read them by function.
  const fn = (name: string) => name.replace('r2-file.', '');
  const byName = Object.fromEntries(tools.map((tool) => [fn(tool.name), tool]));

  it('names every tool after its package and function', () => {
    expect(tools.every((tool) => tool.name.startsWith('r2-file.'))).toBe(true);
  });

  it('describes every filesystem function, with its own argument names', () => {
    expect(Object.fromEntries(tools.map((tool) => [fn(tool.name), Object.keys(tool.inputSchema.properties as object)])))
      .toEqual({
        mkdir: ['path', 'options'],
        write: ['path', 'data', 'options'],
        read: ['path', 'options'],
        stat: ['path', 'options'],
        exists: ['path', 'options'],
        list: ['path', 'options'],
        search: ['query', 'options'],
        copy: ['source', 'destination', 'options'],
        move: ['source', 'destination', 'options'],
        link: ['target', 'path', 'options'],
        remove: ['path', 'options'],
        restore: ['path', 'options'],
      });
  });

  it('gives every tool a description for the model', () => {
    for (const tool of tools) expect(tool.description, tool.name).toBeTruthy();
  });

  it('marks lookups read-only and the rest by what they can destroy', () => {
    const hints = Object.fromEntries(tools.map((tool) => [fn(tool.name), tool.annotations]));

    for (const name of ['read', 'stat', 'exists', 'list', 'search']) {
      expect(hints[name], name).toEqual({ readOnlyHint: true, openWorldHint: false });
    }
    for (const name of ['mkdir', 'copy', 'move', 'link', 'restore']) {
      expect(hints[name], name).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: false });
    }
    expect(hints.write).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(hints.remove).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it('tells the model how paths work', () => {
    expect(byName.stat.description).toContain('~');
  });
});
