import { createContextStore, envCtx, IRPCFile, withContext } from '@irpclib/irpc';
import { Transformer } from '@napi-rs/image';
import { describe, expect, it } from 'vitest';
import { implement } from '../src/constructor.js';
import { info, remove, upload } from '../src/index.js';
import { resize } from '../src/resize.js';
import type { ImageWorkerEnv, R2Bucket } from '../src/types.js';

async function createTestImage(width = 100, height = 100): Promise<Buffer> {
  const pixels = new Uint8Array(width * height * 4).fill(128);
  return Transformer.fromRgbaPixels(pixels, width, height).png();
}

function createMockBucket() {
  const store = new Map<string, { data: Uint8Array; options?: unknown }>();
  return {
    store,
    put: async (key: string, data: unknown, options?: unknown) => {
      let bytes: Uint8Array;
      if (data instanceof Uint8Array) bytes = data;
      else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
      else if (typeof (data as Blob)?.arrayBuffer === 'function') {
        bytes = new Uint8Array(await (data as Blob).arrayBuffer());
      } else {
        bytes = new Uint8Array(0);
      }
      store.set(key, { data: bytes, options });
      return { key, etag: 'mock-etag-123', size: bytes.byteLength } as never;
    },
    get: async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      return {
        key,
        etag: 'mock-etag-123',
        size: item.data.byteLength,
        uploaded: new Date(),
        httpMetadata: { contentType: 'image/png' },
      } as never;
    },
    head: async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      return {
        key,
        etag: 'mock-etag-123',
        size: item.data.byteLength,
        uploaded: new Date(),
        httpMetadata: { contentType: 'image/png' },
      } as never;
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (options?: { prefix?: string }) => {
      const prefix = options?.prefix || '';
      const objects = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({ key: k, size: store.get(k)!.data.byteLength, etag: 'mock-etag-123' }));
      return { objects, truncated: false } as never;
    },
  };
}

describe('constructor implement() & workflow', () => {
  it('executes upload workflow, saving original and client variants with step tracking', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const mockEnv: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      envCtx.set(mockEnv);
      implement({ variantPrefix: '.variants/' });

      const rawBuffer = await createTestImage(100, 100);
      const blob = new Blob([rawBuffer as BlobPart], { type: 'image/png' });
      const originalFile = new IRPCFile({ name: 'avatar.png', size: blob.size, type: 'image/png' }, blob);

      // Generate client variant
      const variantFile = await resize(originalFile, { width: 50, height: 50, format: 'webp' });

      const stream = upload('avatars/avatar.png', originalFile, {
        variants: [{ file: variantFile, width: 50, height: 50, format: 'webp' }],
      });

      const result = await stream;

      expect(result).toBeDefined();
      expect(result?.step).toBe('complete');
      expect(result?.path).toBe('/avatars/avatar.png');
      expect(mockBucket.store.has('avatars/avatar.png')).toBe(true);
      expect(mockBucket.store.has('.variants/avatars/avatar.png/w_50_h_50.webp')).toBe(true);
    });
  });

  it('retrieves image metadata via info and removes image via remove', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const mockEnv: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      envCtx.set(mockEnv);
      implement({ variantPrefix: '.variants/' });

      await mockBucket.put('test/image.png', new Uint8Array([1, 2, 3]));

      const metadata = await info('test/image.png');
      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('/test/image.png');

      const deleted = await remove('test/image.png');
      expect(deleted).toBe(true);
      expect(mockBucket.store.has('test/image.png')).toBe(false);
    });
  });
});
