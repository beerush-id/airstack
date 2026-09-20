import { credential, GuardError, getContext, HandlerError, type IRPCFile, plan, stream } from '@irpclib/irpc';
import { anchor } from '@irpclib/irpc/core';
import { imageModule, info, remove, upload } from './index.js';
import { resizeImage, resolveBucket, resolveResizer } from './lib/resizer.js';
import {
  deleteImage,
  deleteVariants,
  getImageMetadata,
  getVariantKey,
  putOriginal,
  putVariant,
} from './lib/storage.js';
import type {
  DurableObjectNamespace,
  Fetcher,
  ImageConstructorConfig,
  ImageUploadOptions,
  ImageUploadState,
  ImageWorkerEnv,
  R2Bucket,
  Resize,
} from './types.js';
import { isSizeAllowed } from './utils/index.js';

/**
 * Implements IRPC constructor handlers for upload, remove, and info on imageModule.
 *
 * @param options Optional constructor configuration or variant prefix string
 */
export function implement<Env extends ImageWorkerEnv = ImageWorkerEnv>(
  options?: ImageConstructorConfig<Env> | string
): void {
  const config = typeof options === 'string' ? { variantPrefix: options } : options || {};
  const variantPrefix = config.variantPrefix;

  // Guard mutating operations with API key if configured in environment
  imageModule.guard(async (req) => {
    /* istanbul ignore else */
    if (req.name === 'image.upload' || req.name === 'image.delete') {
      const env = getContext<ImageWorkerEnv>('env');

      /* istanbul ignore else */
      if (env?.R2_IMAGE_API_KEY) {
        const apiKey = credential<string>('apiKey');
        if (apiKey !== env.R2_IMAGE_API_KEY) {
          throw GuardError.failed('Unauthorized: Valid API key required');
        }
      }
    }
  });

  // Handler: image.upload (returns a reactive stream tracking each workflow step)
  imageModule.construct(upload, (path: string, file: IRPCFile, uploadOptions?: ImageUploadOptions) => {
    const env = requireWorkerEnv<Env>();
    const bucket = resolveBucket(env, config.bucket);
    const resizer = resolveResizer(env, config.resizer);

    return stream<ImageUploadState>(
      async (state, accept, reject) => {
        try {
          const buffer = await file.data.arrayBuffer();
          const contentType = file.meta.type;
          const destinationPath = resolveDestinationPath(path, file);

          await uploadWorkflow({
            state,
            bucket,
            resizer,
            buffer,
            contentType,
            destinationPath,
            variantPrefix,
            defaultResize: config.sizes,
            allowedSizes: config.allowedSizes,
            options: uploadOptions,
          });

          accept(state.data);
        } catch (error) {
          reject(HandlerError.failed(error as Error | string));
        }
      },
      { step: 'original', progress: 'Saving original image' }
    );
  });

  // Handler: image.delete
  imageModule.construct(remove, async (path: string): Promise<boolean> => {
    const env = requireWorkerEnv<Env>();
    const bucket = resolveBucket(env, config.bucket);
    return deleteImage(bucket, path, variantPrefix);
  });

  // Handler: image.info
  imageModule.construct(info, async (path: string) => {
    const env = requireWorkerEnv<Env>();
    const bucket = resolveBucket(env, config.bucket);
    return getImageMetadata(bucket, path);
  });
}

/**
 * Resolves the active Cloudflare Worker environment from IRPC context.
 *
 * @throws {HandlerError} If environment context is missing
 */
function requireWorkerEnv<Env extends ImageWorkerEnv>(): Env {
  const env = getContext<Env>('env');
  if (!env) {
    throw HandlerError.failed(
      'Worker environment context is missing: execution requires valid Cloudflare Worker bindings'
    );
  }
  return env;
}

/**
 * Formats a concise dimension label for progress reporting.
 */
function formatResizeLabel(opts: { name?: string; size?: number; width?: number; height?: number }): string {
  if (opts.name) return opts.name;
  if (opts.size) return `${opts.size}`;
  return `${opts.width ?? ''}x${opts.height ?? ''}`;
}

/**
 * Resolves the destination R2 object path based on file extension discrimination.
 * If the path's terminal segment has an extension, it is treated as an explicit filepath.
 * Otherwise, it is treated as a directory and the file name is appended (falling back to UUID if unnamed).
 *
 * @param path Destination folder or explicit filepath
 * @param file Uploaded image payload
 * @returns Clean, resolved R2 object key
 */
function resolveDestinationPath(path: string, file: IRPCFile): string {
  const lastSegment = path.split('/').pop() || '';
  const isFilePath = /\.[a-zA-Z0-9]+$/.test(lastSegment);

  if (isFilePath) {
    return path.replace(/^\/+/, '');
  }

  const folder = path.replace(/^\/+|\/+$/g, '');
  let fileName = file.meta.name;

  /* istanbul ignore else */
  if (!fileName) {
    const ext = file.meta.type?.split('/').pop();
    fileName = ext ? `${crypto.randomUUID()}.${ext}` : crypto.randomUUID();
  }

  return folder ? `${folder}/${fileName}` : fileName;
}

// --------------------------------------------------------------------------
// Workflow Pipeline & Execution Steps
// --------------------------------------------------------------------------

/**
 * Upload workflow definition executing each storage and transformation step sequentially.
 */
const uploadWorkflow = plan<UploadWorkflowContext>().then(saveOriginal).then(saveVariants).then(resizeVariants);

/**
 * Step 1: Saves the raw original image to R2 and updates tracking metadata.
 */
async function saveOriginal(ctx: UploadWorkflowContext): Promise<UploadWorkflowContext> {
  anchor.assign(ctx.state.data, {
    step: 'original',
    progress: 'Saving original image',
  });

  await deleteVariants(ctx.bucket, ctx.destinationPath, ctx.variantPrefix);

  const originalObj = await putOriginal(ctx.bucket, ctx.destinationPath, ctx.buffer, ctx.contentType);
  ctx.originalEtag = originalObj.etag;

  anchor.assign(ctx.state.data, {
    path: `/${ctx.destinationPath.replace(/^\/+/, '')}`,
    type: ctx.contentType,
    size: ctx.buffer.byteLength,
  });

  return ctx;
}

/**
 * Step 2: Persists client-rendered variants directly to R2 without invoking the container.
 */
async function saveVariants(ctx: UploadWorkflowContext): Promise<UploadWorkflowContext> {
  /* istanbul ignore else */
  if (ctx.options?.variants && ctx.options.variants.length > 0) {
    for (const variant of ctx.options.variants) {
      if (!isSizeAllowed(variant, ctx.allowedSizes as (number | Resize)[] | undefined)) {
        continue;
      }
      const label = formatResizeLabel(variant);
      anchor.assign(ctx.state.data, {
        step: 'variants',
        progress: `Saving ${label} variant`,
      });

      const variantKey = getVariantKey(ctx.destinationPath, variant, ctx.variantPrefix);
      const variantBuffer = await variant.file.data.arrayBuffer();
      const variantContentType = variant.file.meta.type;
      await putVariant(ctx.bucket, variantKey, variantBuffer, variantContentType, ctx.originalEtag);
    }
  }
  return ctx;
}

/**
 * Step 3: Generates server-side resize variants via the container and stores them in R2.
 */
async function resizeVariants(ctx: UploadWorkflowContext): Promise<UploadWorkflowContext> {
  if (ctx.options?.variants && ctx.options.variants.length > 0) {
    anchor.assign(ctx.state.data, {
      step: 'complete',
      progress: 'Upload complete',
    });
    return ctx;
  }

  const rawResizes = (ctx.options?.sizes ?? ctx.defaultResize) as Resize[] | undefined;
  const serverResizes = rawResizes
    ? rawResizes.filter((r) => isSizeAllowed(r, ctx.allowedSizes as (number | Resize)[] | undefined))
    : [];

  /* istanbul ignore else */
  if (serverResizes.length > 0) {
    for (const resizeOptions of serverResizes) {
      const label = formatResizeLabel(resizeOptions);
      anchor.assign(ctx.state.data, {
        step: 'resize',
        progress: `Creating ${label} variant`,
      });

      const variantKey = getVariantKey(ctx.destinationPath, resizeOptions, ctx.variantPrefix);
      const sourceStream = new Response(ctx.buffer).body as ReadableStream<Uint8Array>;
      const resizedResponse = await resizeImage(ctx.resizer, sourceStream, resizeOptions);
      const variantBuffer = await resizedResponse.arrayBuffer();
      const variantContentType = resizedResponse.headers.get('content-type') as string;
      await putVariant(ctx.bucket, variantKey, variantBuffer, variantContentType, ctx.originalEtag);
    }
  }

  anchor.assign(ctx.state.data, {
    step: 'complete',
    progress: 'Upload complete',
  });

  return ctx;
}

/**
 * Execution context passed between steps in the upload workflow.
 */
interface UploadWorkflowContext {
  [key: string]: unknown;

  /** Reactive remote state container whose data is streamed to the client. */
  state: { data: ImageUploadState };

  /** Target R2 storage bucket. */
  bucket: R2Bucket;

  /** Cloudflare container resizer binding or URL. */
  resizer: DurableObjectNamespace | Fetcher | string;

  /** Raw binary payload of the original image. */
  buffer: ArrayBuffer;

  /** MIME content type of the image. */
  contentType: string;

  /** Resolved R2 destination key path. */
  destinationPath: string;

  /** Optional R2 folder prefix for variants. */
  variantPrefix?: string;

  /** Optional upload configuration and variants. */
  options?: ImageUploadOptions;

  /** Server default resize specifications. */
  defaultResize?: Resize[];

  /** ETag of the original R2 object (assigned after saveOriginal). */
  originalEtag?: string;
}
