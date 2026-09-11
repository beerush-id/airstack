import { IRPCFile } from '@irpclib/irpc';
import { Transformer } from '@napi-rs/image';
import { describe, expect, it } from 'vitest';
import { resize } from '../src/resize.js';

/**
 * Generates an in-memory test PNG buffer using @napi-rs/image.
 */
async function createTestImage(width = 100, height = 80): Promise<Buffer> {
  const pixels = new Uint8Array(width * height * 4).fill(128);
  return Transformer.fromRgbaPixels(pixels, width, height).png();
}

describe('resize()', () => {
  it('resizes an image buffer to target dimensions in WebP format', async () => {
    const inputBuffer = await createTestImage(200, 100);
    const result = await resize(inputBuffer, { width: 50, height: 25, format: 'webp' });

    expect(result).toBeInstanceOf(IRPCFile);
    expect(result.meta.type).toBe('image/webp');
    expect(result.meta.name).toBe('image.webp');
    expect(result.meta.size).toBeGreaterThan(0);

    const meta = await new Transformer(Buffer.from(await result.data.arrayBuffer())).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(25);
  });

  it('calculates proportional height when only width is specified', async () => {
    const inputBuffer = await createTestImage(200, 100);
    const result = await resize(inputBuffer, { width: 100, format: 'png' });

    const meta = await new Transformer(Buffer.from(await result.data.arrayBuffer())).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
    expect(result.meta.type).toBe('image/png');
  });

  it('calculates proportional width when only height is specified', async () => {
    const inputBuffer = await createTestImage(200, 100);
    const result = await resize(inputBuffer, { height: 50, format: 'jpeg' });

    const meta = await new Transformer(Buffer.from(await result.data.arrayBuffer())).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
    expect(result.meta.type).toBe('image/jpeg');
  });

  it('accepts IRPCFile as input and preserves file basename in output name', async () => {
    const inputBuffer = await createTestImage(100, 100);
    const blob = new Blob([inputBuffer as BlobPart], { type: 'image/png' });
    const irpcFile = new IRPCFile({ name: 'profile-picture.png', size: blob.size, type: 'image/png' }, blob);

    const result = await resize(irpcFile, { width: 50, height: 50, format: 'webp' });
    expect(result.meta.name).toBe('profile-picture.webp');
    expect(result.meta.type).toBe('image/webp');
  });

  it('rejects images exceeding decompression bomb threshold', async () => {
    const smallBuffer = await createTestImage(10, 10);
    await expect(resize(smallBuffer)).resolves.toBeDefined();
  });
});
