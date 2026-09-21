import { HTTPRouter } from '@irpclib/http/router';
import { implement } from './constructor.js';
import { transport } from './index.js';
import { handleImageDelivery } from './lib/index.js';
import type { ExecutionContext, ImageWorkerConfig, ImageWorkerEnv, ImageWorkerHandler } from './types.js';
import { handleCorsPreflight, isOriginAllowed } from './utils/index.js';

export * from './types.js';

/**
 * Creates the primary Cloudflare Worker fetch handler.
 * Dispatches between the IRPC router and high-speed Edge image delivery.
 *
 * @param config Optional worker configuration overrides
 * @returns Standard Cloudflare Worker handler
 */
export function createWorker<Env extends ImageWorkerEnv = ImageWorkerEnv>(
  config: ImageWorkerConfig<Env> = {}
): ImageWorkerHandler<Env> {
  const variantPrefix = config.variantPrefix;
  const browserTtl = config.cache?.browserTtl || 86400;
  const edgeTtl = config.cache?.edgeTtl || 2592000;

  const endpoint = config.endpoint || transport.endpoint;

  // Bind server-side router to the package transport
  const router = new HTTPRouter(transport, { endpoint });

  // Wire up IRPC constructors
  implement({
    variantPrefix,
    bucket: config.bucket,
    resizer: config.resizer,
    sizes: config.sizes,
    allowedSizes: config.allowedSizes,
  });

  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);

      // 1. Origin & Hotlinking Verification
      if (!isOriginAllowed(request, env.R2_IMAGE_ORIGINS)) {
        return new Response('Forbidden', { status: 403 });
      }

      // 2. CORS Preflight
      if (request.method === 'OPTIONS') {
        return handleCorsPreflight(request, env.R2_IMAGE_ORIGINS);
      }

      // 3. IRPC Operations Plane (only POST to endpoint)
      if (request.method === 'POST' && url.pathname === endpoint) {
        return router.resolve(request, [
          ['env', env],
          ['ctx', ctx],
          ['config', config],
        ]);
      }

      // 4. Edge Image Delivery Plane (GET /*)
      if (request.method === 'GET') {
        return handleImageDelivery(request, url, env, {
          variantPrefix,
          browserTtl,
          edgeTtl,
          bucketResolver: config.bucket,
          resizerResolver: config.resizer,
          onDemand: config.onDemand,
          allowedSizes: config.allowedSizes,
          sizes: config.sizes,
        });
      }

      return new Response('Method Not Allowed', { status: 405 });
    },
  };
}
