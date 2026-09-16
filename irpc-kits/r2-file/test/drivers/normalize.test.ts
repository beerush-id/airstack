import { describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../src/context.js';
import { NormalizerDriver } from '../../src/drivers/normalize.js';
import { expectDenial, withFs } from '../helpers.js';

const OWNER = 'alice';
const HOME = '/users/alice';
const TENANT_MOUNT = '/tenants/acme';

function freshCtx() {
  return createDriverCtx<any>();
}

describe('NormalizerDriver', () => {
  describe('boundary gating then limits', () => {
    it('write denies EACCES on an outside path with a blocked MIME', async () => {
      const driver = new NormalizerDriver({ mountPoint: TENANT_MOUNT, allowedTypes: ['image/png'] });
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.write(freshCtx(), '/users/bob/evil.exe', 'MZ', { type: 'application/x-msdownload' }),
          'EACCES',
          "'/users/bob/evil.exe' outside accessRules",
          'application/x-msdownload'
        )
      );
    });

    it('write denies EACCES on an outside path with an oversize payload', async () => {
      const driver = new NormalizerDriver({ maxSize: 8 });
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.write(freshCtx(), '/users/bob/big.bin', 'x'.repeat(64)),
          'EACCES',
          "'/users/bob/big.bin' outside accessRules",
          'maxSize'
        )
      );
    });
  });

  describe('outside paths deny EACCES per operation', () => {
    it('mkdir denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.mkdir(freshCtx(), '/users/bob/docs'),
          'EACCES',
          "'/users/bob/docs' outside accessRules",
          '/users/bob/docs'
        )
      );
    });

    it('write denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.write(freshCtx(), '/users/bob/notes.txt', 'hello'),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });

    it('read denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.read(freshCtx(), '/users/bob/notes.txt'),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });

    it('stat denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.stat(freshCtx(), '/users/bob/notes.txt'),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });

    it('exists denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.exists(freshCtx(), '/users/bob/notes.txt'),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });

    it('list denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.list(freshCtx(), '/users/bob/docs'),
          'EACCES',
          "'/users/bob/docs' outside accessRules",
          '/users/bob/docs'
        )
      );
    });

    it('search denies a cwd outside the allowed tree', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.search(freshCtx(), 'notes', { cwd: '/users/bob' }),
          'EACCES',
          "'/users/bob' outside accessRules",
          '/users/bob'
        )
      );
    });

    it('copy denies an outside source path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.copy(freshCtx(), '/users/bob/a.txt', 'b.txt'),
          'EACCES',
          "'/users/bob/a.txt' outside accessRules",
          '/users/bob/a.txt'
        )
      );
    });

    it('copy denies an outside destination path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.copy(freshCtx(), 'a.txt', '/users/bob/b.txt'),
          'EACCES',
          "'/users/bob/b.txt' outside accessRules",
          '/users/bob/b.txt'
        )
      );
    });

    it('move denies an outside source path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.move(freshCtx(), '/users/bob/a.txt', 'b.txt'),
          'EACCES',
          "'/users/bob/a.txt' outside accessRules",
          '/users/bob/a.txt'
        )
      );
    });

    it('move denies an outside destination path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.move(freshCtx(), 'a.txt', '/users/bob/b.txt'),
          'EACCES',
          "'/users/bob/b.txt' outside accessRules",
          '/users/bob/b.txt'
        )
      );
    });

    it('link denies an outside target path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.link(freshCtx(), '/users/bob/target.txt', 'alias.txt'),
          'EACCES',
          "'/users/bob/target.txt' outside accessRules",
          '/users/bob/target.txt'
        )
      );
    });

    it('link denies an outside alias path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.link(freshCtx(), 'target.txt', '/users/bob/alias.txt'),
          'EACCES',
          "'/users/bob/alias.txt' outside accessRules",
          '/users/bob/alias.txt'
        )
      );
    });

    it('remove denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.remove(freshCtx(), '/users/bob/notes.txt'),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });

    it('restore denies an outside canonical path', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.restore(freshCtx(), '/users/bob/notes.txt'),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });
  });

  describe('posix input kinds', () => {
    it('mkdir expands a tilde path against homeDir', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.mkdir(ctx, '~/docs');
        expect(ctx.path).toBe('/users/alice/docs');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write keeps a canonical path independent of cwd', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, '/users/alice/notes.txt', 'hello');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write anchors a bare relative path at homeDir', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'notes.txt', 'hello');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write anchors a dot relative path at homeDir', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, './notes.txt', 'hello');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write anchors a relative path at an authorized cwd', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'notes.txt', 'hello', { cwd: '/users/alice/docs' });
        expect(ctx.path).toBe('/users/alice/docs/notes.txt');
        expect(ctx.dirname).toBe('/users/alice/docs');
        expect(ctx.cwd).toBe('/users/alice/docs');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write resolves a parent segment against an authorized cwd', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, '../notes.txt', 'hello', { cwd: '/users/alice/docs' });
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice/docs');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write denies a cwd outside the allowed tree', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/alice/**'] }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'notes.txt', 'hello', { cwd: '/users/bob' }),
          'EACCES',
          "'/users/bob/notes.txt' outside accessRules",
          '/users/bob/notes.txt'
        )
      );
    });
  });

  describe('single root clamp with rule enforcement', () => {
    it('read clamps a canonical parent escape at the mount root', async () => {
      const driver = new NormalizerDriver();
      await withFs({}, async () => {
        const ctx = freshCtx();
        await driver.read(ctx, '/../notes.txt');
        expect(ctx.path).toBe('/notes.txt');
        expect(ctx.cwd).toBe('/home');
        expect('result' in ctx).toBe(false);
      });
    });

    it('read clamps a bare root parent to the mount root', async () => {
      const driver = new NormalizerDriver();
      await withFs({}, async () => {
        const ctx = freshCtx();
        await driver.read(ctx, '/..');
        expect(ctx.path).toBe('/');
        expect(ctx.cwd).toBe('/home');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write resolves a tilde traversal past homeDir without rule cover', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, '~/../../etc/passwd', 'hello');
        expect(ctx.path).toBe('/etc/passwd');
        expect(ctx.dirname).toBe('/etc');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });
  });

  describe('context population per operation', () => {
    it('mkdir populates directory path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.mkdir(ctx, 'docs');
        expect(ctx.path).toBe('/users/alice/docs');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write populates file path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'notes.txt', 'hello');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('read populates file path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.read(ctx, 'notes.txt');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('stat populates file path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.stat(ctx, 'notes.txt');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('exists populates file path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.exists(ctx, 'notes.txt');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('list populates directory path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.list(ctx, 'docs');
        expect(ctx.path).toBe('/users/alice/docs');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('list resolves an omitted path against cwd', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.list(ctx, undefined, { cwd: '/users/alice/docs' });
        expect(ctx.path).toBe('/users/alice/docs');
        expect(ctx.cwd).toBe('/users/alice/docs');
        expect('result' in ctx).toBe(false);
      });
    });

    it('list resolves an omitted path against homeDir', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.list(ctx);
        expect(ctx.path).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('search scopes to an explicit cwd', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.search(ctx, 'notes', { cwd: '/users/alice/docs' });
        expect(ctx.cwd).toBe('/users/alice/docs');
        expect('result' in ctx).toBe(false);
      });
    });

    it('search defaults scope to homeDir', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.search(ctx, 'notes');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('copy populates source and destination context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.copy(ctx, 'a.txt', 'b.txt');
        expect(ctx.path).toBe('/users/alice/a.txt');
        expect(ctx.destination).toBe('/users/alice/b.txt');
        expect('result' in ctx).toBe(false);
      });
    });

    it('move populates source and destination context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.move(ctx, 'a.txt', 'b.txt');
        expect(ctx.path).toBe('/users/alice/a.txt');
        expect(ctx.destination).toBe('/users/alice/b.txt');
        expect('result' in ctx).toBe(false);
      });
    });

    it('link populates alias and target context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.link(ctx, 'target.txt', 'alias.txt');
        expect(ctx.path).toBe('/users/alice/alias.txt');
        expect(ctx.destination).toBe('/users/alice/target.txt');
        expect('result' in ctx).toBe(false);
      });
    });

    it('remove populates file path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.remove(ctx, 'notes.txt');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('restore populates file path context', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.restore(ctx, 'notes.txt');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });
  });

  describe('op gated allow', () => {
    it('read delegates inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        { ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] },
        async () => {
          const ctx = freshCtx();
          await driver.read(ctx, '/users/teams/notes.txt');
          expect(ctx.path).toBe('/users/teams/notes.txt');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('write denies inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.write(freshCtx(), '/users/teams/notes.txt', 'hello'),
          'EACCES',
          "Operation 'write' not permitted",
          '/users/teams/notes.txt'
        )
      );
    });

    it('write denies a cwd inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'notes.txt', 'hello', { cwd: '/users/teams/docs' }),
          'EACCES',
          "Operation 'write' not permitted",
          '/users/teams/docs'
        )
      );
    });

    it('mkdir denies inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.mkdir(freshCtx(), '/users/teams/docs'),
          'EACCES',
          "Operation 'mkdir' not permitted",
          '/users/teams/docs'
        )
      );
    });

    it('copy denies inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.copy(freshCtx(), '/users/teams/a.txt', '/users/teams/b.txt'),
          'EACCES',
          "Operation 'copy' not permitted",
          '/users/teams/b.txt'
        )
      );
    });

    it('move denies inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.move(freshCtx(), '/users/teams/a.txt', '/users/teams/b.txt'),
          'EACCES',
          "Operation 'move' not permitted",
          '/users/teams/b.txt'
        )
      );
    });

    it('remove denies inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.remove(freshCtx(), '/users/teams/notes.txt'),
          'EACCES',
          "Operation 'remove' not permitted",
          '/users/teams/notes.txt'
        )
      );
    });

    it('restore denies inside a read only rule', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: [{ path: '/users/teams/**', allow: ['read'] }] }, () =>
        expectDenial(
          () => driver.restore(freshCtx(), '/users/teams/notes.txt'),
          'EACCES',
          "Operation 'restore' not permitted",
          '/users/teams/notes.txt'
        )
      );
    });

    it('stat delegates inside a query rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/teams/**', allow: ['read', 'stat', 'exists', 'list', 'search'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.stat(ctx, '/users/teams/notes.txt');
          expect(ctx.path).toBe('/users/teams/notes.txt');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('exists delegates inside a query rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/teams/**', allow: ['read', 'stat', 'exists', 'list', 'search'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.exists(ctx, '/users/teams/notes.txt');
          expect(ctx.path).toBe('/users/teams/notes.txt');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('list delegates inside a query rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/teams/**', allow: ['read', 'stat', 'exists', 'list', 'search'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.list(ctx, '/users/teams');
          expect(ctx.path).toBe('/users/teams');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('search delegates inside a query rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/teams/**', allow: ['read', 'stat', 'exists', 'list', 'search'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.search(ctx, 'notes', { cwd: '/users/teams' });
          expect(ctx.cwd).toBe('/users/teams');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('write delegates when a string rule grants full access', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME, accessRules: ['/users/teams/**'] }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, '/users/teams/notes.txt', 'hello');
        expect(ctx.path).toBe('/users/teams/notes.txt');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write delegates on an exact path match', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/shared/config.json', allow: ['read', 'write'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.write(ctx, '/users/shared/config.json', '{}');
          expect(ctx.path).toBe('/users/shared/config.json');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('write denies a sibling of an exact path match', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/shared/config.json', allow: ['read', 'write'] }],
        },
        () =>
          expectDenial(
            () => driver.write(freshCtx(), '/users/shared/other.json', '{}'),
            'EACCES',
            "'/users/shared/other.json' outside accessRules",
            '/users/shared/other.json'
          )
      );
    });

    it('write delegates on a shallow child match', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/teams/*', allow: ['read', 'write'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.write(ctx, '/users/teams/notes.txt', 'hello');
          expect(ctx.path).toBe('/users/teams/notes.txt');
          expect('result' in ctx).toBe(false);
        }
      );
    });

    it('write denies a nested path under a shallow rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/teams/*', allow: ['read', 'write'] }],
        },
        () =>
          expectDenial(
            () => driver.write(freshCtx(), '/users/teams/backend/src/index.ts', 'hello'),
            'EACCES',
            "'/users/teams/backend/src/index.ts' outside accessRules",
            '/users/teams/backend/src/index.ts'
          )
      );
    });

    it('write delegates on a deep path under a recursive rule', async () => {
      const driver = new NormalizerDriver();
      await withFs(
        {
          ownerId: OWNER,
          homeDir: HOME,
          accessRules: [{ path: '/users/projects/**', allow: ['read', 'write'] }],
        },
        async () => {
          const ctx = freshCtx();
          await driver.write(ctx, '/users/projects/app/src/index.ts', 'hello');
          expect(ctx.path).toBe('/users/projects/app/src/index.ts');
          expect('result' in ctx).toBe(false);
        }
      );
    });
  });

  describe('deployment scopes', () => {
    it('open scope resolves a canonical path directly against the base', async () => {
      const driver = new NormalizerDriver();
      await withFs({}, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, '/shared/spec.md', 'hello');
        expect(ctx.path).toBe('/shared/spec.md');
        expect(ctx.dirname).toBe('/shared');
        expect(ctx.cwd).toBe('/home');
        expect('result' in ctx).toBe(false);
      });
    });

    it('user scope isolates a relative path at homeDir', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'notes.txt', 'hello');
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('tenant scope binds mountPoint tenancy to homeDir isolation', async () => {
      const driver = new NormalizerDriver({ mountPoint: TENANT_MOUNT });
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'notes.txt', 'hello');
        expect(ctx.path).toBe('/tenants/acme/users/alice/notes.txt');
        expect(ctx.dirname).toBe('/tenants/acme/users/alice');
        expect(ctx.cwd).toBe('/users/alice');
        expect('result' in ctx).toBe(false);
      });
    });

    it('tenant scope keeps dual paths inside one tenant partition', async () => {
      const driver = new NormalizerDriver({ mountPoint: TENANT_MOUNT });
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.copy(ctx, 'a.txt', 'b.txt');
        expect(ctx.path).toBe('/tenants/acme/users/alice/a.txt');
        expect(ctx.destination).toBe('/tenants/acme/users/alice/b.txt');
        expect('result' in ctx).toBe(false);
      });
    });
  });

  describe('content and constraint validation', () => {
    it('write rejects EINVAL on a malformed MIME type', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'file.bin', 'hello', { type: 'not-a-mime' }),
          'EINVAL',
          "validateType: Unsupported MIME type 'not-a-mime'",
          'not-a-mime'
        )
      );
    });

    it('write rejects EINVAL outside an allowedTypes glob', async () => {
      const driver = new NormalizerDriver({ allowedTypes: ['image/*'] });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'doc.pdf', 'hello', { type: 'application/pdf' }),
          'EINVAL',
          "validateType: Unsupported MIME type 'application/pdf'",
          'application/pdf'
        )
      );
    });

    it('write delegates a whitelisted MIME glob', async () => {
      const driver = new NormalizerDriver({ allowedTypes: ['image/*'] });
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'photo.png', 'hello', { type: 'image/png' });
        expect(ctx.path).toBe('/users/alice/photo.png');
        expect('result' in ctx).toBe(false);
      });
    });

    it('write rejects EFBIG past a byte maxSize', async () => {
      const driver = new NormalizerDriver({ maxSize: 8 });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(() => driver.write(freshCtx(), 'big.bin', 'x'.repeat(64)), 'EFBIG', 'exceeds maxSize', 'maxSize')
      );
    });

    it('write rejects EFBIG for FileInput size past maxSize', async () => {
      const driver = new NormalizerDriver({ maxSize: 8 });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'big.bin', { size: 64 }),
          'EFBIG',
          'File size 64 exceeds maxSize 8',
          'maxSize'
        )
      );
    });

    it('write rejects EFBIG for text encoded payload past maxEncodingSize', async () => {
      const driver = new NormalizerDriver({ maxEncodingSize: 16 });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'doc.txt', 'x'.repeat(64), { encoding: 'text' }),
          'EFBIG',
          'File size 64 exceeds maxEncodingSize 16',
          'maxEncodingSize'
        )
      );
    });

    it('write rejects EFBIG past a human readable maxSize', async () => {
      const driver = new NormalizerDriver({ maxSize: '1KB' });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(() => driver.write(freshCtx(), 'big.bin', 'x'.repeat(1025)), 'EFBIG', 'exceeds maxSize', 'maxSize')
      );
    });

    it('write rejects EFBIG past maxEncodingSize on an encoded payload', async () => {
      const driver = new NormalizerDriver({ maxSize: '10MB', maxEncodingSize: 16 });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(
          () => driver.write(freshCtx(), 'doc.json', { hello: 'world, hello world' }, { encoding: 'json' }),
          'EFBIG',
          'exceeds maxEncodingSize',
          'maxEncodingSize'
        )
      );
    });

    it('write delegates an encoded payload inside maxEncodingSize', async () => {
      const driver = new NormalizerDriver({ maxEncodingSize: '1KB' });
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.write(ctx, 'doc.json', { hello: 'world' }, { encoding: 'json' });
        expect(ctx.path).toBe('/users/alice/doc.json');
        expect('result' in ctx).toBe(false);
      });
    });

    it('read rejects EFBIG when encoded transfers exceed maxEncodingSize', async () => {
      const driver = new NormalizerDriver({ maxEncodingSize: 0 });
      await withFs({ ownerId: OWNER, homeDir: HOME }, () =>
        expectDenial(
          () => driver.read(freshCtx(), 'notes.txt', { encoding: 'text' }),
          'EFBIG',
          'exceeds maxEncodingSize',
          'maxEncodingSize'
        )
      );
    });

    it('read delegates an encoded transfer inside maxEncodingSize', async () => {
      const driver = new NormalizerDriver();
      await withFs({ ownerId: OWNER, homeDir: HOME }, async () => {
        const ctx = freshCtx();
        await driver.read(ctx, 'notes.txt', { encoding: 'json' });
        expect(ctx.path).toBe('/users/alice/notes.txt');
        expect('result' in ctx).toBe(false);
      });
    });
  });
});
