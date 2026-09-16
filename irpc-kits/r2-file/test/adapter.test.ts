import { HandlerError } from '@irpclib/irpc';
import { describe, expect, it } from 'vitest';
import type { FileDriver } from '../src/adapter.js';
import { FileAdapter } from '../src/adapter.js';
import { fsContext } from '../src/context.js';
import type { DriverContext, FileInfo, ListResult } from '../src/types.js';
import { expectDenial, withFs } from './helpers.js';

const SCOPE = { ownerId: 'adapter-probe', homeDir: '/home/adapter-probe' };
const SCOPE_ENFORCED = { ownerId: 'adapter-probe', homeDir: '/home/adapter-probe', enforced: true };

describe('FileAdapter pipeline orchestration', () => {
  it('chains drivers through fluent use', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();
      const first = new SpyDriver('first');
      const second = new MemoryDriver();

      const returned = adapter.use(first).use(second);

      expect(returned).toBe(adapter);
      return;
    });
  });

  it('executes drivers in registration order', async () => {
    await withFs(SCOPE, async () => {
      const order: string[] = [];
      const seen: Array<DriverContext<unknown>> = [];
      const first = new SpyDriver('first', order, seen);
      const second = new SpyDriver('second', order, seen);
      const adapter = new FileAdapter().use(first).use(second);

      await adapter.mkdir('/docs');

      expect(order).toEqual(['first:mkdir', 'second:mkdir']);
      return;
    });
  });

  it('passes one shared context object through the chain', async () => {
    await withFs(SCOPE, async () => {
      const order: string[] = [];
      const seen: Array<DriverContext<unknown>> = [];
      const first = new SpyDriver('first', order, seen);
      const second = new SpyDriver('second', order, seen);
      const adapter = new FileAdapter().use(first).use(second);

      await adapter.mkdir('/docs');

      expect(seen.length).toBe(2);

      expect(seen[1]).toBe(seen[0]);
      return;
    });
  });

  it('uses a fresh context per call', async () => {
    await withFs(SCOPE, async () => {
      const compensations: string[] = [];
      let calls = 0;
      const driver = {
        async mkdir(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          calls += 1;
          if (calls === 1) {
            ctx.rollback.add(() => {
              compensations.push('first');
            });
            ctx.result = {
              path: '/first',
              name: 'first',
              size: 0,
              type: 'inode/directory',
              mtime: new Date('2026-01-01T00:00:00.000Z'),
              isDirectory: true,
            };
            return;
          }
          ctx.rollback.add(() => {
            compensations.push('second');
          });
          throw new Error('second mkdir boom');
        },
      } as FileDriver;
      const adapter = new FileAdapter().use(driver);

      await adapter.mkdir('/first');

      await expect(adapter.mkdir('/second')).rejects.toThrow('second mkdir boom');

      expect(compensations).toEqual(['second']);
      return;
    });
  });

  it('passes through drivers that lack the method', async () => {
    await withFs(SCOPE, async () => {
      const empty = {} as FileDriver;
      const reader = {
        async read(ctx: DriverContext<string | undefined>, _path: string): Promise<void> {
          ctx.result = 'hello';
          return;
        },
      } as FileDriver;
      const adapter = new FileAdapter().use(empty).use(reader);

      const result = await adapter.read('/notes.txt', { encoding: 'text' });

      expect(result).toBe('hello');
      return;
    });
  });

  it('delegates path and options untouched without resolution', async () => {
    await withFs(SCOPE, async () => {
      const driver = {
        async mkdir(ctx: DriverContext<FileInfo>, path: string, options?: { cwd?: string }): Promise<void> {
          ctx.result = {
            path,
            name: 'notes.txt',
            size: 0,
            type: 'inode/directory',
            mtime: new Date('2026-01-01T00:00:00.000Z'),
            isDirectory: true,
            metadata: { cwd: options?.cwd ?? '' },
          };
          return;
        },
      } as FileDriver;
      const adapter = new FileAdapter().use(driver);

      const result = await adapter.mkdir('~/notes.txt', { cwd: '/custom/cwd' });

      expect(result.path).toBe('~/notes.txt');

      expect(result.metadata).toEqual({ cwd: '/custom/cwd' });
      return;
    });
  });

  it('passes mountPoint through without resolution', async () => {
    await withFs(SCOPE, async () => {
      const driver = {
        async mkdir(ctx: DriverContext<FileInfo>, path: string): Promise<void> {
          ctx.result = {
            path,
            name: 'spec.md',
            size: 0,
            type: 'inode/directory',
            mtime: new Date('2026-01-01T00:00:00.000Z'),
            isDirectory: true,
          };
          return;
        },
      } as FileDriver;
      const adapter = new FileAdapter({ mountPoint: '/tenants/acme' }).use(driver);

      const result = await adapter.mkdir('/shared/spec.md');

      expect(result.path).toBe('/shared/spec.md');
      return;
    });
  });

  it('halts mkdir without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.mkdir('/docs'), 'EIO', 'mkdir');
      return;
    });
  });

  it('halts write without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.write('/notes.txt', 'hello'), 'EIO', 'write');
      return;
    });
  });

  it('halts copy without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.copy('/a.txt', '/b.txt'), 'EIO', 'copy');
      return;
    });
  });

  it('halts move without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.move('/a.txt', '/b.txt'), 'EIO', 'move');
      return;
    });
  });

  it('halts link without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.link('/target.txt', '/link.txt'), 'EIO', 'link');
      return;
    });
  });

  it('halts remove without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.remove('/notes.txt'), 'EIO', 'remove');
      return;
    });
  });

  it('halts restore without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      await expectDenial(() => adapter.restore('/notes.txt'), 'EIO', 'restore');
      return;
    });
  });

  it('falls back read to undefined without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      const result = await adapter.read('/notes.txt');

      expect(result).toBeUndefined();
      return;
    });
  });

  it('falls back stat to undefined without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      const result = await adapter.stat('/notes.txt');

      expect(result).toBeUndefined();
      return;
    });
  });

  it('falls back exists to false without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      const result = await adapter.exists('/notes.txt');

      expect(result).toBe(false);
      return;
    });
  });

  it('falls back list to empty entries without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      const result: ListResult = await adapter.list('/docs');

      expect(result).toEqual({ entries: [] });
      return;
    });
  });

  it('falls back search to empty entries without a capable driver', async () => {
    await withFs(SCOPE, async () => {
      const adapter = new FileAdapter();

      const result: ListResult = await adapter.search('notes');

      expect(result).toEqual({ entries: [] });
      return;
    });
  });

  it('runs rollbacks in reverse order', async () => {
    await withFs(SCOPE, async () => {
      const order: string[] = [];
      const first = {
        async mkdir(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          ctx.rollback.add(() => {
            order.push('first');
          });
          ctx.result = {
            path: '/docs',
            name: 'docs',
            size: 0,
            type: 'inode/directory',
            mtime: new Date('2026-01-01T00:00:00.000Z'),
            isDirectory: true,
          };
          return;
        },
      } as FileDriver;
      const second = {
        async mkdir(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          ctx.rollback.add(() => {
            order.push('second');
          });
          return;
        },
      } as FileDriver;
      const failing = {
        async mkdir(_ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          throw new Error('mkdir boom');
        },
      } as FileDriver;
      const adapter = new FileAdapter().use(first).use(second).use(failing);

      await expect(adapter.mkdir('/docs')).rejects.toThrow('mkdir boom');

      expect(order).toEqual(['second', 'first']);
      return;
    });
  });

  it('denies strict remove without enforced', async () => {
    await withFs(SCOPE, async () => {
      const strictDriver = {
        async remove(ctx: DriverContext<boolean>, _path: string): Promise<void> {
          if (fsContext.get()?.enforced !== true) {
            throw new HandlerError(
              'ENOTEMPTY',
              'Directory not empty',
              new Error(`remove: Directory '/docs' is not empty without context enforcement`)
            );
          }
          ctx.result = true;
          return;
        },
      } as FileDriver;
      const adapter = new FileAdapter().use(strictDriver);

      await expectDenial(() => adapter.remove('/docs'), 'ENOTEMPTY', `/docs`);
      return;
    });
  });

  it('allows strict remove with enforced', async () => {
    await withFs(SCOPE_ENFORCED, async () => {
      const strictDriver = {
        async remove(ctx: DriverContext<boolean>, _path: string): Promise<void> {
          if (fsContext.get()?.enforced !== true) {
            throw new HandlerError(
              'ENOTEMPTY',
              'Directory not empty',
              new Error(`remove: Directory '/docs' is not empty without context enforcement`)
            );
          }
          ctx.result = true;
          return;
        },
      } as FileDriver;
      const adapter = new FileAdapter().use(strictDriver);

      const result = await adapter.remove('/docs');

      expect(result).toBe(true);
      return;
    });
  });

  it('returns result when a downstream driver seals ctx.result after an unsealing driver', async () => {
    await withFs(SCOPE, async () => {
      const passThrough: FileDriver = {
        async write(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          ctx.info = {
            path: '/notes.txt',
            name: 'notes.txt',
            size: 5,
            type: 'text/plain',
            mtime: new Date('2026-01-01T00:00:00.000Z'),
            isDirectory: false,
          };
        },
      };
      const sealer: FileDriver = {
        async write(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          ctx.result = ctx.info!;
        },
      };
      const adapter = new FileAdapter().use(passThrough).use(sealer);

      const result = await adapter.write('/notes.txt', 'hello');

      expect(result.path).toBe('/notes.txt');
      expect(result.size).toBe(5);
    });
  });

  it('resolves query when a downstream driver seals ctx.result after an unsealing driver', async () => {
    await withFs(SCOPE, async () => {
      const miss: FileDriver = {
        async read(_ctx: DriverContext<string | undefined>, _path: string): Promise<void> {},
      };
      const hit: FileDriver = {
        async read(ctx: DriverContext<string | undefined>, _path: string): Promise<void> {
          ctx.result = 'from-hit';
        },
      };
      const adapter = new FileAdapter().use(miss).use(hit);

      const result = await adapter.read('/notes.txt', { encoding: 'text' });

      expect(result).toBe('from-hit');
    });
  });

  it('continues rollback unwinding even when an individual undo function throws', async () => {
    await withFs(SCOPE, async () => {
      const executed: string[] = [];
      const first: FileDriver = {
        async mkdir(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          ctx.rollback.add(() => {
            executed.push('first');
          });
        },
      };
      const second: FileDriver = {
        async mkdir(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          ctx.rollback.add(() => {
            executed.push('second');
            throw new Error('undo second failed');
          });
        },
      };
      const third: FileDriver = {
        async mkdir(_ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          throw new Error('pipeline failed');
        },
      };
      const adapter = new FileAdapter().use(first).use(second).use(third);

      await expect(adapter.mkdir('/docs')).rejects.toThrow('pipeline failed');

      expect(executed).toEqual(['second', 'first']);
    });
  });

  it('aborts pipeline immediately on failure without invoking subsequent drivers', async () => {
    await withFs(SCOPE, async () => {
      let thirdInvoked = false;
      const first: FileDriver = {
        async mkdir(_ctx: DriverContext<FileInfo>, _path: string): Promise<void> {},
      };
      const second: FileDriver = {
        async mkdir(_ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          throw new Error('second halted');
        },
      };
      const third: FileDriver = {
        async mkdir(_ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
          thirdInvoked = true;
        },
      };
      const adapter = new FileAdapter().use(first).use(second).use(third);

      await expect(adapter.mkdir('/docs')).rejects.toThrow('second halted');

      expect(thirdInvoked).toBe(false);
    });
  });
});

/**
 * Recording pipeline input. Observes what the adapter passes through
 * the chain (order, shared context, untouched arguments).
 */
class SpyDriver implements FileDriver {
  constructor(
    private tag: string = 'spy',
    public order: string[] = [],
    public seen: Array<DriverContext<unknown>> = []
  ) {}

  private note<T>(ctx: DriverContext<T>, op: string): void {
    this.order.push(`${this.tag}:${op}`);
    this.seen.push(ctx as DriverContext<unknown>);
  }

  async mkdir(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
    this.note(ctx, 'mkdir');
    ctx.result = {
      path: '/docs',
      name: 'docs',
      size: 0,
      type: 'inode/directory',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: true,
    };
    return;
  }

  async write(ctx: DriverContext<FileInfo>, _path: string, _data: unknown): Promise<void> {
    this.note(ctx, 'write');
    ctx.result = {
      path: '/notes.txt',
      name: 'notes.txt',
      size: 5,
      type: 'text/plain',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: false,
    };
    return;
  }

  async read(ctx: DriverContext<string | undefined>, _path: string): Promise<void> {
    this.note(ctx, 'read');
    ctx.result = 'hello';
    return;
  }

  async stat(ctx: DriverContext<FileInfo | undefined>, _path: string): Promise<void> {
    this.note(ctx, 'stat');
    ctx.result = {
      path: '/notes.txt',
      name: 'notes.txt',
      size: 5,
      type: 'text/plain',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: false,
    };
    return;
  }

  async exists(ctx: DriverContext<boolean>, _path: string): Promise<void> {
    this.note(ctx, 'exists');
    ctx.result = true;
    return;
  }

  async list(ctx: DriverContext<ListResult>, _path?: string): Promise<void> {
    this.note(ctx, 'list');
    ctx.result = { entries: [] };
    return;
  }

  async search(ctx: DriverContext<ListResult>, _query: string): Promise<void> {
    this.note(ctx, 'search');
    ctx.result = { entries: [] };
    return;
  }

  async copy(ctx: DriverContext<boolean>, _source: string, _destination: string): Promise<void> {
    this.note(ctx, 'copy');
    ctx.result = true;
    return;
  }

  async move(ctx: DriverContext<boolean>, _source: string, _destination: string): Promise<void> {
    this.note(ctx, 'move');
    ctx.result = true;
    return;
  }

  async link(ctx: DriverContext<FileInfo>, _target: string, _path: string): Promise<void> {
    this.note(ctx, 'link');
    ctx.result = {
      path: '/link.txt',
      name: 'link.txt',
      size: 0,
      type: 'inode/symlink',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: false,
      link: '/target.txt',
    };
    return;
  }

  async remove(ctx: DriverContext<boolean>, _path: string): Promise<void> {
    this.note(ctx, 'remove');
    ctx.result = true;
    return;
  }

  async restore(ctx: DriverContext<FileInfo>, _path: string): Promise<void> {
    this.note(ctx, 'restore');
    ctx.result = {
      path: '/notes.txt',
      name: 'notes.txt',
      size: 5,
      type: 'text/plain',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: false,
    };
    return;
  }
}

/**
 * Minimal in-memory pipeline input. Holds one directory record
 * so warm-reuse behavior is observable through the adapter surface.
 */
class MemoryDriver implements FileDriver {
  public files = new Map<string, FileInfo>();

  async mkdir(ctx: DriverContext<FileInfo>, path: string): Promise<void> {
    const info: FileInfo = {
      path,
      name: 'docs',
      size: 0,
      type: 'inode/directory',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: true,
    };
    this.files.set(path, info);
    ctx.result = info;
    ctx.rollback.add(() => {
      this.files.delete(path);
    });
    return;
  }

  async write(ctx: DriverContext<FileInfo>, path: string, _data: unknown): Promise<void> {
    const info: FileInfo = {
      path,
      name: 'notes.txt',
      size: 5,
      type: 'text/plain',
      mtime: new Date('2026-01-01T00:00:00.000Z'),
      isDirectory: false,
    };
    this.files.set(path, info);
    ctx.result = info;
    ctx.rollback.add(() => {
      this.files.delete(path);
    });
    return;
  }
}
