import { resize } from '../src/resize.js';
import type { Resize } from '../src/types.js';

/**
 * Handles incoming HTTP requests for image resizing inside Cloudflare Containers.
 * Reuses the universal resize() implementation directly.
 *
 * @param req Incoming HTTP request
 * @returns Transformed image response or error response
 */
export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Healthcheck endpoint
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    return new Response('OK', { status: 200 });
  }

  // Only POST requests are accepted for transformation
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const sourceBuffer = new Uint8Array(await req.arrayBuffer());
    if (sourceBuffer.length === 0) {
      return new Response('Empty image payload', { status: 400 });
    }

    const params = url.searchParams;
    const widthParam = params.get('w') || params.get('width');
    const heightParam = params.get('h') || params.get('height');
    const formatParam = params.get('f') || params.get('format');
    const qualityParam = params.get('q') || params.get('quality');
    const fitParam = params.get('fit');
    const blurParam = params.get('blur');

    const options: Resize = {};
    if (widthParam) {
      const parsed = parseInt(widthParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) options.width = parsed;
    }
    if (heightParam) {
      const parsed = parseInt(heightParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) options.height = parsed;
    }
    if (formatParam && ['webp', 'avif', 'png', 'jpeg', 'jpg'].includes(formatParam.toLowerCase())) {
      options.format = (formatParam.toLowerCase() === 'jpg' ? 'jpeg' : formatParam.toLowerCase()) as Resize['format'];
    }
    if (qualityParam) {
      const parsed = parseInt(qualityParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) options.quality = parsed;
    }
    if (fitParam && ['cover', 'contain', 'inside'].includes(fitParam.toLowerCase())) {
      options.fit = fitParam.toLowerCase() as Resize['fit'];
    }
    if (blurParam) {
      const parsed = parseInt(blurParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) options.blur = parsed;
    }

    const resizedFile = await resize(sourceBuffer, options);
    const outputBuffer = await resizedFile.data.arrayBuffer();

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': resizedFile.meta.type,
        'Content-Length': String(resizedFile.meta.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transformation failed';
    return new Response(message, { status: 400 });
  }
}

// Auto-boot server when executed directly by Bun runner
if (typeof Bun !== 'undefined' && import.meta.main) {
  const port = parseInt(process.env.PORT || '8080', 10);
  Bun.serve({
    port,
    fetch: handler,
  });
}
