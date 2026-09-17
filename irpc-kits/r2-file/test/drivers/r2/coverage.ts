import type { R2Bucket } from '@cloudflare/workers-types';
import { resolveBinding } from '@irpclib/irpc/wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDriverCtx } from '../../../src/context.js';
import { R2Driver } from '../../../src/drivers/index.js';
import { NormalizerDriver } from '../../../src/drivers/normalize.js';
import { toStorable } from '../../../src/drivers/r2/codec.js';
import { applySort } from '../../../src/drivers/r2/entry.js';
import type { DriverContext, FileInfo, ListResult } from '../../../src/types.js';
import { withFs } from '../../helpers.js';

let bucket!: R2Bucket;

beforeAll(async () => {
  const env = await resolveBinding<{ BUCKET?: R2Bucket } & Record<string, unknown>>();
  if (!env.BUCKET) throw new Error('r2/coverage.test: missing R2 binding BUCKET from resolveBinding');
  bucket = env.BUCKET;
}, 120_000);

afterAll(async () => {
  if (typeof bucket === 'undefined') return;
  const listed = await bucket.list({ prefix: 'r2cov/' });
  if (listed.objects.length > 0) {
    await bucket.delete(listed.objects.map((obj) => obj.key));
  }
});

describe('R2Driver rollback and branch coverage', () => {
  let normalize!: NormalizerDriver;
  let driver!: R2Driver;

  beforeEach(async () => {
    normalize = new NormalizerDriver();
    driver = new R2Driver(bucket);
    const listed = await bucket.list({ prefix: 'r2cov/' });
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map((obj) => obj.key));
    }
  });

  it('verifies rollback on new file write removes the stored object', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(ctx, '/r2cov/rb-write-new.txt', 'fresh file');
      await driver.write(ctx, '/r2cov/rb-write-new.txt', 'fresh file');

      expect(await bucket.head('r2cov/rb-write-new.txt')).not.toBeNull();

      for (const fn of Array.from(ctx.rollback).reverse()) {
        await fn();
      }

      expect(await bucket.head('r2cov/rb-write-new.txt')).toBeNull();
    });
  });

  it('verifies rollback on overwrite restores previous content and metadata', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2cov/rb-overwrite.txt', 'initial version', {
        type: 'text/plain',
        metadata: { tag: 'init' },
      });
      await driver.write(seed, '/r2cov/rb-overwrite.txt', 'initial version', {
        type: 'text/plain',
        metadata: { tag: 'init' },
      });

      const overwriteCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(overwriteCtx, '/r2cov/rb-overwrite.txt', 'updated version', {
        type: 'text/plain',
        metadata: { tag: 'next' },
      });
      await driver.write(overwriteCtx, '/r2cov/rb-overwrite.txt', 'updated version', {
        type: 'text/plain',
        metadata: { tag: 'next' },
      });

      expect(await (await bucket.get('r2cov/rb-overwrite.txt'))?.text()).toBe('updated version');

      for (const fn of Array.from(overwriteCtx.rollback).reverse()) {
        await fn();
      }

      const restored = await bucket.get('r2cov/rb-overwrite.txt');
      expect(await restored?.text()).toBe('initial version');
      expect(restored?.customMetadata?.tag).toBe('init');
    });
  });

  it('verifies rollback on mkdir removes the created directory marker', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(ctx, '/r2cov/rb-dir');
      await driver.mkdir(ctx, '/r2cov/rb-dir');

      const markerBefore = (await bucket.head('r2cov/rb-dir')) ?? (await bucket.head('r2cov/rb-dir/'));
      expect(markerBefore).not.toBeNull();

      for (const fn of Array.from(ctx.rollback).reverse()) {
        await fn();
      }

      const markerAfter = (await bucket.head('r2cov/rb-dir')) ?? (await bucket.head('r2cov/rb-dir/'));
      expect(markerAfter).toBeNull();
    });
  });

  it('verifies rollback on copy removes the copied destination object', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2cov/rb-src.txt', 'src data');
      await driver.write(seed, '/r2cov/rb-src.txt', 'src data');

      const copyCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(copyCtx, '/r2cov/rb-src.txt', '/r2cov/rb-dest.txt');
      await driver.copy(copyCtx, '/r2cov/rb-src.txt', '/r2cov/rb-dest.txt');

      expect(await bucket.head('r2cov/rb-dest.txt')).not.toBeNull();

      for (const fn of Array.from(copyCtx.rollback).reverse()) {
        await fn();
      }

      expect(await bucket.head('r2cov/rb-dest.txt')).toBeNull();
      expect(await bucket.head('r2cov/rb-src.txt')).not.toBeNull();
    });
  });

  it('verifies rollback on move restores source and removes destination', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2cov/move-src.txt', 'valuable payload');
      await driver.write(seed, '/r2cov/move-src.txt', 'valuable payload');

      const moveCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(moveCtx, '/r2cov/move-src.txt', '/r2cov/move-dest.txt');
      await driver.move(moveCtx, '/r2cov/move-src.txt', '/r2cov/move-dest.txt');

      expect(await bucket.head('r2cov/move-src.txt')).toBeNull();
      expect(await bucket.head('r2cov/move-dest.txt')).not.toBeNull();

      for (const fn of Array.from(moveCtx.rollback).reverse()) {
        await fn();
      }

      expect(await bucket.head('r2cov/move-src.txt')).not.toBeNull();
      expect(await (await bucket.get('r2cov/move-src.txt'))?.text()).toBe('valuable payload');
      expect(await bucket.head('r2cov/move-dest.txt')).toBeNull();
    });
  });

  it('verifies rollback on link removes alias marker', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(ctx, '/r2cov/link-target.txt', '/r2cov/link-alias.txt');
      await driver.link(ctx, '/r2cov/link-target.txt', '/r2cov/link-alias.txt');

      expect(await bucket.head('r2cov/link-alias.txt')).not.toBeNull();

      for (const fn of Array.from(ctx.rollback).reverse()) {
        await fn();
      }

      expect(await bucket.head('r2cov/link-alias.txt')).toBeNull();
    });
  });

  it('verifies rollback on soft remove restores object from trash', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2cov/rb-trash.txt', 'restore me');
      await softDriver.write(seed, '/r2cov/rb-trash.txt', 'restore me');

      const removeCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removeCtx, '/r2cov/rb-trash.txt');
      await softDriver.remove(removeCtx, '/r2cov/rb-trash.txt');

      const headDeleted = await bucket.head('r2cov/rb-trash.txt');
      expect(headDeleted?.customMetadata?._fs_deleted).toBeDefined();

      for (const fn of Array.from(removeCtx.rollback).reverse()) {
        await fn();
      }

      const headRestored = await bucket.head('r2cov/rb-trash.txt');
      expect(headRestored?.customMetadata?._fs_deleted).toBeUndefined();
    });
  });

  it('verifies rollback on restore re-applies soft delete', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2cov/rb-untrash.txt', 'trash data');
      await softDriver.write(seed, '/r2cov/rb-untrash.txt', 'trash data');

      const removeCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removeCtx, '/r2cov/rb-untrash.txt');
      await softDriver.remove(removeCtx, '/r2cov/rb-untrash.txt');

      const restoreCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(restoreCtx, '/r2cov/rb-untrash.txt');
      await softDriver.restore(restoreCtx, '/r2cov/rb-untrash.txt');

      expect((await bucket.head('r2cov/rb-untrash.txt'))?.customMetadata?._fs_deleted).toBeUndefined();

      for (const fn of Array.from(restoreCtx.rollback).reverse()) {
        await fn();
      }

      expect((await bucket.head('r2cov/rb-untrash.txt'))?.customMetadata?._fs_deleted).toBeDefined();
    });
  });

  it('allows strict removal of an empty directory', async () => {
    await withFs({}, async () => {
      const strictDriver = new R2Driver(bucket, { strict: true });
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(ctx, '/r2cov/empty-dir');
      await driver.mkdir(ctx, '/r2cov/empty-dir');

      const removeCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removeCtx, '/r2cov/empty-dir');
      await strictDriver.remove(removeCtx, '/r2cov/empty-dir');

      expect(removeCtx.result).toBe(true);
      const marker = (await bucket.head('r2cov/empty-dir')) ?? (await bucket.head('r2cov/empty-dir/'));
      expect(marker).toBeNull();
    });
  });

  it('sorts listing by size and mtime descending', async () => {
    await withFs({}, async () => {
      const s1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s1, '/r2cov/sort/small.txt', 'a');
      await driver.write(s1, '/r2cov/sort/small.txt', 'a');

      const s2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(s2, '/r2cov/sort/big.txt', 'large content here');
      await driver.write(s2, '/r2cov/sort/big.txt', 'large content here');

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/sort', { sort: '-size' });
      await driver.list(listCtx, '/r2cov/sort', { sort: '-size' });

      const names = (listCtx.result as ListResult).entries.map((e) => e.name);
      expect(names).toEqual(['big.txt', 'small.txt']);

      const mtimeCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(mtimeCtx, '/r2cov/sort', { sort: ['mtime', '-size'] });
      await driver.list(mtimeCtx, '/r2cov/sort', { sort: ['mtime', '-size'] });
      expect((mtimeCtx.result as ListResult).entries.length).toBe(2);
    });
  });

  it('accepts raw Buffer write', async () => {
    await withFs({}, async () => {
      const ctx: DriverContext<FileInfo> = createDriverCtx();
      const buf = Buffer.from('raw buffer data');

      await normalize.write(ctx, '/r2cov/buffer.bin', buf as any, { type: 'application/octet-stream' });
      await driver.write(ctx, '/r2cov/buffer.bin', buf as any, { type: 'application/octet-stream' });

      expect((ctx.result as FileInfo).size).toBe(15);
      const stored = await bucket.get('r2cov/buffer.bin');
      expect(await stored?.text()).toBe('raw buffer data');
    });
  });

  it('verifies rollback on permanent single file remove restores object', async () => {
    await withFs({}, async () => {
      const seed: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(seed, '/r2cov/rb-hard.txt', 'critical data');
      await driver.write(seed, '/r2cov/rb-hard.txt', 'critical data');

      const removeCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removeCtx, '/r2cov/rb-hard.txt', { force: true });
      await driver.remove(removeCtx, '/r2cov/rb-hard.txt', { force: true });

      expect(await bucket.head('r2cov/rb-hard.txt')).toBeNull();

      for (const fn of Array.from(removeCtx.rollback).reverse()) {
        await fn();
      }

      const restored = await bucket.get('r2cov/rb-hard.txt');
      expect(await restored?.text()).toBe('critical data');
    });
  });

  it('verifies rollback on permanent recursive remove restores all victims', async () => {
    await withFs({}, async () => {
      const f1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f1, '/r2cov/tree/c1.txt', 'child 1');
      await driver.write(f1, '/r2cov/tree/c1.txt', 'child 1');

      const f2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f2, '/r2cov/tree/c2.txt', 'child 2');
      await driver.write(f2, '/r2cov/tree/c2.txt', 'child 2');

      const removeCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(removeCtx, '/r2cov/tree', { recursive: true, force: true });
      await driver.remove(removeCtx, '/r2cov/tree', { recursive: true, force: true });

      expect(await bucket.head('r2cov/tree/c1.txt')).toBeNull();
      expect(await bucket.head('r2cov/tree/c2.txt')).toBeNull();

      for (const fn of Array.from(removeCtx.rollback).reverse()) {
        await fn();
      }

      expect(await (await bucket.get('r2cov/tree/c1.txt'))?.text()).toBe('child 1');
      expect(await (await bucket.get('r2cov/tree/c2.txt'))?.text()).toBe('child 2');
    });
  });

  it('reads through a symbolic link to its target payload', async () => {
    await withFs({}, async () => {
      const tgtCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(tgtCtx, '/r2cov/sym-target.txt', 'dereferenced payload', { type: 'text/plain' });
      await driver.write(tgtCtx, '/r2cov/sym-target.txt', 'dereferenced payload', { type: 'text/plain' });

      const linkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(linkCtx, '/r2cov/sym-target.txt', '/r2cov/sym-ptr.txt');
      await driver.link(linkCtx, '/r2cov/sym-target.txt', '/r2cov/sym-ptr.txt');

      const readCtx: DriverContext<unknown> = createDriverCtx();
      await normalize.read(readCtx, '/r2cov/sym-ptr.txt', { encoding: 'text' });
      await driver.read(readCtx, '/r2cov/sym-ptr.txt', { encoding: 'text' });

      expect(readCtx.result).toBe('dereferenced payload');
    });
  });

  it('returns undefined when reading a broken symlink or one pointing to a directory or trashed target', async () => {
    await withFs({}, async () => {
      // 1. Target missing
      const bLinkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(bLinkCtx, '/r2cov/missing-target.txt', '/r2cov/broken-ptr.txt');
      await driver.link(bLinkCtx, '/r2cov/missing-target.txt', '/r2cov/broken-ptr.txt');

      const bReadCtx: DriverContext<unknown> = createDriverCtx();
      await normalize.read(bReadCtx, '/r2cov/broken-ptr.txt');
      await driver.read(bReadCtx, '/r2cov/broken-ptr.txt');
      expect(bReadCtx.result).toBeUndefined();

      // 2. Target is directory
      const dTargetCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dTargetCtx, '/r2cov/target-dir');
      await driver.mkdir(dTargetCtx, '/r2cov/target-dir');

      const dLinkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(dLinkCtx, '/r2cov/target-dir', '/r2cov/dir-ptr.txt');
      await driver.link(dLinkCtx, '/r2cov/target-dir', '/r2cov/dir-ptr.txt');

      const dReadCtx: DriverContext<unknown> = createDriverCtx();
      await normalize.read(dReadCtx, '/r2cov/dir-ptr.txt');
      await driver.read(dReadCtx, '/r2cov/dir-ptr.txt');
      expect(dReadCtx.result).toBeUndefined();

      // 3. Target is trashed
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const tTargetCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(tTargetCtx, '/r2cov/trashed-tgt.txt', 'trashed content');
      await softDriver.write(tTargetCtx, '/r2cov/trashed-tgt.txt', 'trashed content');

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/r2cov/trashed-tgt.txt');
      await softDriver.remove(remCtx, '/r2cov/trashed-tgt.txt');

      const tLinkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(tLinkCtx, '/r2cov/trashed-tgt.txt', '/r2cov/trash-ptr.txt');
      await softDriver.link(tLinkCtx, '/r2cov/trashed-tgt.txt', '/r2cov/trash-ptr.txt');

      const hideReadCtx: DriverContext<unknown> = createDriverCtx();
      await normalize.read(hideReadCtx, '/r2cov/trash-ptr.txt');
      await softDriver.read(hideReadCtx, '/r2cov/trash-ptr.txt');
      expect(hideReadCtx.result).toBeUndefined();

      const directReadCtx: DriverContext<unknown> = createDriverCtx();
      await normalize.read(directReadCtx, '/r2cov/trashed-tgt.txt');
      await softDriver.read(directReadCtx, '/r2cov/trashed-tgt.txt');
      expect(directReadCtx.result).toBeUndefined();
    });
  });

  it('copies directory marker and modifies public flag', async () => {
    await withFs({}, async () => {
      // Directory copy
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/r2cov/orig-d', { public: true });
      await driver.mkdir(dirCtx, '/r2cov/orig-d', { public: true });

      const cpDirCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(cpDirCtx, '/r2cov/orig-d', '/r2cov/cp-d');
      await driver.copy(cpDirCtx, '/r2cov/orig-d', '/r2cov/cp-d');
      expect(cpDirCtx.result).toBe(true);

      const cpHead = await bucket.head('r2cov/cp-d');
      expect(cpHead?.customMetadata?._fs_type).toBe('inode/directory');

      // Directory copy with public: true
      const cpDirPubCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(cpDirPubCtx, '/r2cov/orig-d', '/r2cov/cp-pub-d', { public: true });
      await driver.copy(cpDirPubCtx, '/r2cov/orig-d', '/r2cov/cp-pub-d', { public: true });
      expect(cpDirPubCtx.result).toBe(true);

      const cpPubHead = await bucket.head('r2cov/cp-pub-d');
      expect(cpPubHead?.customMetadata?._fs_public).toBe('true');

      // Public: false copy
      const pubCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(pubCtx, '/r2cov/pub.txt', 'hello', { public: true });
      await driver.write(pubCtx, '/r2cov/pub.txt', 'hello', { public: true });

      const privCopyCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(privCopyCtx, '/r2cov/pub.txt', '/r2cov/priv.txt', { public: false });
      await driver.copy(privCopyCtx, '/r2cov/pub.txt', '/r2cov/priv.txt', { public: false });

      const privHead = await bucket.head('r2cov/priv.txt');
      expect(privHead?.customMetadata?._fs_public).toBeUndefined();
    });
  });

  it('moves a directory marker and restores it on rollback', async () => {
    await withFs({}, async () => {
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/r2cov/mv-orig-d');
      await driver.mkdir(dirCtx, '/r2cov/mv-orig-d');

      const mvCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(mvCtx, '/r2cov/mv-orig-d', '/r2cov/mv-dest-d');
      await driver.move(mvCtx, '/r2cov/mv-orig-d', '/r2cov/mv-dest-d');

      expect(mvCtx.result).toBe(true);
      expect(await bucket.head('r2cov/mv-orig-d')).toBeNull();
      expect(await bucket.head('r2cov/mv-dest-d')).not.toBeNull();

      for (const fn of Array.from(mvCtx.rollback).reverse()) {
        await fn();
      }

      expect(await bucket.head('r2cov/mv-orig-d')).not.toBeNull();
      expect(await bucket.head('r2cov/mv-dest-d')).toBeNull();
    });
  });

  it('handles soft-delete idempotency on already soft-deleted file', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/repeat-trash.txt', 'data');
      await softDriver.write(wCtx, '/r2cov/repeat-trash.txt', 'data');

      const r1: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(r1, '/r2cov/repeat-trash.txt');
      await softDriver.remove(r1, '/r2cov/repeat-trash.txt');
      expect(r1.result).toBe(true);

      const r2: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(r2, '/r2cov/repeat-trash.txt');
      await softDriver.remove(r2, '/r2cov/repeat-trash.txt');
      expect(r2.result).toBe(true);
    });
  });

  it('returns false when removing a non-existent path', async () => {
    await withFs({}, async () => {
      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/r2cov/ghost-path.txt');
      await driver.remove(remCtx, '/r2cov/ghost-path.txt');
      expect(remCtx.result).toBe(false);
    });
  });

  it('lists soft-deleted entries exclusively when filter.deleted is true', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const a1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(a1, '/r2cov/flt/active.txt', 'active');
      await softDriver.write(a1, '/r2cov/flt/active.txt', 'active');

      const d1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(d1, '/r2cov/flt/deleted.txt', 'deleted');
      await softDriver.write(d1, '/r2cov/flt/deleted.txt', 'deleted');

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/r2cov/flt/deleted.txt');
      await softDriver.remove(remCtx, '/r2cov/flt/deleted.txt');

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/flt', { filter: { deleted: true } });
      await softDriver.list(listCtx, '/r2cov/flt', { filter: { deleted: true } });

      const names = (listCtx.result as ListResult).entries.map((e) => e.name);
      expect(names).toEqual(['deleted.txt']);
    });
  });

  it('extracts user metadata while omitting internal _fs_ stamps through stat and list', async () => {
    await withFs({}, async () => {
      const withUser: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(withUser, '/r2cov/meta/user.txt', 'content', { metadata: { author: 'alice' } });
      await driver.write(withUser, '/r2cov/meta/user.txt', 'content', { metadata: { author: 'alice' } });

      const withoutUser: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(withoutUser, '/r2cov/meta/internal-only.txt', 'content');
      await driver.write(withoutUser, '/r2cov/meta/internal-only.txt', 'content');

      const statUser: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statUser, '/r2cov/meta/user.txt');
      await driver.stat(statUser, '/r2cov/meta/user.txt');
      expect(statUser.result?.metadata).toEqual({ author: 'alice' });

      const statInternal: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statInternal, '/r2cov/meta/internal-only.txt');
      await driver.stat(statInternal, '/r2cov/meta/internal-only.txt');
      expect(statInternal.result?.metadata).toBeUndefined();

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/meta');
      await driver.list(listCtx, '/r2cov/meta');
      const userEntry = (listCtx.result as ListResult).entries.find((e) => e.name === 'user.txt');
      const internalEntry = (listCtx.result as ListResult).entries.find((e) => e.name === 'internal-only.txt');
      expect(userEntry?.metadata).toEqual({ author: 'alice' });
      expect(internalEntry?.metadata).toBeUndefined();
    });
  });

  it('parses both numeric epoch and ISO date strings in deletedAt through stat', async () => {
    await withFs({}, async () => {
      // Put objects directly into R2 with numeric and ISO deletion stamps
      await bucket.put('r2cov/trash-num.txt', 'num data', {
        customMetadata: { _fs_deleted: '1704067200000' },
      });
      await bucket.put('r2cov/trash-iso.txt', 'iso data', {
        customMetadata: { _fs_deleted: '2026-01-01T00:00:00.000Z' },
      });

      const numCtx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(numCtx, '/r2cov/trash-num.txt', { trash: true });
      await driver.stat(numCtx, '/r2cov/trash-num.txt', { trash: true });
      expect(numCtx.result?.deletedAt?.getTime()).toBe(1704067200000);

      const isoCtx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(isoCtx, '/r2cov/trash-iso.txt', { trash: true });
      await driver.stat(isoCtx, '/r2cov/trash-iso.txt', { trash: true });
      expect(isoCtx.result?.deletedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  it('handles sort tie-breakers through list when entries have identical sort values', async () => {
    await withFs({}, async () => {
      const f1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f1, '/r2cov/ties/alpha.txt', 'same-len');
      await driver.write(f1, '/r2cov/ties/alpha.txt', 'same-len');

      const f2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f2, '/r2cov/ties/beta.txt', 'same-len');
      await driver.write(f2, '/r2cov/ties/beta.txt', 'same-len');

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/ties', { sort: 'size' });
      await driver.list(listCtx, '/r2cov/ties', { sort: 'size' });

      expect((listCtx.result as ListResult).entries.length).toBe(2);
    });
  });

  it('confirms exists on a virtual directory without a marker through hasActiveChild', async () => {
    await withFs({}, async () => {
      // Put a file under /r2cov/virtual/child.txt directly into bucket without directory marker
      await bucket.put('r2cov/virtual/child.txt', 'child');

      const exCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(exCtx, '/r2cov/virtual');
      await driver.exists(exCtx, '/r2cov/virtual');

      expect(exCtx.result).toBe(true);
    });
  });

  it('stats a virtual directory without a marker through hasChildren', async () => {
    await withFs({}, async () => {
      await bucket.put('r2cov/vdir/item.txt', 'data');

      const statCtx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statCtx, '/r2cov/vdir');
      await driver.stat(statCtx, '/r2cov/vdir');

      expect(statCtx.result?.isDirectory).toBe(true);
      expect(statCtx.result?.type).toBe('inode/directory');
      expect(statCtx.result?.size).toBe(0);
    });
  });

  it('stats a directory marker created with public: true and custom metadata', async () => {
    await withFs({}, async () => {
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/r2cov/pub-dir', { public: true, metadata: { section: 'docs' } });
      await driver.mkdir(dirCtx, '/r2cov/pub-dir', { public: true, metadata: { section: 'docs' } });

      const statCtx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(statCtx, '/r2cov/pub-dir');
      await driver.stat(statCtx, '/r2cov/pub-dir');

      expect(statCtx.result?.public).toBe(true);
      expect(statCtx.result?.metadata).toEqual({ section: 'docs' });
    });
  });

  it('lists entries reflecting symlink, public, and hidden flags', async () => {
    await withFs({}, async () => {
      // 1. Regular file with public
      const pCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(pCtx, '/r2cov/mixed/pub.txt', 'pub data', { public: true });
      await driver.write(pCtx, '/r2cov/mixed/pub.txt', 'pub data', { public: true });

      // 2. Hidden file
      const hCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(hCtx, '/r2cov/mixed/hidden.txt', 'hidden data', { hidden: true });
      await driver.write(hCtx, '/r2cov/mixed/hidden.txt', 'hidden data', { hidden: true });

      // 3. Symlink
      const lCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(lCtx, '/r2cov/mixed/pub.txt', '/r2cov/mixed/link.txt');
      await driver.link(lCtx, '/r2cov/mixed/pub.txt', '/r2cov/mixed/link.txt');

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/mixed', { all: true });
      await driver.list(listCtx, '/r2cov/mixed', { all: true });

      const entries = (listCtx.result as ListResult).entries;
      const pubEntry = entries.find((e) => e.name === 'pub.txt');
      const hiddenEntry = entries.find((e) => e.name === 'hidden.txt');
      const linkEntry = entries.find((e) => e.name === 'link.txt');

      expect(pubEntry?.public).toBe(true);
      expect(hiddenEntry?.hidden).toBe(true);
      expect(linkEntry?.link).toBe('/r2cov/mixed/pub.txt');
    });
  });

  it('handles sort tie-breakers through list when entries have identical mtime', async () => {
    await withFs({}, async () => {
      const f1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f1, '/r2cov/mties/a.txt', 'data a');
      await driver.write(f1, '/r2cov/mties/a.txt', 'data a');

      const f2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f2, '/r2cov/mties/b.txt', 'data b');
      await driver.write(f2, '/r2cov/mties/b.txt', 'data b');

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/mties', { sort: ['mtime', 'name'] });
      await driver.list(listCtx, '/r2cov/mties', { sort: ['mtime', 'name'] });

      expect((listCtx.result as ListResult).entries.length).toBe(2);
    });
  });

  it('halts copy with ENOENT when source exists but is soft-deleted', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/trash-src.txt', 'data');
      await softDriver.write(wCtx, '/r2cov/trash-src.txt', 'data');

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/r2cov/trash-src.txt');
      await softDriver.remove(remCtx, '/r2cov/trash-src.txt');

      const copyCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(copyCtx, '/r2cov/trash-src.txt', '/r2cov/trash-dst.txt');
      await expect(softDriver.copy(copyCtx, '/r2cov/trash-src.txt', '/r2cov/trash-dst.txt')).rejects.toThrow();
    });
  });

  it('verifies rollback on directory copy deletes destination directory marker', async () => {
    await withFs({}, async () => {
      const dirCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dirCtx, '/r2cov/cp-dir-src');
      await driver.mkdir(dirCtx, '/r2cov/cp-dir-src');

      const copyCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.copy(copyCtx, '/r2cov/cp-dir-src', '/r2cov/cp-dir-dst');
      await driver.copy(copyCtx, '/r2cov/cp-dir-src', '/r2cov/cp-dir-dst');

      expect(await bucket.head('r2cov/cp-dir-dst')).not.toBeNull();

      for (const fn of Array.from(copyCtx.rollback).reverse()) {
        await fn();
      }

      expect(await bucket.head('r2cov/cp-dir-dst')).toBeNull();
    });
  });

  it('confirms exists on a directory marker stored with trailing slash', async () => {
    await withFs({}, async () => {
      await bucket.put('r2cov/slashed-dir/', '', {
        httpMetadata: { contentType: 'inode/directory' },
      });

      const exCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(exCtx, '/r2cov/slashed-dir');
      await driver.exists(exCtx, '/r2cov/slashed-dir');

      expect(exCtx.result).toBe(true);
    });
  });

  it('sorts listing entries by descending mtime', async () => {
    await withFs({}, async () => {
      const w1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(w1, '/r2cov/desc/older.txt', '1');
      await driver.write(w1, '/r2cov/desc/older.txt', '1');

      const w2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(w2, '/r2cov/desc/newer.txt', '2');
      await driver.write(w2, '/r2cov/desc/newer.txt', '2');

      const listCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(listCtx, '/r2cov/desc', { sort: '-mtime' });
      await driver.list(listCtx, '/r2cov/desc', { sort: '-mtime' });

      expect((listCtx.result as ListResult).entries.length).toBe(2);
    });
  });

  it('evaluates hasActiveChild returning false when all virtual dir children are soft-deleted', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });

      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/vdir-del/child.txt', 'data');
      await softDriver.write(wCtx, '/r2cov/vdir-del/child.txt', 'data');

      const rmCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rmCtx, '/r2cov/vdir-del/child.txt');
      await softDriver.remove(rmCtx, '/r2cov/vdir-del/child.txt');

      const exCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(exCtx, '/r2cov/vdir-del');
      await softDriver.exists(exCtx, '/r2cov/vdir-del');
      expect(exCtx.result).toBe(false);
    });
  });

  it('stats symlink preserving public and dotfile hidden flags', async () => {
    await withFs({}, async () => {
      const tgtCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(tgtCtx, '/r2cov/sym-target.txt', 'hello');
      await driver.write(tgtCtx, '/r2cov/sym-target.txt', 'hello');

      const lnCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.link(lnCtx, '/r2cov/sym-target.txt', '/r2cov/.pub-sym', { public: true });
      await driver.link(lnCtx, '/r2cov/sym-target.txt', '/r2cov/.pub-sym', { public: true });

      const stCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.stat(stCtx, '/r2cov/.pub-sym');
      await driver.stat(stCtx, '/r2cov/.pub-sym');

      expect(stCtx.result?.type).toBe('application/octet-stream');
      expect(stCtx.result?.link).toBe('/r2cov/sym-target.txt');
      expect(stCtx.result?.public).toBe(true);
      expect(stCtx.result?.hidden).toBe(true);
    });
  });

  it('lists directory markers encountered during recursive listing', async () => {
    await withFs({}, async () => {
      const mkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(mkCtx, '/r2cov/rec-sub/child-dir');
      await driver.mkdir(mkCtx, '/r2cov/rec-sub/child-dir');

      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/rec-sub/child-dir/file.txt', 'data');
      await driver.write(wCtx, '/r2cov/rec-sub/child-dir/file.txt', 'data');

      const lCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(lCtx, '/r2cov/rec-sub', { recursive: true });
      await driver.list(lCtx, '/r2cov/rec-sub', { recursive: true });

      const dirEntry = lCtx.result?.entries.find((e) => e.name === 'child-dir');
      expect(dirEntry?.isDirectory).toBe(true);
      expect(dirEntry?.size).toBe(0);
      expect(dirEntry?.type).toBe('inode/directory');
    });
  });

  it('handles size tie-breakers through list when entries have identical size', async () => {
    await withFs({}, async () => {
      const w1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(w1, '/r2cov/sz/a.txt', 'abc');
      await driver.write(w1, '/r2cov/sz/a.txt', 'abc');

      const w2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(w2, '/r2cov/sz/b.txt', 'xyz');
      await driver.write(w2, '/r2cov/sz/b.txt', 'xyz');

      const lCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(lCtx, '/r2cov/sz', { sort: 'size' });
      await driver.list(lCtx, '/r2cov/sz', { sort: 'size' });

      expect(lCtx.result?.entries.length).toBe(2);
    });
  });

  it('removes directories spanning paginated continuation pages in listKeys', async () => {
    await withFs({}, async () => {
      const f1: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f1, '/r2cov/trunc/f1.txt', '1');
      await driver.write(f1, '/r2cov/trunc/f1.txt', '1');

      const f2: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(f2, '/r2cov/trunc/f2.txt', '2');
      await driver.write(f2, '/r2cov/trunc/f2.txt', '2');

      let pageCount = 0;
      const wrappedBucket: R2Bucket = {
        head: (k: string) => bucket.head(k),
        get: (k: string, opts?: any) => bucket.get(k, opts),
        put: (k: string, v: any, opts?: any) => bucket.put(k, v, opts),
        delete: (k: any) => bucket.delete(k),
        list: async (opts?: any) => {
          if (opts?.prefix?.startsWith('r2cov/trunc/') && !opts?.cursor) {
            pageCount++;
            return {
              objects: [{ key: 'r2cov/trunc/f1.txt', size: 1, uploaded: new Date(), etag: '1' }] as any,
              delimitedPrefixes: [],
              truncated: true,
              cursor: 'c-next',
            };
          }
          return bucket.list(opts);
        },
      } as unknown as R2Bucket;

      const pDriver = new R2Driver(wrappedBucket);
      const rmCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rmCtx, '/r2cov/trunc', { recursive: true });
      await pDriver.remove(rmCtx, '/r2cov/trunc', { recursive: true });
      expect(rmCtx.result).toBe(true);
      expect(pageCount).toBe(1);
    });
  });

  it('soft-deletes virtual directory targeting its first child', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/vdir-soft/child.txt', 'child');
      await softDriver.write(wCtx, '/r2cov/vdir-soft/child.txt', 'child');

      const rmCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rmCtx, '/r2cov/vdir-soft');
      await softDriver.remove(rmCtx, '/r2cov/vdir-soft');
      expect(rmCtx.result).toBe(true);

      const stCtx: DriverContext<FileInfo | undefined> = createDriverCtx();
      await normalize.stat(stCtx, '/r2cov/vdir-soft/child.txt', { trash: true });
      await softDriver.stat(stCtx, '/r2cov/vdir-soft/child.txt', { trash: true });
      expect(stCtx.result?.deletedAt).toBeDefined();
    });
  });

  it('removes directory with slashed marker during recursive removal', async () => {
    await withFs({}, async () => {
      await bucket.put('r2cov/slash-tree/', '', { httpMetadata: { contentType: 'inode/directory' } });
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/slash-tree/f.txt', 'data');
      await driver.write(wCtx, '/r2cov/slash-tree/f.txt', 'data');

      const rmCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rmCtx, '/r2cov/slash-tree', { recursive: true });
      await driver.remove(rmCtx, '/r2cov/slash-tree', { recursive: true });
      expect(rmCtx.result).toBe(true);
    });
  });

  it('confirms exists on soft-deleted slashed directory marker when trash is requested', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      await bucket.put('r2cov/slashed-soft/', '', {
        httpMetadata: { contentType: 'inode/directory' },
      });

      const rmCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(rmCtx, '/r2cov/slashed-soft');
      await softDriver.remove(rmCtx, '/r2cov/slashed-soft');

      const exFalseCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(exFalseCtx, '/r2cov/slashed-soft');
      await softDriver.exists(exFalseCtx, '/r2cov/slashed-soft');
      expect(exFalseCtx.result).toBe(false);

      const exCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.exists(exCtx, '/r2cov/slashed-soft', { trash: true } as any);
      await softDriver.exists(exCtx, '/r2cov/slashed-soft', { trash: true } as any);
      expect(exCtx.result).toBe(true);
    });
  });

  it('filters dot-directory from delimitedPrefixes unless all is requested', async () => {
    await withFs({}, async () => {
      const dDotCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(dDotCtx, '/r2cov/dots/.hidden-sub');
      await driver.mkdir(dDotCtx, '/r2cov/dots/.hidden-sub');

      const lHideCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(lHideCtx, '/r2cov/dots');
      await driver.list(lHideCtx, '/r2cov/dots');
      expect(lHideCtx.result?.entries.length).toBe(0);

      const lAllCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(lAllCtx, '/r2cov/dots', { all: true });
      await driver.list(lAllCtx, '/r2cov/dots', { all: true });
      expect(lAllCtx.result?.entries.length).toBe(1);
    });
  });

  it('lists objects retaining already populated customMetadata without head call', async () => {
    await withFs({}, async () => {
      let listCalled = false;
      const cachedBucket: R2Bucket = {
        head: (k: string) => bucket.head(k),
        get: (k: string, opts?: any) => bucket.get(k, opts),
        put: (k: string, v: any, opts?: any) => bucket.put(k, v, opts),
        delete: (k: any) => bucket.delete(k),
        list: async (opts?: any) => {
          if (opts?.prefix?.startsWith('r2cov/cached-meta/') && !listCalled) {
            listCalled = true;
            return {
              objects: [
                {
                  key: 'r2cov/cached-meta/f.txt',
                  size: 1,
                  uploaded: new Date(),
                  etag: '1',
                  customMetadata: { author: 'bob' },
                },
              ] as any,
              delimitedPrefixes: [],
              truncated: false,
            };
          }
          return bucket.list(opts);
        },
      } as unknown as R2Bucket;

      const cDriver = new R2Driver(cachedBucket);
      const cListCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(cListCtx, '/r2cov/cached-meta');
      await cDriver.list(cListCtx, '/r2cov/cached-meta');
      expect(cListCtx.result?.entries[0].metadata).toEqual({ author: 'bob' });
    });
  });

  it('lists root directory when path is /', async () => {
    await withFs({}, async () => {
      const rootCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(rootCtx, '/');
      await driver.list(rootCtx, '/');
      expect(rootCtx.result?.entries).toBeDefined();
    });
  });

  it('halts move with ENOENT when source exists but is soft-deleted', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/trash-move-src.txt', 'data');
      await softDriver.write(wCtx, '/r2cov/trash-move-src.txt', 'data');

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/r2cov/trash-move-src.txt');
      await softDriver.remove(remCtx, '/r2cov/trash-move-src.txt');

      const moveCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.move(moveCtx, '/r2cov/trash-move-src.txt', '/r2cov/trash-move-dst.txt');
      await expect(
        softDriver.move(moveCtx, '/r2cov/trash-move-src.txt', '/r2cov/trash-move-dst.txt')
      ).rejects.toThrow();
    });
  });

  it('restores a soft-deleted directory marker returning directory FileInfo', async () => {
    await withFs({}, async () => {
      const softDriver = new R2Driver(bucket, { softDelete: true });
      const mkCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.mkdir(mkCtx, '/r2cov/trash-dir');
      await softDriver.mkdir(mkCtx, '/r2cov/trash-dir');

      const remCtx: DriverContext<boolean> = createDriverCtx();
      await normalize.remove(remCtx, '/r2cov/trash-dir');
      await softDriver.remove(remCtx, '/r2cov/trash-dir');

      const resCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.restore(resCtx, '/r2cov/trash-dir');
      await softDriver.restore(resCtx, '/r2cov/trash-dir');

      expect(resCtx.result?.isDirectory).toBe(true);
      expect(resCtx.result?.type).toBe('inode/directory');
    });
  });

  it('skips self-referencing slashed marker when listing directory', async () => {
    await withFs({}, async () => {
      await bucket.put('r2cov/self-slashed/', '', {
        httpMetadata: { contentType: 'inode/directory' },
      });
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/self-slashed/item.txt', 'data');
      await driver.write(wCtx, '/r2cov/self-slashed/item.txt', 'data');

      const lCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(lCtx, '/r2cov/self-slashed');
      await driver.list(lCtx, '/r2cov/self-slashed');

      expect(lCtx.result?.entries.length).toBe(1);
      expect(lCtx.result?.entries[0].name).toBe('item.txt');
    });
  });

  it('includes visible directory from delimitedPrefixes when options has all: false', async () => {
    await withFs({}, async () => {
      const wCtx: DriverContext<FileInfo> = createDriverCtx();
      await normalize.write(wCtx, '/r2cov/sub-vis/child/f.txt', 'data');
      await driver.write(wCtx, '/r2cov/sub-vis/child/f.txt', 'data');

      const lCtx: DriverContext<ListResult> = createDriverCtx();
      await normalize.list(lCtx, '/r2cov/sub-vis', { all: false });
      await driver.list(lCtx, '/r2cov/sub-vis', { all: false });

      expect(lCtx.result?.entries.some((e) => e.name === 'child')).toBe(true);
    });
  });
});

describe('R2 codec and entry units', () => {
  it('reads a top-level arrayBuffer payload with the correct receiver', async () => {
    const bytes = new TextEncoder().encode('blob body');
    const blob = new Blob([bytes], { type: 'text/plain' });
    const result = await toStorable(blob as never);
    expect(new Uint8Array(result as ArrayBuffer)).toEqual(bytes);
  });

  it('sorts entries by type, hidden, public, and deletedAt', () => {
    const base = { path: '/x', name: 'x', size: 0, type: 'text/plain', mtime: new Date(0), isDirectory: false };
    const mk = (o: Partial<FileInfo>): FileInfo => ({ ...base, ...o }) as FileInfo;

    const byType = [mk({ type: 'text/plain' }), mk({ type: 'application/json' })];
    applySort(byType, 'type');
    expect(byType.map((e) => e.type)).toEqual(['application/json', 'text/plain']);

    const byPublic = [mk({ public: true }), mk({})];
    applySort(byPublic, 'public');
    expect(byPublic.map((e) => e.public)).toEqual([undefined, true]);
    const byPublicRev = [mk({}), mk({ public: true })];
    applySort(byPublicRev, 'public');
    expect(byPublicRev.map((e) => e.public)).toEqual([undefined, true]);

    const byHidden = [mk({ hidden: true }), mk({})];
    applySort(byHidden, 'hidden');
    expect(byHidden.map((e) => e.hidden)).toEqual([undefined, true]);
    const byHiddenRev = [mk({}), mk({ hidden: true })];
    applySort(byHiddenRev, 'hidden');
    expect(byHiddenRev.map((e) => e.hidden)).toEqual([undefined, true]);

    const byDeleted = [mk({ deletedAt: new Date(2000) }), mk({})];
    applySort(byDeleted, 'deletedAt');
    expect(byDeleted.map((e) => e.deletedAt?.getTime())).toEqual([undefined, 2000]);
    const byDeletedRev = [mk({}), mk({ deletedAt: new Date(2000) })];
    applySort(byDeletedRev, 'deletedAt');
    expect(byDeletedRev.map((e) => e.deletedAt?.getTime())).toEqual([undefined, 2000]);

    const byDeletedDesc = [mk({ deletedAt: new Date(1000) }), mk({ deletedAt: new Date(2000) })];
    applySort(byDeletedDesc, '-deletedAt');
    expect(byDeletedDesc.map((e) => e.deletedAt?.getTime())).toEqual([2000, 1000]);
  });
});
