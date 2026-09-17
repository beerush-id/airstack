import { type AnyType, HandlerError } from '@irpclib/irpc';
import type { FileEncoding, FileInput, WriteOptions } from '../../types.js';

/**
 * Wire stream contract with text, arrayBuffer, and httpMetadata accessors.
 */
export interface Decodable {
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

/**
 * Converts a filesystem write payload into storable R2 string, buffer, or Uint8Array.
 *
 * @param data - Input payload across string, binary, file, or JSON forms.
 * @param options - Optional write options declaring inbound wire encoding.
 * @returns Storable string, ArrayBuffer, or Buffer for `R2Bucket.put`.
 * @throws {HandlerError} With `EINVAL` when the payload cannot be encoded.
 */
export async function toStorable(data: FileInput, options?: WriteOptions): Promise<string | ArrayBuffer | Uint8Array> {
  try {
    if (options?.encoding === 'base64' && typeof data === 'string') {
      return Buffer.from(data, 'base64');
    }
    if (options?.encoding === 'data-url' && typeof data === 'string') {
      const raw = data.slice(data.indexOf(',') + 1);
      return data.includes(';base64') ? Buffer.from(raw, 'base64') : Buffer.from(decodeURIComponent(raw));
    }
    if (typeof data === 'string' || data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return data as AnyType;
    }
    if (typeof data === 'object') {
      const target = data as {
        data?: { arrayBuffer?: () => Promise<ArrayBuffer> };
        arrayBuffer?: () => Promise<ArrayBuffer>;
      };
      if (typeof target.data?.arrayBuffer === 'function') {
        return await target.data.arrayBuffer();
      }
      if (typeof target.arrayBuffer === 'function') {
        return await target.arrayBuffer();
      }
    }
    return JSON.stringify(data);
  } catch (cause) {
    throw new HandlerError('EINVAL', 'Invalid file content', cause as Error);
  }
}

/**
 * Decodes stored bytes into the requested wire representation.
 *
 * @param object - Stored object carrying text and arrayBuffer methods.
 * @param encoding - Requested wire encoding; omitted means binary delivery.
 * @returns Decoded text, JSON, base64, data-url, or raw object stream.
 * @throws {HandlerError} With `EINVAL` when the stored bytes cannot be decoded.
 */
export async function decodeBody(object: Decodable, encoding?: FileEncoding): Promise<unknown> {
  if (encoding === undefined) return object;
  try {
    if (encoding === 'text') return await object.text();
    if (encoding === 'json') return JSON.parse(await object.text());
    const bytes = new Uint8Array(await object.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);
    if (encoding === 'base64') return base64;
    const type = object.httpMetadata?.contentType;
    return `data:${type};base64,${base64}`;
  } catch (cause) {
    throw new HandlerError('EINVAL', 'Invalid file content', cause as Error);
  }
}
