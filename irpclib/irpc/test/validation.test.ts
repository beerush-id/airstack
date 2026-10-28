import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createPackage, type IRPCCall, IRPCTransport, withContext } from '../src/index.js';

class RecordingTransport extends IRPCTransport {
  public sent: IRPCCall[] = [];
  public async dispatch(calls: IRPCCall[]): Promise<void> {
    this.sent.push(...calls);
  }
}

describe('input validation at the call', () => {
  it('refuses a call whose arguments don’t match the schemas, before the handler runs', async () => {
    const pkg = createPackage({ name: 'v-local', version: '1.0.0' });
    const echo = pkg.declare<(text: string) => Promise<string>>('echo', { schema: { input: [z.string()] } });
    const handler = vi.fn(async (text: string) => `got ${text}`);
    pkg.construct(echo, handler);

    await withContext(async () => {
      await expect(echo(42 as never)).rejects.toThrow();
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses it before it is sent, when the call goes over a transport', async () => {
    const transport = new RecordingTransport();
    const pkg = createPackage({ name: 'v-remote', version: '1.0.0' }).use(transport);
    const echo = pkg.declare<(text: string) => Promise<string>>('echo', { schema: { input: [z.string()] } });

    await withContext(async () => {
      await expect(echo(42 as never)).rejects.toThrow();
    });
    expect(transport.sent).toEqual([]);
  });

  it('lets a call leave out trailing optional arguments', async () => {
    const pkg = createPackage({ name: 'v-optional', version: '1.0.0' });
    const find = pkg.declare<(query: string, options?: { limit: number }) => Promise<string>>('find', {
      schema: { input: [z.string(), z.object({ limit: z.number() }).optional()] },
    });
    const handler = vi.fn(async (...args: unknown[]) => JSON.stringify(args));
    pkg.construct(find, handler);

    await withContext(async () => {
      await expect(find('cat')).resolves.toBe('["cat"]');
      await expect(find('cat', { limit: 2 })).resolves.toBe('["cat",{"limit":2}]');
      await expect(find('cat', { limit: 'two' } as never)).rejects.toThrow();
    });
  });

  it('refuses more arguments than the schemas name', async () => {
    const pkg = createPackage({ name: 'v-extra', version: '1.0.0' });
    const echo = pkg.declare<(text: string) => Promise<string>>('echo', { schema: { input: [z.string()] } });
    pkg.construct(echo, async (text) => text);

    await withContext(async () => {
      await expect((echo as (...args: unknown[]) => Promise<string>)('a', 'b')).rejects.toThrow();
    });
  });
});
