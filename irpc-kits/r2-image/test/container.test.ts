import { Transformer } from '@napi-rs/image';
import { describe, expect, it } from 'vitest';
import { handler } from '../container/index.js';

async function createTestImage(width = 120, height = 80): Promise<Buffer> {
  const pixels = new Uint8Array(width * height * 4).fill(100);
  return Transformer.fromRgbaPixels(pixels, width, height).png();
}

describe('container handler', () => {
  it('returns 200 OK on /health GET request', async () => {
    const req = new Request('http://localhost:8080/health', { method: 'GET' });
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const req = new Request('http://localhost:8080/resize', { method: 'PUT' });
    const res = await handler(req);

    expect(res.status).toBe(405);
  });

  it('rejects empty image body with 400', async () => {
    const req = new Request('http://localhost:8080/resize', {
      method: 'POST',
      body: new Uint8Array(0),
    });
    const res = await handler(req);

    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Empty image payload');
  });

  it('transforms image and returns binary response with content headers', async () => {
    const imageBuffer = await createTestImage(120, 80);
    const req = new Request('http://localhost:8080/resize?w=60&h=40&f=webp&q=85', {
      method: 'POST',
      body: new Uint8Array(imageBuffer),
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(res.headers.get('Cache-Control')).toContain('immutable');

    const outputBuffer = Buffer.from(await res.arrayBuffer());
    const meta = await new Transformer(outputBuffer).metadata();
    expect(meta.width).toBe(60);
    expect(meta.height).toBe(40);
  });
});
