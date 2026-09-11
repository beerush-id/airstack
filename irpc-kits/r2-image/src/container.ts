import { resize } from './resize.js';
import { parseImageRequest } from './utils/index.js';

/**
 * Handles incoming HTTP requests for image resizing inside Cloudflare Containers or standalone services.
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

    const { transforms: options } = parseImageRequest(url);

    const resizedFile = await resize(sourceBuffer, options);
    const outputBuffer = await resizedFile.data.arrayBuffer();

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': resizedFile.meta.type,
        'Content-Length': String(resizedFile.meta.size),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : /* istanbul ignore next */ 'Transformation failed';
    return new Response(message, { status: 400 });
  }
}

export default {
  port: parseInt(process.env.PORT || '8080', 10),
  fetch: handler,
};
