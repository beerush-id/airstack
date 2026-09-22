import { createContextStore, IRPCFile, setContext, withContext } from '@irpclib/irpc';
import { Transformer } from '@napi-rs/image';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { implement } from '../src/constructor.js';
import { configure, remove, resize, transport, upload, url } from '../src/index.js';
import { handleImageDelivery } from '../src/lib/delivery.js';
import { resizeImage, resolveBucket, resolveResizer } from '../src/lib/resizer.js';
import { deleteImage, deleteVariants, getImageMetadata, getVariantKey, putVariant } from '../src/lib/storage.js';
import type { DurableObjectNamespace, Fetcher, ImageWorkerEnv, R2Bucket, Resize } from '../src/types.js';
import { formatImageUrl, parseImageRequest } from '../src/utils/request.js';
import { handleCorsPreflight, isOriginAllowed, isSizeAllowed } from '../src/utils/security.js';
import { createWorker } from '../src/worker.js';

async function createTestImage(width = 50, height = 50): Promise<Uint8Array> {
  const pixels = new Uint8Array(width * height * 4).fill(128);
  return new Uint8Array(await Transformer.fromRgbaPixels(pixels, width, height).png());
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
        httpEtag: 'W/"mock-etag-123"',
        size: item.data.byteLength,
        uploaded: new Date(),
        httpMetadata: {
          contentType:
            (item.options as { httpMetadata?: { contentType?: string } })?.httpMetadata?.contentType || 'image/png',
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(item.data);
            controller.close();
          },
        }),
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
        httpMetadata: {
          contentType:
            (item.options as { httpMetadata?: { contentType?: string } })?.httpMetadata?.contentType || 'image/png',
        },
      } as never;
    },
    delete: async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((k) => store.delete(k));
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

describe('Coverage: Edge Cases & Boundary Handling', () => {
  beforeEach(() => {
    const mockCacheStore = new Map<string, Response>();
    const mockCache = {
      match: async (req: Request) => {
        const url = req.url;
        const res = mockCacheStore.get(url);
        return res ? res.clone() : undefined;
      },
      put: async (req: Request, res: Response) => {
        mockCacheStore.set(req.url, res.clone());
      },
    };
    (globalThis as unknown as { caches: { default: unknown } }).caches = { default: mockCache };
  });

  describe('configure & url edge cases', () => {
    it('strips trailing slashes from configured baseUrl', () => {
      configure({ baseUrl: 'https://cdn.example.com///' });
      expect(url('photos/vacation.png')).toBe('https://cdn.example.com/photos/vacation.png');
    });

    it('handles configure with only apiKey', () => {
      configure({ apiKey: 'standalone-api-key' });
      expect(url('avatar.png')).toBeDefined();
    });
  });

  describe('resize() source types and format options', () => {
    it('handles avif format rendering', async () => {
      const rawImage = await createTestImage(20, 20);
      const result = await resize(rawImage, { width: 10, height: 10, format: 'avif', quality: 75 });
      expect(result.meta.type).toBe('image/avif');
      expect(result.data.size).toBeGreaterThan(0);
    });

    it('handles Blob source input with and without name', async () => {
      const rawImage = await createTestImage(20, 20);
      const blob = new Blob([rawImage as BlobPart], { type: 'image/png' });
      const namedBlob = Object.assign(blob, { name: 'custom.png' });

      const namedResult = await resize(namedBlob, { width: 10 });
      expect(namedResult.meta.name).toBe('custom.webp');

      const plainBlob = new Blob([rawImage as BlobPart], { type: 'image/png' });
      const plainResult = await resize(plainBlob, { width: 10 });
      expect(plainResult.meta.name).toBe('image.webp');
    });

    it('handles ArrayBuffer source input', async () => {
      const rawImage = await createTestImage(20, 20);
      const result = await resize(rawImage.buffer as ArrayBuffer, { width: 10 });
      expect(result.meta.type).toBe('image/webp');
    });

    it('rejects invalid source types', async () => {
      await expect(resize('not-a-valid-source' as never, { width: 10 })).rejects.toThrow(
        'Invalid image source type provided for resize'
      );
    });

    it('rejects images exceeding 64 MP resolution limit', async () => {
      const rawImage = await createTestImage(10, 10);
      vi.spyOn(Transformer.prototype, 'metadata').mockResolvedValueOnce({
        width: 10000,
        height: 10000,
      } as never);

      await expect(resize(rawImage, { width: 50 })).rejects.toThrow(
        'Image resolution exceeds maximum allowable limits (64 MP)'
      );
    });
  });

  describe('worker HTTP methods & routing', () => {
    it('routes requests at the IRPC endpoint to the router', async () => {
      const worker = createWorker();
      const mockBucket = createMockBucket();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      const res = await worker.fetch(new Request('http://localhost/irpc', { method: 'POST' }), env);
      expect(res.status).toBeDefined();
    });

    it('returns 405 Method Not Allowed for unsupported HTTP verbs', async () => {
      const worker = createWorker();
      const mockBucket = createMockBucket();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      const res = await worker.fetch(new Request('http://localhost/photos/pic.png', { method: 'POST' }), env);
      expect(res.status).toBe(405);
    });

    it('passes onDemand: false through worker to reject uncached variants', async () => {
      const worker = createWorker({ onDemand: false });
      const mockBucket = createMockBucket();
      const rawImage = await createTestImage(30, 30);
      mockBucket.store.set('hero.png', { data: rawImage });
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      const res = await worker.fetch(new Request('http://localhost/hero.png?w=200'), env);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Image not found');
    });
  });

  describe('delivery pipeline error handling and R2 variant hits', () => {
    it('returns 404 if request path is empty or root', async () => {
      const mockBucket = createMockBucket();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      const res = await handleImageDelivery(new Request('http://localhost/'), new URL('http://localhost/'), env, {
        variantPrefix: '.variants/',
        browserTtl: 3600,
        edgeTtl: 7200,
      });
      expect(res.status).toBe(404);
    });

    it('returns 404 when transformed variant is requested but original image does not exist', async () => {
      const mockBucket = createMockBucket();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      const res = await handleImageDelivery(
        new Request('http://localhost/missing.png?w=50'),
        new URL('http://localhost/missing.png?w=50'),
        env,

        { variantPrefix: '.variants/', browserTtl: 3600, edgeTtl: 7200 }
      );
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Image not found');
    });

    it('returns 404 when onDemand is false and variant is not cached in R2', async () => {
      const mockBucket = createMockBucket();
      const rawImage = await createTestImage(30, 30);
      mockBucket.store.set('hero.png', { data: rawImage });

      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      const res = await handleImageDelivery(
        new Request('http://localhost/hero.png?w=200'),
        new URL('http://localhost/hero.png?w=200'),
        env,
        { variantPrefix: '.variants/', browserTtl: 3600, edgeTtl: 7200, onDemand: false }
      );
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Image not found');
    });

    it('serves pre-rendered variant directly from R2 when Edge cache misses', async () => {
      const mockBucket = createMockBucket();
      const rawImage = await createTestImage(30, 30);
      mockBucket.store.set('hero.png', { data: rawImage });
      mockBucket.store.set('.variants/hero.png/w_100.webp', {
        data: rawImage,
        options: { httpMetadata: { contentType: 'image/webp' } },
      });

      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: 'http://localhost:8080',
      };

      // Request variant with fresh URL that bypasses in-memory mockCache
      const res = await handleImageDelivery(
        new Request('http://localhost/hero.png?w=100&nocache=1'),
        new URL('http://localhost/hero.png?w=100&nocache=1'),
        env,
        { variantPrefix: '.variants/', browserTtl: 3600, edgeTtl: 7200 }
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/webp');
    });

    it('returns 500 when resizer container throws an error', async () => {
      const mockBucket = createMockBucket();
      const rawImage = await createTestImage(30, 30);
      mockBucket.store.set('broken.png', { data: rawImage });

      const failingResizer: Fetcher = {
        fetch: async () => new Response('Internal Container Crash', { status: 502 }),
      };

      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: failingResizer,
      };

      const res = await handleImageDelivery(
        new Request('http://localhost/broken.png?w=50'),
        new URL('http://localhost/broken.png?w=50'),
        env,
        { variantPrefix: '.variants/', browserTtl: 3600, edgeTtl: 7200 }
      );
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('Internal Server Error');
    });
  });

  describe('resizer container dispatch & resolvers', () => {
    const createByteStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

    it('dispatches to DurableObjectNamespace stub', async () => {
      const mockStub = {
        fetch: async () => new Response(new Uint8Array([9, 9, 9]), { status: 200 }),
      };
      const mockDO: DurableObjectNamespace = {
        idFromName: () => ({ toString: () => 'do-id-123' }),
        idFromString: () => ({ toString: () => 'do-id-123' }),
        newUniqueId: () => ({ toString: () => 'do-id-123' }),
        get: () => mockStub as never,
      };

      const res = await resizeImage(mockDO, createByteStream(), { width: 50 });
      expect(res.status).toBe(200);
    });

    it('dispatches to HTTP URL string endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array([8, 8, 8]), { status: 200 }) as never
      );
      const res = await resizeImage('http://localhost:8080', createByteStream(), { width: 50 });
      expect(res.status).toBe(200);
    });

    it('dispatches with all transformation parameters', async () => {
      const mockFetcher: Fetcher = {
        fetch: async (req) => {
          expect(String(req)).toContain('w=50&h=50&f=webp&q=80&fit=cover');
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        },
      };

      const res = await resizeImage(mockFetcher, createByteStream(), {
        width: 50,
        height: 50,
        format: 'webp',
        quality: 80,
        fit: 'cover',
      });
      expect(res.status).toBe(200);
    });

    it('throws error when resizer container returns error response', async () => {
      const failingFetcher: Fetcher = {
        fetch: async () => new Response('Out of memory', { status: 500, statusText: 'OOM' }),
      };

      await expect(resizeImage(failingFetcher, createByteStream(), { width: 100 })).rejects.toThrow(
        'Image resize failed (500): Out of memory'
      );
    });

    it('throws error for invalid resizer type', async () => {
      await expect(resizeImage(12345 as never, createByteStream(), { width: 100 })).rejects.toThrow(
        'Invalid resizer configuration'
      );
    });

    it('resolves bucket and resizer using custom functions and keyof bindings', () => {
      const mockBucket = createMockBucket();
      const mockCustomBucket = createMockBucket();
      const env = {
        IMAGES: mockBucket as unknown as R2Bucket,
        CUSTOM_BUCKET: mockCustomBucket as unknown as R2Bucket,
        RESIZER: 'http://default-resizer',
        CUSTOM_RESIZER: 'http://custom-resizer',
      };

      // Function resolvers
      expect(resolveBucket(env, (e) => e.CUSTOM_BUCKET)).toBe(mockCustomBucket);
      expect(resolveResizer(env, (e) => e.CUSTOM_RESIZER)).toBe('http://custom-resizer');

      // Key resolvers
      expect(resolveBucket(env, 'CUSTOM_BUCKET')).toBe(mockCustomBucket);
      expect(resolveResizer(env, 'CUSTOM_RESIZER')).toBe('http://custom-resizer');

      // Defaults
      expect(resolveBucket(env)).toBe(mockBucket);
      expect(resolveResizer(env)).toBe('http://default-resizer');
    });
  });

  describe('security & origin whitelist edge cases', () => {
    it('allows requests matching whitelisted Referer origin', () => {
      const req = new Request('http://localhost/image.png', {
        headers: { referer: 'https://app.example.com/dashboard/feed' },
      });
      expect(isOriginAllowed(req, 'https://app.example.com')).toBe(true);
    });

    it('allows direct address bar navigation with Sec-Fetch-Site: none', () => {
      const req = new Request('http://localhost/image.png', {
        headers: { 'sec-fetch-site': 'none' },
      });
      expect(isOriginAllowed(req, 'https://app.example.com')).toBe(true);
    });

    it('safely handles malformed Referer headers', () => {
      const req = new Request('http://localhost/image.png', {
        headers: { referer: 'not a valid url' },
      });
      expect(isOriginAllowed(req, 'https://app.example.com')).toBe(false);
    });

    it('rejects requests from non-whitelisted Referer origin', () => {
      const req = new Request('http://localhost/image.png', {
        headers: { referer: 'https://unauthorized.com/page' },
      });
      expect(isOriginAllowed(req, 'https://app.example.com')).toBe(false);
    });

    it('handles CORS preflight without origin header defaulting to *', () => {
      const res = handleCorsPreflight(new Request('http://localhost', { method: 'OPTIONS' }));
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('validates allowedSizes with numbers, objects, and empty filters', () => {
      // Empty or undefined allows all
      expect(isSizeAllowed({ width: 500 })).toBe(true);
      expect(isSizeAllowed({ width: 500 }, [])).toBe(true);

      // Number whitelist matching size, width, or height
      expect(isSizeAllowed({ size: 320 }, [320, 640])).toBe(true);
      expect(isSizeAllowed({ width: 320 }, [320, 640])).toBe(true);
      expect(isSizeAllowed({ height: 640 }, [320, 640])).toBe(true);
      expect(isSizeAllowed({ width: 500 }, [320, 640])).toBe(false);
      expect(isSizeAllowed({ size: 500 }, [320, 640])).toBe(false);

      // Preset object matching
      const allowedPresets = [
        { name: 'avatar', width: 128, height: 128, format: 'webp' },
        { size: 512 },
        { width: 300 },
      ];
      expect(isSizeAllowed({ name: 'avatar', width: 128, height: 128, format: 'webp' }, allowedPresets)).toBe(true);
      expect(isSizeAllowed({ name: 'avatar', width: 128, height: 128, format: 'png' }, allowedPresets)).toBe(false);
      expect(isSizeAllowed({ name: 'other', width: 128, height: 128, format: 'webp' }, allowedPresets)).toBe(false);
      expect(isSizeAllowed({ size: 512 }, allowedPresets)).toBe(true);
      expect(isSizeAllowed({ size: 256 }, allowedPresets)).toBe(false);
      expect(isSizeAllowed({ width: 300 }, allowedPresets)).toBe(true);
      expect(isSizeAllowed({ width: 400 }, allowedPresets)).toBe(false);

      // Non-matching type / null fallback
      expect(isSizeAllowed({ width: 100 }, ['invalid' as unknown as number, null as unknown as number])).toBe(false);
    });
  });

  describe('storage & query parsing edge cases', () => {
    it('generates variant keys with fit options and custom prefixes without trailing slash', () => {
      const key = getVariantKey('path/to/img.png', { width: 100, fit: 'cover' }, '.variants');
      expect(key).toBe('.variants/path/to/img.png/w_100_fit_cover.webp');

      const sizeKey = getVariantKey('img.png', { size: 512 });
      expect(sizeKey).toBe('img.png-s_512.webp');

      const originalKey = getVariantKey('img.png', {});
      expect(originalKey).toBe('img.png-original.webp');
    });

    it('parses image requests with fit, quality boundaries, and jpg format', () => {
      const url = new URL('http://localhost/photo.png?w=200&h=100&f=jpg&q=95&fit=cover');
      const parsed = parseImageRequest(url);

      expect(parsed.transforms.format).toBe('jpeg');
      expect(parsed.transforms.quality).toBe(95);
      expect(parsed.transforms.fit).toBe('cover');

      const parsedS = parseImageRequest(new URL('http://localhost/photo.png?s=512'));
      expect(parsedS.transforms.size).toBe(512);

      const parsedSize = parseImageRequest(new URL('http://localhost/photo.png?size=1024'));
      expect(parsedSize.transforms.size).toBe(1024);

      // Boundary quality > 100 or <= 0 ignored
      const invalidQuality = parseImageRequest(new URL('http://localhost/photo.png?q=150'));
      expect(invalidQuality.transforms.quality).toBeUndefined();
    });

    it('formats clean URL without transformation options', () => {
      expect(formatImageUrl('photos/dog.png')).toBe('/photos/dog.png');
      expect(formatImageUrl('photos/dog.png', { size: 512 })).toBe('/photos/dog.png?s=512');
      expect(formatImageUrl('photos/dog.png', { width: 100, fit: 'cover' })).toBe('/photos/dog.png?w=100&fit=cover');
    });

    it('persists variant without original ETag', async () => {
      const mockBucket = createMockBucket();
      await putVariant(mockBucket, 'test-key.webp', new Uint8Array([1]) as never, 'image/webp');
      expect(mockBucket.store.has('test-key.webp')).toBe(true);
    });

    it('formats quality and dimensions in variant key', () => {
      const key = getVariantKey('avatar.png', { width: 80, height: 80, quality: 75 });
      expect(key).toBe('avatar.png-w_80_h_80_q_75.webp');

      const customKey = getVariantKey('avatar.png', { width: 80, height: 80, quality: 75 }, '.variants');
      expect(customKey).toBe('.variants/avatar.png/w_80_h_80_q_75.webp');
    });

    it('returns undefined when image metadata object is missing', async () => {
      const mockBucket = createMockBucket();
      const meta = await getImageMetadata(mockBucket as unknown as R2Bucket, 'non-existent.png');
      expect(meta).toBeUndefined();
    });

    it('purges variants with default prefix using deleteVariants', async () => {
      const mockBucket = createMockBucket();
      mockBucket.store.set('test.png-thumb.webp', { data: new Uint8Array([1]) });
      await deleteVariants(mockBucket as unknown as R2Bucket, 'test.png');
      expect(mockBucket.store.has('test.png-thumb.webp')).toBe(false);

      // Custom prefix purge
      mockBucket.store.set('.variants/test.png/thumb.webp', { data: new Uint8Array([1]) });
      await deleteVariants(mockBucket as unknown as R2Bucket, 'test.png', '.variants');
      expect(mockBucket.store.has('.variants/test.png/thumb.webp')).toBe(false);
    });

    it('purges variants across multiple truncated pages during deleteImage', async () => {
      const store = new Map<string, { data: Uint8Array }>();
      store.set('pic.png', { data: new Uint8Array([1]) });
      store.set('.variants/pic.png/w_100.webp', { data: new Uint8Array([1]) });
      store.set('.variants/pic.png/w_200.webp', { data: new Uint8Array([1]) });

      let callCount = 0;
      const paginatedBucket = {
        delete: async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          arr.forEach((k) => store.delete(k));
        },
        list: async () => {
          callCount++;
          if (callCount === 1) {
            return { objects: [{ key: '.variants/pic.png/w_100.webp' }], truncated: true, cursor: 'page-2' };
          }
          return { objects: [{ key: '.variants/pic.png/w_200.webp' }], truncated: false };
        },
      };

      await deleteImage(paginatedBucket as never, 'pic.png');
      expect(callCount).toBe(2);
      expect(store.has('pic.png')).toBe(false);
    });
  });

  describe('constructor context validation & error handling', () => {
    it('throws descriptive error when worker env is missing from context', async () => {
      await withContext(createContextStore(), async () => {
        await expect(remove('any.png')).rejects.toThrow('Worker environment context is missing');
      });
    });

    it('rejects upload stream when file reading fails', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: 'http://localhost:8080',
        };
        setContext('env', env);
        createWorker();

        const brokenFile = new IRPCFile({ name: 'broken.png', size: 10, type: 'image/png' }, {
          arrayBuffer: () => Promise.reject(new Error('Corrupt file stream')),
        } as never);

        const stream = upload('/', brokenFile);
        await stream;
        expect(stream.error).toBeDefined();
      });
    });
    it('handles implement with string prefix and undefined options', () => {
      expect(() => implement('custom-prefix/')).not.toThrow();
      expect(() => implement()).not.toThrow();
    });

    it('uploads to explicit filepath or folder preserving name or defaulting to uuid', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        const rawImage = await createTestImage(10, 10);
        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: 'http://localhost:8080',
        };
        setContext('env', env);
        createWorker();

        const namedFile = new IRPCFile(
          { name: 'photo.png', size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );

        // 1. Explicit filepath
        const resFile = (await upload('custom/fixed.png', namedFile)) as { path?: string };
        expect(resFile.path).toBe('/custom/fixed.png');

        // 2. Folder path preserving file name
        const resFolder = (await upload('gallery', namedFile)) as { path?: string };
        expect(resFolder.path).toBe('/gallery/photo.png');

        // 3. Root folder preserving file name
        const resRoot = (await upload('/', namedFile)) as { path?: string };
        expect(resRoot.path).toBe('/photo.png');

        // 4. Folder path with unnamed file defaulting to uuid
        const unnamedFile = new IRPCFile(
          { size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );
        const resUnnamed = (await upload('uploads', unnamedFile)) as { path?: string };
        expect(resUnnamed.path).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
        expect(mockBucket.store.has(resUnnamed.path!.replace(/^\/+/, ''))).toBe(true);

        // 5. Root folder with unnamed file defaulting to uuid
        const resRootUnnamed = (await upload('/', unnamedFile)) as { path?: string };
        expect(resRootUnnamed.path).toMatch(/^\/[0-9a-f-]{36}\.png$/);

        // 6. File without name and type remains as-is UUID
        const noTypeFile = new IRPCFile({ size: rawImage.byteLength, type: '' }, new Blob([rawImage as BlobPart]));
        const resNoType = (await upload('/', noTypeFile)) as { path?: string };
        expect(resNoType.path).toMatch(/^\/[0-9a-f-]{36}$/);
      });
    });

    it('formats resize labels for single dimension variants', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        const rawImage = await createTestImage(10, 10);
        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: {
            fetch: async () => new Response(rawImage as never, { headers: { 'content-type': 'image/webp' } }),
          },
        };
        setContext('env', env);
        createWorker();

        const file = new IRPCFile(
          { name: 'sample.png', size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );

        const stream = upload('/', file, {
          sizes: [{ width: 50 }, { height: 50 }, { size: 50 }],
        });
        const result = (await stream) as { step?: string };
        expect(result.step).toBe('complete');
      });
    });
  });

  describe('allowedSizes & sizes guardrails', () => {
    it('supports sizes in createWorker and skips disallowed variants on upload', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        const rawImage = await createTestImage(20, 20);
        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: {
            fetch: async () => new Response(rawImage as never, { headers: { 'content-type': 'image/webp' } }),
          },
        };
        setContext('env', env);

        // Worker configured with sizes alias and allowedSizes whitelist
        createWorker({
          sizes: [{ width: 80 }, { width: 999 }],
          allowedSizes: [80],
        });

        const file = new IRPCFile(
          { name: 'pic.png', size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );

        await upload('/gallery', file);

        // Only allowed width 80 variant should exist; width 999 should be skipped
        expect(mockBucket.store.has('gallery/pic.png')).toBe(true);
        expect(mockBucket.store.has('gallery/pic.png-w_80.webp')).toBe(true);
        expect(mockBucket.store.has('gallery/pic.png-w_999.webp')).toBe(false);
      });
    });

    it('skips client variants that are not in allowedSizes', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        const rawImage = await createTestImage(20, 20);
        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: {
            fetch: async () => new Response(rawImage as never, { headers: { 'content-type': 'image/webp' } }),
          },
        };
        setContext('env', env);

        createWorker({
          allowedSizes: [{ name: 'thumb', width: 64, height: 64 }],
        });

        const original = new IRPCFile(
          { name: 'item.png', size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );
        const thumbFile = new IRPCFile(
          { name: 'item-thumb.webp', size: 100, type: 'image/webp' },
          new Blob([rawImage as BlobPart])
        );
        const hugeFile = new IRPCFile(
          { name: 'item-huge.webp', size: 500, type: 'image/webp' },
          new Blob([rawImage as BlobPart])
        );

        await upload('/items', original, {
          variants: [
            { name: 'thumb', width: 64, height: 64, file: thumbFile },
            { name: 'huge', width: 4000, height: 4000, file: hugeFile },
          ],
        });

        expect(mockBucket.store.has('items/item.png')).toBe(true);
        expect(mockBucket.store.has('items/item.png-thumb.webp')).toBe(true);
        expect(mockBucket.store.has('items/item.png-huge.webp')).toBe(false);
      });
    });

    it('skips on-demand transform and serves original image when size is not allowed', async () => {
      const mockBucket = createMockBucket();
      const rawImage = await createTestImage(20, 20);
      await mockBucket.put('photo.png', rawImage, {
        httpMetadata: { contentType: 'image/png' },
      });

      let resizerCalled = false;
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: {
          fetch: async () => {
            resizerCalled = true;
            return new Response(rawImage as never, { headers: { 'content-type': 'image/webp' } });
          },
        },
      };

      // 1. Request with disallowed size -> skips transform, serves original image, container not called
      const disallowedReq = new Request('http://localhost/photo.png?w=9999');
      const disallowedRes = await handleImageDelivery(
        disallowedReq,
        new URL('http://localhost/photo.png?w=9999'),
        env,
        {
          allowedSizes: [320, 640],
          browserTtl: 86400,
          edgeTtl: 2592000,
        }
      );

      expect(disallowedRes.status).toBe(200);
      expect(disallowedRes.headers.get('content-type')).toBe('image/png');
      expect(resizerCalled).toBe(false);
      expect(mockBucket.store.has('photo.png-w_9999.webp')).toBe(false);

      // 2. Request with allowed size -> invokes resizer and caches variant
      const allowedReq = new Request('http://localhost/photo.png?w=320');
      const allowedRes = await handleImageDelivery(allowedReq, new URL('http://localhost/photo.png?w=320'), env, {
        allowedSizes: [320, 640],
        browserTtl: 86400,
        edgeTtl: 2592000,
      });

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.headers.get('content-type')).toBe('image/webp');
      expect(resizerCalled).toBe(true);
      expect(mockBucket.store.has('photo.png-w_320.webp')).toBe(true);
    });

    it('handles realistic pattern with named sizes presets and numeric allowedSizes whitelist', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        const rawImage = await createTestImage(50, 50);
        let lastResizedOptions: Resize | undefined;
        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: {
            fetch: async (req: Request | string) => {
              const url = new URL(typeof req === 'string' ? req : req.url);
              lastResizedOptions = {
                width: url.searchParams.get('w') ? parseInt(url.searchParams.get('w')!, 10) : undefined,
                height: url.searchParams.get('h') ? parseInt(url.searchParams.get('h')!, 10) : undefined,
              };
              return new Response(rawImage as never, { headers: { 'content-type': 'image/webp' } });
            },
          },
        };
        setContext('env', env);

        const worker = createWorker({
          sizes: [
            { name: 'preview', width: 1024, height: 1024 },
            { name: 'thumbnail', width: 256, height: 256 },
          ],
          allowedSizes: [128, 256, 512, 1024, 2048],
        });

        // 1. Upload creates both 'preview' and 'thumbnail' variants automatically
        const file = new IRPCFile(
          { name: 'banner.png', size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );
        await upload('/posts', file);

        expect(mockBucket.store.has('posts/banner.png')).toBe(true);
        expect(mockBucket.store.has('posts/banner.png-preview.webp')).toBe(true);
        expect(mockBucket.store.has('posts/banner.png-thumbnail.webp')).toBe(true);

        // 2. On-demand GET with ?name=thumbnail resolves preset and serves cached variant
        const nameReq = new Request('https://cdn.example.com/posts/banner.png?name=thumbnail');
        const nameRes = await worker.fetch(nameReq, env);
        expect(nameRes.status).toBe(200);

        // 3. On-demand GET with ?w=512 is in allowedSizes -> invokes resizer and returns webp
        const allowedReq = new Request('https://cdn.example.com/posts/banner.png?w=512');
        const allowedRes = await worker.fetch(allowedReq, env);
        expect(allowedRes.status).toBe(200);
        expect(allowedRes.headers.get('content-type')).toBe('image/webp');
        expect(lastResizedOptions?.width).toBe(512);

        // 4. On-demand GET with ?w=333 is NOT in allowedSizes -> skips transform, serves original image
        const disallowedReq = new Request('https://cdn.example.com/posts/banner.png?w=333');
        const disallowedRes = await worker.fetch(disallowedReq, env);
        expect(disallowedRes.status).toBe(200);
        expect(disallowedRes.headers.get('content-type')).toBe('image/png');

        // 5. On-demand GET with unknown preset name -> preset not found, size not in allowedSizes -> serves original
        const unknownNameReq = new Request('https://cdn.example.com/posts/banner.png?name=unknown');
        const unknownNameRes = await worker.fetch(unknownNameReq, env);
        expect(unknownNameRes.status).toBe(200);
        expect(unknownNameRes.headers.get('content-type')).toBe('image/png');
      });
    });

    it('supports custom IRPC endpoint path for embedding in full-stack apps', async () => {
      configure({ endpoint: '/r2-image-irpc' });
      expect(transport.endpoint).toBe('/r2-image-irpc');

      const customWorker = createWorker({ endpoint: '/r2-image-irpc' });
      const env = {
        IMAGES: createMockBucket() as unknown as R2Bucket,
        RESIZER: { fetch: async () => new Response() },
      };

      // POST to the custom endpoint should be handled by the router (not 405)
      const res = await customWorker.fetch(new Request('http://localhost/r2-image-irpc', { method: 'POST' }), env);
      expect(res.status).not.toBe(405);

      // Reset endpoint
      configure({ endpoint: '/irpc' });
      expect(transport.endpoint).toBe('/irpc');
    });
  });
});
