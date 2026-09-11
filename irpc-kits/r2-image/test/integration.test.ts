import {
  createContextStore,
  createCredentials,
  IRPC_BASE_CONTEXT,
  IRPCFile,
  setContext,
  withContext,
} from '@irpclib/irpc';
import { Transformer } from '@napi-rs/image';
import { beforeEach, describe, expect, it } from 'vitest';
import { handler as containerHandler } from '../src/container.js';
import { configure, info, remove, resize, upload, url } from '../src/index.js';
import type {
  DurableObjectNamespace,
  ExecutionContext,
  Fetcher,
  ImageUploadState,
  ImageWorkerEnv,
  R2Bucket,
  R2Objects,
} from '../src/types.js';
import { createWorker } from '../src/worker.js';

async function createTestImage(width = 100, height = 100, color = 128): Promise<Uint8Array> {
  const pixels = new Uint8Array(width * height * 4).fill(color);
  return new Uint8Array(await Transformer.fromRgbaPixels(pixels, width, height).png());
}

function createMockBucket() {
  const store = new Map<string, { data: Uint8Array; options?: unknown; uploaded?: Date }>();
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
      const uploaded = new Date();
      store.set(key, { data: bytes, options, uploaded });
      return { key, etag: 'mock-etag-123', size: bytes.byteLength } as never;
    },
    get: async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      if (!item.uploaded) item.uploaded = new Date();
      return {
        key,
        etag: 'mock-etag-123',
        httpEtag: 'mock-etag-123',
        size: item.data.byteLength,
        uploaded: item.uploaded,
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
      if (!item.uploaded) item.uploaded = new Date();
      return {
        key,
        etag: 'mock-etag-123',
        httpEtag: 'mock-etag-123',
        size: item.data.byteLength,
        uploaded: item.uploaded,
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
    list: async (options?: { prefix?: string }): Promise<R2Objects> => {
      const prefix = options?.prefix || '';
      const objects = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({
          key: k,
          size: store.get(k)!.data.byteLength,
          etag: 'mock-etag-123',
          version: '1',
          httpEtag: 'mock-etag-123',
          uploaded: new Date(),
        }));
      return { objects, truncated: false };
    },
  };
}

function createContainerResizer(): Fetcher {
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      return containerHandler(req);
    },
  } as Fetcher;
}

function createDurableObjectResizer(): DurableObjectNamespace {
  return {
    idFromName: () => ({ toString: () => 'default' }) as never,
    get: () =>
      ({
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const req = input instanceof Request ? input : new Request(input, init);
          return containerHandler(req);
        },
      }) as never,
  } as unknown as DurableObjectNamespace;
}

function createMockCache() {
  const store = new Map<string, Response>();
  return {
    match: async (request: Request | string) => {
      const key = typeof request === 'string' ? request : request.url;
      const cached = store.get(key);
      return cached ? cached.clone() : undefined;
    },
    put: async (request: Request | string, response: Response) => {
      const key = typeof request === 'string' ? request : request.url;
      store.set(key, response.clone());
    },
    delete: async (request: Request | string) => {
      const key = typeof request === 'string' ? request : request.url;
      return store.delete(key);
    },
  };
}

const mockCtx: ExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => promise,
  passThroughOnException: () => {},
};

describe('User Journey: Media Asset Lifecycle', () => {
  beforeEach(() => {
    configure({ baseUrl: '' });
    (globalThis as unknown as { caches: { default: unknown } }).caches = {
      default: createMockCache(),
    };
  });

  describe('Stage 1 — Ingestion: Uploading assets and preparing variants', () => {
    it('uploads user avatar with client-rendered preview thumbnail and tracks progress', async () => {
      await withContext(createContextStore(), async () => {
        const mockBucket = createMockBucket();
        createWorker({ variantPrefix: '.variants/' });

        const env: ImageWorkerEnv = {
          IMAGES: mockBucket as unknown as R2Bucket,
          RESIZER: createContainerResizer(),
        };
        setContext('env', env);

        const rawImage = await createTestImage(800, 800);
        const avatarFile = new IRPCFile(
          { name: 'avatar-user-42.png', size: rawImage.byteLength, type: 'image/png' },
          new Blob([rawImage as BlobPart])
        );

        const clientPreview = await resize(avatarFile, { width: 64, height: 64, format: 'webp' });

        const steps: string[] = [];
        const stream = upload('users/u_42/avatar.png', avatarFile, {
          variants: [{ file: clientPreview, width: 64, height: 64, format: 'webp' }],
        });

        stream.subscribe((state) => {
          if (state.data?.step && !steps.includes(state.data.step)) {
            steps.push(state.data.step);
          }
        });

        const result = (await stream) as ImageUploadState;

        expect(result.step).toBe('complete');
        expect(result.path).toBe('/users/u_42/avatar.png');
        expect(result.type).toBe('image/png');
        expect(result.size).toBe(rawImage.byteLength);

        expect(steps).toEqual(['original', 'variants', 'complete']);
        expect(mockBucket.store.has('users/u_42/avatar.png')).toBe(true);
        expect(mockBucket.store.has('.variants/users/u_42/avatar.png/w_64_h_64.webp')).toBe(true);
      });
    });

    it('uploads media with pre-rendered client variants, skipping server-side generation', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker({
        resize: [{ width: 200, height: 200, format: 'webp' }],
      });
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(400, 400);
      const file = new IRPCFile(
        { name: 'photo.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const clientThumb = await resize(file, { width: 50, height: 50, format: 'webp' });

      const steps: string[] = [];
      const stream = upload('gallery/photo.png', file, {
        variants: [{ file: clientThumb, width: 50, height: 50, format: 'webp' }],
        resize: [{ width: 300, height: 300, format: 'webp' }],
      });

      stream.subscribe((state) => {
        if (state.data?.step && !steps.includes(state.data.step)) {
          steps.push(state.data.step);
        }
      });

      await stream;

      expect(steps).toEqual(['original', 'variants', 'complete']);
      expect(mockBucket.store.has('gallery/photo.png-w_50_h_50.webp')).toBe(true);
      expect(mockBucket.store.has('gallery/photo.png-w_300_h_300.webp')).toBe(false);
      expect(mockBucket.store.has('gallery/photo.png-w_200_h_200.webp')).toBe(false);
    });
  });

  it('uploads media with custom resize dimensions specified at upload time', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker({
        resize: [{ width: 200, height: 200, format: 'webp' }],
      });
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(400, 400);
      const file = new IRPCFile(
        { name: 'banner.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const steps: string[] = [];
      const stream = upload('banners/banner.png', file, {
        resize: [{ width: 350, height: 350, format: 'webp' }],
      });

      stream.subscribe((state) => {
        if (state.data?.step && !steps.includes(state.data.step)) {
          steps.push(state.data.step);
        }
      });

      await stream;

      expect(steps).toEqual(['original', 'resize', 'complete']);
      expect(mockBucket.store.has('banners/banner.png-w_350_h_350.webp')).toBe(true);
      expect(mockBucket.store.has('banners/banner.png-w_200_h_200.webp')).toBe(false);
    });
  });

  it('uploads media using server default variant presets when no custom sizes are specified', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker({
        resize: [{ width: 150, height: 150, format: 'webp' }],
      });
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(400, 400);
      const file = new IRPCFile(
        { name: 'item.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const steps: string[] = [];
      const stream = upload('items/item.png', file);

      stream.subscribe((state) => {
        if (state.data?.step && !steps.includes(state.data.step)) {
          steps.push(state.data.step);
        }
      });

      await stream;

      expect(steps).toEqual(['original', 'resize', 'complete']);
      expect(mockBucket.store.has('items/item.png-w_150_h_150.webp')).toBe(true);
    });
  });

  it('uploads raw media as-is when no variants or resize presets are configured', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(400, 400);
      const file = new IRPCFile(
        { name: 'raw.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const steps: string[] = [];
      const stream = upload('raw/raw.png', file);

      stream.subscribe((state) => {
        if (state.data?.step && !steps.includes(state.data.step)) {
          steps.push(state.data.step);
        }
      });

      await stream;

      expect(steps).toEqual(['original', 'complete']);
      expect(mockBucket.store.has('raw/raw.png')).toBe(true);
      const listed = await mockBucket.list({ prefix: 'raw/raw.png-' });
      expect(listed.objects.length).toBe(0);
    });
  });

  it('uploads media generating multiple responsive breakpoint variants', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker({ variantPrefix: '.variants/' });

      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      };
      setContext('env', env);

      const rawImage = await createTestImage(800, 800);
      const avatarFile = new IRPCFile(
        { name: 'avatar-user-42.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const steps: string[] = [];
      const stream = upload('users/u_42/avatar.png', avatarFile, {
        resize: [
          { width: 256, height: 256, format: 'webp' },
          { width: 128, height: 128, format: 'webp' },
        ],
      });

      stream.subscribe((state) => {
        if (state.data?.step && !steps.includes(state.data.step)) {
          steps.push(state.data.step);
        }
      });

      const result = (await stream) as ImageUploadState;

      expect(result.step).toBe('complete');
      expect(result.path).toBe('/users/u_42/avatar.png');
      expect(steps).toEqual(['original', 'resize', 'complete']);
      expect(mockBucket.store.has('users/u_42/avatar.png')).toBe(true);
      expect(mockBucket.store.has('.variants/users/u_42/avatar.png/w_256_h_256.webp')).toBe(true);
      expect(mockBucket.store.has('.variants/users/u_42/avatar.png/w_128_h_128.webp')).toBe(true);
    });
  });

  it('generates named preset variants accessible by semantic alias', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const worker = createWorker();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      };
      setContext('env', env);

      const rawImage = await createTestImage(600, 400);
      const file = new IRPCFile(
        { name: 'product.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      await upload('catalog/product.png', file, {
        resize: [
          { name: 'thumbnail', width: 120, height: 120, format: 'webp' },
          { name: 'hero', width: 600, height: 300, fit: 'cover', format: 'webp' },
        ],
      });

      expect(mockBucket.store.has('catalog/product.png-thumbnail.webp')).toBe(true);
      expect(mockBucket.store.has('catalog/product.png-hero.webp')).toBe(true);

      const thumbUrl = url('/catalog/product.png', { name: 'thumbnail' });
      const thumbRes = await worker.fetch(new Request(`https://cdn.example.com${thumbUrl}`), env, mockCtx);
      expect(thumbRes.status).toBe(200);
      expect(thumbRes.headers.get('Content-Type')).toBe('image/webp');
    });
  });

  it('uploads client pre-rendered crop under a semantic preset name', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const worker = createWorker();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      };
      setContext('env', env);

      const rawImage = await createTestImage(400, 400);
      const file = new IRPCFile(
        { name: 'avatar.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const clientAvatar = await resize(file, { width: 80, height: 80, format: 'webp' });

      await upload('users/u_1/avatar.png', file, {
        variants: [{ name: 'avatar-sm', file: clientAvatar, format: 'webp' }],
      });

      expect(mockBucket.store.has('users/u_1/avatar.png-avatar-sm.webp')).toBe(true);

      const avatarUrl = url('/users/u_1/avatar.png', { name: 'avatar-sm' });
      const avatarRes = await worker.fetch(new Request(`https://cdn.example.com${avatarUrl}`), env, mockCtx);
      expect(avatarRes.status).toBe(200);
      expect(avatarRes.headers.get('Content-Type')).toBe('image/webp');
    });
  });

  it('generates blurred low-quality image placeholder (LQIP) variant', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const worker = createWorker();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      };
      setContext('env', env);

      const rawImage = await createTestImage(800, 600);
      const file = new IRPCFile(
        { name: 'landscape.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      await upload('gallery/landscape.png', file, {
        resize: [{ width: 32, height: 24, blur: 10, format: 'webp' }],
      });

      expect(mockBucket.store.has('gallery/landscape.png-w_32_h_24_b_10.webp')).toBe(true);

      const lqipUrl = url('/gallery/landscape.png', { width: 32, height: 24, blur: 10, format: 'webp' });
      const lqipRes = await worker.fetch(new Request(`https://cdn.example.com${lqipUrl}`), env, mockCtx);
      expect(lqipRes.status).toBe(200);
      expect(lqipRes.headers.get('Content-Type')).toBe('image/webp');
    });
  });

  it('generates named blurred placeholder for progressive image loading', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(400, 400);
      const file = new IRPCFile(
        { name: 'cover.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      await upload('blog/cover.png', file, {
        resize: [{ name: 'lqip', width: 20, height: 20, blur: 15, format: 'webp' }],
      });

      expect(mockBucket.store.has('blog/cover.png-lqip.webp')).toBe(true);
    });
  });

    it('pre-compresses high-resolution images in the client before upload', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(1200, 800);
      const rawFile = new IRPCFile(
        { name: 'photo-raw.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const optimized = await resize(rawFile, { width: 600, height: 400, quality: 75, format: 'webp' });
      expect(optimized.meta.type).toBe('image/webp');
      expect(optimized.meta.size).toBeLessThan(rawFile.meta.size);

      const result = (await upload('gallery/travel.webp', optimized)) as ImageUploadState;
      expect(result.path).toBe('/gallery/travel.webp');
      expect(result.type).toBe('image/webp');
      expect(mockBucket.store.has('gallery/travel.webp')).toBe(true);
    });
  });

  it('preserves original filename when uploading to a directory path', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(200, 200);
      const file = new IRPCFile(
        { name: 'team-lead.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const resA = (await upload('company/team', file)) as ImageUploadState;
      expect(resA.path).toBe('/company/team/team-lead.png');
      expect(mockBucket.store.has('company/team/team-lead.png')).toBe(true);

      const resB = (await upload('/company/team/', file)) as ImageUploadState;
      expect(resB.path).toBe('/company/team/team-lead.png');
    });
  });

  it('assigns unique identifier when unnamed media is uploaded to a directory', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(200, 200);
      const unnamedFile = new IRPCFile(
        { size: rawImage.byteLength, type: 'image/jpeg' },
        new Blob([rawImage as BlobPart])
      );

      const res = (await upload('uploads/temp', unnamedFile)) as ImageUploadState;
      expect(res.path).toMatch(/^\/uploads\/temp\/[0-9a-f-]{36}\.jpeg$/);
      expect(mockBucket.store.has(res.path!.replace(/^\/+/, ''))).toBe(true);
    });
  });

  it('saves media to explicit custom path regardless of client file name', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(200, 200);
      const namedFile = new IRPCFile(
        { name: 'IMG_9921_RAW.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      const res = (await upload('catalog/hero.png', namedFile)) as ImageUploadState;
      expect(res.path).toBe('/catalog/hero.png');
      expect(mockBucket.store.has('catalog/hero.png')).toBe(true);
    });
  });
  });

  describe('Stage 2 — Delivery: Serving optimized media across viewports', () => {
    it('delivers original asset with immutable edge caching headers and ETag', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker({ cache: { browserTtl: 86400, edgeTtl: 604800 } });
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(400, 300);
    mockBucket.store.set('docs/chart.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const req = new Request('https://cdn.example.com/docs/chart.png');
    const res = await worker.fetch(req, env, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400, s-maxage=604800, immutable');
    expect(res.headers.get('ETag')).toBe('mock-etag-123');

    const cache = (caches as unknown as { default: Cache }).default;
    const cached = await cache.match(req);
    expect(cached).toBeDefined();
    expect(cached?.status).toBe(200);
  });

  it('delivers pre-rendered responsive variants from storage', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker({ variantPrefix: '.variants/' });
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(800, 800);
    const thumb64 = await createTestImage(64, 64);
    const thumb256 = await createTestImage(256, 256);

    mockBucket.store.set('users/u_42/avatar.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });
    mockBucket.store.set('.variants/users/u_42/avatar.png/w_64_h_64.webp', {
      data: thumb64,
      options: { httpMetadata: { contentType: 'image/webp' } },
    });
    mockBucket.store.set('.variants/users/u_42/avatar.png/w_256_h_256.webp', {
      data: thumb256,
      options: { httpMetadata: { contentType: 'image/webp' } },
    });

    const origRes = await worker.fetch(new Request('https://cdn.example.com/users/u_42/avatar.png'), env, mockCtx);
    expect(origRes.status).toBe(200);
    expect(origRes.headers.get('Content-Type')).toBe('image/png');
    expect(origRes.headers.get('Cache-Control')).toContain('immutable');

    const url64 = url('/users/u_42/avatar.png', { width: 64, height: 64, format: 'webp' });
    const res64 = await worker.fetch(new Request(`https://cdn.example.com${url64}`), env, mockCtx);
    expect(res64.status).toBe(200);
    expect(res64.headers.get('Content-Type')).toBe('image/webp');

    const url256 = url('/users/u_42/avatar.png', { width: 256, height: 256, format: 'webp' });
    const res256 = await worker.fetch(new Request(`https://cdn.example.com${url256}`), env, mockCtx);
    expect(res256.status).toBe(200);
    expect(res256.headers.get('Content-Type')).toBe('image/webp');
  });

  it('delivers on-demand format conversions with quality optimization', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(1200, 800);
    mockBucket.store.set('products/shoes/sneaker.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const webpUrl = url('/products/shoes/sneaker.png', { width: 320, height: 213, format: 'webp', quality: 75 });
    const webpRes = await worker.fetch(new Request(`https://cdn.example.com${webpUrl}`), env, mockCtx);
    expect(webpRes.status).toBe(200);
    expect(webpRes.headers.get('Content-Type')).toBe('image/webp');

    expect(mockBucket.store.has('products/shoes/sneaker.png-w_320_h_213_q_75.webp')).toBe(true);

    const cachedWebpRes = await worker.fetch(new Request(`https://cdn.example.com${webpUrl}`), env, mockCtx);
    expect(cachedWebpRes.status).toBe(200);
    expect(cachedWebpRes.headers.get('Content-Type')).toBe('image/webp');

    const avifUrl = url('/products/shoes/sneaker.png', { width: 640, height: 426, format: 'avif', quality: 80 });
    const avifRes = await worker.fetch(new Request(`https://cdn.example.com${avifUrl}`), env, mockCtx);
    expect(avifRes.status).toBe(200);
    expect(avifRes.headers.get('Content-Type')).toBe('image/avif');
    expect(mockBucket.store.has('products/shoes/sneaker.png-w_640_h_426_q_80.avif')).toBe(true);
  });

  it('adapts media to container layouts using fit modes', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(800, 400);
    mockBucket.store.set('banners/hero.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const coverUrl = url('/banners/hero.png', { width: 200, height: 200, fit: 'cover' });
    const coverRes = await worker.fetch(new Request(`https://cdn.example.com${coverUrl}`), env, mockCtx);
    expect(coverRes.status).toBe(200);
    expect(mockBucket.store.has('banners/hero.png-w_200_h_200_fit_cover.webp')).toBe(true);

    const containUrl = url('/banners/hero.png', { width: 200, height: 200, fit: 'contain' });
    const containRes = await worker.fetch(new Request(`https://cdn.example.com${containUrl}`), env, mockCtx);
    expect(containRes.status).toBe(200);
    expect(mockBucket.store.has('banners/hero.png-w_200_h_200_fit_contain.webp')).toBe(true);

    const insideUrl = url('/banners/hero.png', { width: 300, height: 300, fit: 'inside' });
    const insideRes = await worker.fetch(new Request(`https://cdn.example.com${insideUrl}`), env, mockCtx);
    expect(insideRes.status).toBe(200);
    expect(mockBucket.store.has('banners/hero.png-w_300_h_300_fit_inside.webp')).toBe(true);
  });

  it('serves pre-generated variants while blocking dynamic transforms in lockdown mode', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker({ onDemand: false });
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(800, 600);
    const thumbImage = await createTestImage(200, 150);

    mockBucket.store.set('secure/article.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });
    mockBucket.store.set('secure/article.png-w_200_h_150.webp', {
      data: thumbImage,
      options: { httpMetadata: { contentType: 'image/webp' } },
    });

    const origRes = await worker.fetch(new Request('https://cdn.example.com/secure/article.png'), env, mockCtx);
    expect(origRes.status).toBe(200);

    const preRenderedUrl = url('/secure/article.png', { width: 200, height: 150, format: 'webp' });
    const preRenderedRes = await worker.fetch(new Request(`https://cdn.example.com${preRenderedUrl}`), env, mockCtx);
    expect(preRenderedRes.status).toBe(200);

    const dynamicUrl = url('/secure/article.png', { width: 500, height: 375, format: 'webp' });
    const dynamicRes = await worker.fetch(new Request(`https://cdn.example.com${dynamicUrl}`), env, mockCtx);
    expect(dynamicRes.status).toBe(404);
    expect(await dynamicRes.text()).toBe('Image not found');
  });
  });

  describe('Stage 3 — Mutation: Replacing media and invalidating caches', () => {
    it('replaces existing media, invalidating stale variants and eagerly generating new variants', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const worker = createWorker({
        onDemand: false,
        resize: [{ width: 100, height: 100, format: 'webp' }],
      });
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      };
      setContext('env', env);

      const redPixels = new Uint8Array(400 * 400 * 4);
      for (let i = 0; i < redPixels.length; i += 4) {
        redPixels[i] = 255;
        redPixels[i + 1] = 0;
        redPixels[i + 2] = 0;
        redPixels[i + 3] = 255;
      }
      const redBuffer = new Uint8Array(await Transformer.fromRgbaPixels(redPixels, 400, 400).png());
      const redFile = new IRPCFile(
        { name: 'profile.png', size: redBuffer.byteLength, type: 'image/png' },
        new Blob([redBuffer as BlobPart])
      );

      await upload('users/42/profile.png', redFile);

      expect(mockBucket.store.has('users/42/profile.png-w_100_h_100.webp')).toBe(true);
      const oldVariantBytes = mockBucket.store.get('users/42/profile.png-w_100_h_100.webp')!.data;

      const variantUrl = url('/users/42/profile.png', { width: 100, height: 100 });
      const initialRes = await worker.fetch(new Request(`https://cdn.example.com${variantUrl}`), env, mockCtx);
      expect(initialRes.status).toBe(200);

      const greenPixels = new Uint8Array(800 * 800 * 4);
      for (let i = 0; i < greenPixels.length; i += 4) {
        greenPixels[i] = 0;
        greenPixels[i + 1] = 255;
        greenPixels[i + 2] = 0;
        greenPixels[i + 3] = 255;
      }
      const greenBuffer = new Uint8Array(await Transformer.fromRgbaPixels(greenPixels, 800, 800).png());
      const greenFile = new IRPCFile(
        { name: 'profile.png', size: greenBuffer.byteLength, type: 'image/png' },
        new Blob([greenBuffer as BlobPart])
      );

      const updateResult = (await upload('users/42/profile.png', greenFile)) as ImageUploadState;
      expect(updateResult.path).toBe('/users/42/profile.png');
      expect(updateResult.size).toBe(greenBuffer.byteLength);

      expect(mockBucket.store.has('users/42/profile.png-w_100_h_100.webp')).toBe(true);
      const newVariantBytes = mockBucket.store.get('users/42/profile.png-w_100_h_100.webp')!.data;
      expect(newVariantBytes).not.toEqual(oldVariantBytes);

      (globalThis as unknown as { caches: { default: unknown } }).caches = {
        default: createMockCache(),
      };
      const updatedRes = await worker.fetch(new Request(`https://cdn.example.com${variantUrl}`), env, mockCtx);
      expect(updatedRes.status).toBe(200);

      const unconfiguredUrl = url('/users/42/profile.png', { width: 500, height: 500 });
      const unconfiguredRes = await worker.fetch(new Request(`https://cdn.example.com${unconfiguredUrl}`), env, mockCtx);
      expect(unconfiguredRes.status).toBe(404);
    });
  });

  it('replaces media uploaded to a directory path, refreshing all variants', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker({
        resize: [{ width: 100, height: 100, format: 'webp' }],
      });
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      };
      setContext('env', env);

      const rawA = await createTestImage(200, 200);
      const fileA = new IRPCFile({ name: 'logo.png', size: rawA.byteLength, type: 'image/png' }, new Blob([rawA as BlobPart]));

      await upload('assets', fileA);
      expect(mockBucket.store.has('assets/logo.png')).toBe(true);
      expect(mockBucket.store.has('assets/logo.png-w_100_h_100.webp')).toBe(true);
      const variantBytesA = mockBucket.store.get('assets/logo.png-w_100_h_100.webp')!.data;

      const rawB = await createTestImage(400, 400, 240);
      const fileB = new IRPCFile({ name: 'logo.png', size: rawB.byteLength, type: 'image/png' }, new Blob([rawB as BlobPart]));

      await upload('assets', fileB);

      expect(mockBucket.store.has('assets/logo.png')).toBe(true);
      expect(mockBucket.store.has('assets/logo.png-w_100_h_100.webp')).toBe(true);
      const variantBytesB = mockBucket.store.get('assets/logo.png-w_100_h_100.webp')!.data;
      expect(variantBytesB).not.toEqual(variantBytesA);
    });
  });

  it('replaces media with semantic named presets, purging old named variants', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawA = await createTestImage(400, 400);
      const fileA = new IRPCFile({ name: 'card.png', size: rawA.byteLength, type: 'image/png' }, new Blob([rawA as BlobPart]));

      await upload('content/card.png', fileA, {
        resize: [{ name: 'preview', width: 200, height: 200, format: 'webp' }],
      });
      expect(mockBucket.store.has('content/card.png-preview.webp')).toBe(true);

      const rawB = await createTestImage(500, 500);
      const fileB = new IRPCFile({ name: 'card.png', size: rawB.byteLength, type: 'image/png' }, new Blob([rawB as BlobPart]));

      await upload('content/card.png', fileB, {
        resize: [{ name: 'hero', width: 400, height: 200, format: 'webp' }],
      });

      expect(mockBucket.store.has('content/card.png-preview.webp')).toBe(false);
      expect(mockBucket.store.has('content/card.png-hero.webp')).toBe(true);
      expect(mockBucket.store.has('content/card.png')).toBe(true);
    });
  });
  });

  describe('Stage 4 — Teardown: Deleting media and storage cleanup', () => {
    it('retrieves asset metadata and dimensions for stored media', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(400, 300);
      mockBucket.store.set('reports/finance-q4.png', {
        data: rawImage,
        options: { httpMetadata: { contentType: 'image/png' } },
      });

      const metaA = await info('reports/finance-q4.png');
      const metaB = await info('/reports/finance-q4.png');

      expect(metaA).toBeDefined();
      expect(metaA?.path).toBe('/reports/finance-q4.png');
      expect(metaA?.type).toBe('image/png');
      expect(metaA?.size).toBe(rawImage.byteLength);
      expect(metaA?.etag).toBe('mock-etag-123');
      expect(typeof metaA?.uploadedAt).toBe('string');
      expect(new Date(metaA!.uploadedAt).getTime()).not.toBeNaN();
      expect(metaB).toEqual(metaA);
    });
  });

  it('gracefully handles metadata queries for non-existent assets', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const meta = await info('documents/not-found.png');
      expect(meta).toBeUndefined();
    });
  });

  it('deletes media asset and purges all pre-rendered and on-demand variants', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawImage = await createTestImage(600, 400);

      mockBucket.store.set('blog/featured-post.jpg', { data: rawImage });
      mockBucket.store.set('blog/featured-post.jpg-w_300.webp', { data: rawImage });
      mockBucket.store.set('blog/featured-post.jpg-w_600.webp', { data: rawImage });
      mockBucket.store.set('blog/featured-post.jpg-w_150_h_100.webp', { data: rawImage });

      const removed = await remove('blog/featured-post.jpg');
      expect(removed).toBe(true);

      expect(mockBucket.store.has('blog/featured-post.jpg')).toBe(false);
      expect(mockBucket.store.has('blog/featured-post.jpg-w_300.webp')).toBe(false);
      expect(mockBucket.store.has('blog/featured-post.jpg-w_600.webp')).toBe(false);
      expect(mockBucket.store.has('blog/featured-post.jpg-w_150_h_100.webp')).toBe(false);

      expect(await info('blog/featured-post.jpg')).toBeUndefined();
    });
  });

  it('isolates asset deletion from adjacent media in the same directory', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const rawA = await createTestImage(400, 400);
      const rawB = await createTestImage(400, 400);

      const fileA = new IRPCFile({ name: 'shoe.png', size: rawA.byteLength, type: 'image/png' }, new Blob([rawA as BlobPart]));
      const fileB = new IRPCFile({ name: 'shirt.png', size: rawB.byteLength, type: 'image/png' }, new Blob([rawB as BlobPart]));

      await upload('products', fileA, { resize: [{ width: 200, height: 200 }] });
      await upload('products', fileB, { resize: [{ width: 200, height: 200 }] });

      expect(mockBucket.store.has('products/shoe.png')).toBe(true);
      expect(mockBucket.store.has('products/shoe.png-w_200_h_200.webp')).toBe(true);
      expect(mockBucket.store.has('products/shirt.png')).toBe(true);
      expect(mockBucket.store.has('products/shirt.png-w_200_h_200.webp')).toBe(true);

      await remove('/products/shoe.png');

      expect(mockBucket.store.has('products/shoe.png')).toBe(false);
      expect(mockBucket.store.has('products/shoe.png-w_200_h_200.webp')).toBe(false);

      expect(mockBucket.store.has('products/shirt.png')).toBe(true);
      expect(mockBucket.store.has('products/shirt.png-w_200_h_200.webp')).toBe(true);
    });
  });

  it('safely handles repeated deletion requests idempotently', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      createWorker();
      setContext('env', {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
      });

      const removed = await remove('already-deleted/file.png');
      expect(removed).toBe(true);
    });
  });
  });
});

describe('User Journey: Platform Security and Access Control', () => {
  beforeEach(() => {
    (globalThis as unknown as { caches: { default: unknown } }).caches = {
      default: createMockCache(),
    };
  });

  it('handles CORS preflight and enforces allowed origins for browser requests', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
      R2_IMAGE_ORIGINS: 'https://storefront.example.com',
    };

    const rawImage = await createTestImage(100, 100);
    mockBucket.store.set('brand/logo.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const allowedReq = new Request('https://cdn.example.com/brand/logo.png', {
      headers: { Origin: 'https://storefront.example.com' },
    });
    const allowedRes = await worker.fetch(allowedReq, env, mockCtx);
    expect(allowedRes.status).toBe(200);

    const optionsReq = new Request('https://cdn.example.com/brand/logo.png', {
      method: 'OPTIONS',
      headers: { Origin: 'https://storefront.example.com' },
    });
    const optionsRes = await worker.fetch(optionsReq, env, mockCtx);
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get('Access-Control-Allow-Origin')).toBe('https://storefront.example.com');

    const untrustedReq = new Request('https://cdn.example.com/brand/logo.png', {
      headers: { Origin: 'https://malicious-site.com' },
    });
    const untrustedRes = await worker.fetch(untrustedReq, env, mockCtx);
    expect(untrustedRes.status).toBe(403);
    expect(await untrustedRes.text()).toBe('Forbidden');
  });

  it('requires API key credentials for mutations while allowing public reads', async () => {
    await withContext(createContextStore(), async () => {
      const mockBucket = createMockBucket();
      const worker = createWorker();
      const env: ImageWorkerEnv = {
        IMAGES: mockBucket as unknown as R2Bucket,
        RESIZER: createContainerResizer(),
        R2_IMAGE_API_KEY: 'admin-secret-token',
      };
      setContext('env', env);

      const rawImage = await createTestImage(100, 100);
      const file = new IRPCFile(
        { name: 'badge.png', size: rawImage.byteLength, type: 'image/png' },
        new Blob([rawImage as BlobPart])
      );

      await expect(upload('badge.png', file)).rejects.toThrow('Unauthorized: Valid API key required');
      await expect(remove('badge.png')).rejects.toThrow('Unauthorized: Valid API key required');

      setContext(IRPC_BASE_CONTEXT.CREDENTIALS, createCredentials([['apiKey', 'admin-secret-token']]));
      const result = (await upload('badge.png', file)) as ImageUploadState;
      expect(result.path).toBe('/badge.png');

      const deliveryRes = await worker.fetch(new Request('https://cdn.example.com/badge.png'), env, mockCtx);
      expect(deliveryRes.status).toBe(200);
    });
  });
});

describe('User Journey: Edge Infrastructure and High Availability', () => {
  beforeEach(() => {
    (globalThis as unknown as { caches: { default: unknown } }).caches = {
      default: createMockCache(),
    };
  });

  it('handles concurrent incoming requests for an uncached variant without race conditions', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(1000, 600);
    mockBucket.store.set('events/keynote.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const targetUrl = url('/events/keynote.png', { width: 400, height: 240, format: 'webp' });

    const requests = Array.from({ length: 5 }, () =>
      worker.fetch(new Request(`https://cdn.example.com${targetUrl}`), env, mockCtx)
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/webp');
    }

    expect(mockBucket.store.has('events/keynote.png-w_400_h_240.webp')).toBe(true);
  });

  it('routes transformation requests through Cloudflare Service Binding', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const rawImage = await createTestImage(400, 300);
    mockBucket.store.set('hero.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const res = await worker.fetch(new Request('https://cdn.example.com/hero.png?w=200'), env, mockCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });

  it('routes transformation requests through Durable Object container', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createDurableObjectResizer(),
    };

    const rawImage = await createTestImage(400, 300);
    mockBucket.store.set('hero.png', {
      data: rawImage,
      options: { httpMetadata: { contentType: 'image/png' } },
    });

    const res = await worker.fetch(new Request('https://cdn.example.com/hero.png?w=150'), env, mockCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });

  it('returns clean HTTP error responses when source media is missing', async () => {
    const mockBucket = createMockBucket();
    const worker = createWorker();
    const env: ImageWorkerEnv = {
      IMAGES: mockBucket as unknown as R2Bucket,
      RESIZER: createContainerResizer(),
    };

    const missingRes = await worker.fetch(new Request('https://cdn.example.com/nonexistent.png'), env, mockCtx);
    expect(missingRes.status).toBe(404);
    expect(await missingRes.text()).toBe('Image not found');

    const missingVarRes = await worker.fetch(
      new Request('https://cdn.example.com/nonexistent.png?w=200'),
      env,
      mockCtx
    );
    expect(missingVarRes.status).toBe(404);
    expect(await missingVarRes.text()).toBe('Image not found');

    const rootRes = await worker.fetch(new Request('https://cdn.example.com/'), env, mockCtx);
    expect(rootRes.status).toBe(404);
    expect(await rootRes.text()).toBe('Image not found');

    const postRes = await worker.fetch(
      new Request('https://cdn.example.com/pic.png', { method: 'POST' }),
      env,
      mockCtx
    );
    expect(postRes.status).toBe(405);

    const emptyContainerReq = new Request('http://container/resize?w=100', {
      method: 'POST',
      body: new Uint8Array(0),
    });
    const emptyContainerRes = await containerHandler(emptyContainerReq);
    expect(emptyContainerRes.status).toBe(400);
    expect(await emptyContainerRes.text()).toBe('Empty image payload');
  });

  it('rejects corrupt image payloads gracefully without crashing the worker', async () => {
    const corruptImage = new Uint8Array([0, 1, 2, 3, 4, 5]);
    await expect(resize(corruptImage, { width: 100 })).rejects.toThrow();
  });
});
