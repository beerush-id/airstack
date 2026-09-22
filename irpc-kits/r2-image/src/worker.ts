import { HTTPRouter } from '@irpclib/http/router';
import { implement } from './constructor.js';
import { IMAGE_OPTIONS, transport } from './index.js';
import { handleImageDelivery } from './lib/index.js';
import type { ImageWorkerConfig, ImageWorkerEnv, ImageWorkerHandler } from './types.js';
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
  config: ImageWorkerConfig = {}
): ImageWorkerHandler<Env> {
  const edgeTtl = config.cache?.edgeTtl || 2592000;
  const browserTtl = config.cache?.browserTtl || 86400;
  const variantPrefix = config.variantPrefix;

  const sizes = config.sizes ?? IMAGE_OPTIONS.sizes;
  const endpoint = config.endpoint || IMAGE_OPTIONS.endpoint || transport.endpoint;
  const allowedSizes = config.allowedSizes ?? IMAGE_OPTIONS.allowedSizes;

  // Bind server-side router to the package transport
  const router = new HTTPRouter(transport, { endpoint });

  // Wire up IRPC constructors
  implement({ variantPrefix, sizes, allowedSizes });

  return {
    endpoint,
    async fetch(request: Request, env: Env): Promise<Response> {
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
          ['config', config],
        ]);
      }

      // 4. Edge Image Delivery Plane (GET /*)
      if (request.method === 'GET') {
        return handleImageDelivery(request, url, env, {
          sizes,
          edgeTtl,
          browserTtl,
          allowedSizes,
          variantPrefix,
          onDemand: config.onDemand,
        });
      }

      return new Response('Method Not Allowed', { status: 405 });
    },
  };
}
