import { HandlerError } from '@irpclib/irpc';
import type { UrlContent } from '../types.js';

const encoder = new TextEncoder();

/**
 * Resolves what a URL serves, for a `url` write: a `data:` URL decoded to its exact bytes, or an
 * `https:` URL fetched, streamed when the host says its length and read up to `maxSize` when not.
 *
 * Concern: the URL is checked before anything is fetched, and no body past `maxSize` is ever
 * held, so a server can keep a large generated file without the caller downloading it first.
 *
 * @param url - URL whose content is stored; only `https:` and `data:` are accepted.
 * @param maxSize - Largest body accepted, in bytes.
 * @returns The body, its byte size, and its MIME type without parameters.
 * @throws {HandlerError} `EINVAL` for anything but an `https:` or `data:` URL, before any fetch;
 * `EFBIG` for a body past `maxSize`; `EIO` when the host fails or answers with an error.
 */
export async function resolveUrl(url: unknown, maxSize: number): Promise<UrlContent> {
  const parsed = parseUrl(url);
  if (parsed.protocol === 'data:') {
    const content = decodeDataUrl(parsed.href);
    if (content.size > maxSize) throw tooBig(content.size, maxSize);
    return content;
  }
  return fetchUrl(url as string, parsed, maxSize);
}

/** Parses a `url` write's payload, refusing with `EINVAL` anything but an `https:` or `data:` URL. */
function parseUrl(url: unknown): URL {
  let parsed: URL | undefined;
  try {
    parsed = typeof url === 'string' ? new URL(url) : undefined;
  } catch {
    // Not a URL: refused below like any other unsupported value.
  }
  if (parsed === undefined || (parsed.protocol !== 'https:' && parsed.protocol !== 'data:')) {
    throw new HandlerError(
      'EINVAL',
      'Invalid file content',
      new Error('write: Only https: and data: URLs are accepted')
    );
  }
  return parsed;
}

/**
 * Decodes a `data:` URL to its exact bytes, typed by its media type (`text/plain` when it names none).
 *
 * @param href - Serialized `data:` URL.
 * @returns The decoded bytes, their size, and the media type without parameters.
 */
function decodeDataUrl(href: string): UrlContent {
  const comma = href.indexOf(',');
  if (comma < 0) {
    throw new HandlerError('EINVAL', 'Invalid file content', new Error('write: A data: URL needs a comma'));
  }
  const header = href.slice('data:'.length, comma).trim();
  const base64 = /;\s*base64$/i.test(header);
  const bytes = percentDecode(href.slice(comma + 1));
  const body = base64 ? Buffer.from(Buffer.from(bytes).toString('latin1'), 'base64') : bytes;
  return { body, size: body.byteLength, type: baseType(header) || 'text/plain' };
}

/** Turns `%XX` escapes into the bytes they stand for, leaving every other character as its UTF-8 bytes. */
function percentDecode(text: string): Uint8Array {
  const input = encoder.encode(text);
  const output = new Uint8Array(input.length);
  let length = 0;
  for (let index = 0; index < input.length; index++) {
    const hex = String.fromCharCode(input[index + 1], input[index + 2]);
    if (input[index] === 0x25 && /^[\da-f]{2}$/i.test(hex)) {
      output[length++] = Number.parseInt(hex, 16);
      index += 2;
    } else {
      output[length++] = input[index];
    }
  }
  return output.subarray(0, length);
}

/**
 * Fetches an `https:` URL. A body the host gives the length of, uncompressed, streams through a
 * `FixedLengthStream`, which R2 takes as is and which fails on any byte past that length. Any
 * other body is read up to `maxSize` and no further, since R2 only takes a stream of known length.
 *
 * @param url - URL as the caller gave it, fetched unaltered so a signed query keeps its signature.
 * @param parsed - The same URL parsed, for messages that leave the query out.
 * @param maxSize - Largest body accepted, in bytes.
 * @returns The body, its byte size, and the host's MIME type without parameters.
 */
async function fetchUrl(url: string, parsed: URL, maxSize: number): Promise<UrlContent> {
  const where = `${parsed.origin}${parsed.pathname}`;
  const response = await fetch(url).catch((cause: Error) => {
    throw new HandlerError('EIO', 'Failed to write', cause);
  });
  // A redirect could leave https; only the final answer is checked, as only it is stored.
  if (!response.ok || (response.redirected && !response.url.startsWith('https:'))) {
    await response.body?.cancel();
    throw new HandlerError('EIO', 'Failed to write', new Error(`write: ${where} answered ${response.status}`));
  }

  const type = baseType(response.headers.get('content-type') ?? '') || 'application/octet-stream';
  const length = declaredLength(response.headers);
  if (length !== undefined && length > maxSize) {
    await response.body?.cancel();
    throw tooBig(length, maxSize);
  }

  const FixedLengthStream = (
    globalThis as { FixedLengthStream?: new (length: number) => TransformStream<Uint8Array, Uint8Array> }
  ).FixedLengthStream;
  if (length !== undefined && response.body && FixedLengthStream) {
    return { body: response.body.pipeThrough(new FixedLengthStream(length)), size: length, type };
  }

  const body = await readUpTo(response.body, maxSize).catch((cause: Error) => {
    throw cause instanceof HandlerError ? cause : new HandlerError('EIO', 'Failed to write', cause);
  });
  return { body, size: body.byteLength, type };
}

/**
 * The body length a host states, when it is the length of the bytes it delivers: a compressed
 * body is decoded on arrival, so its `Content-Length` says nothing about the stored size.
 */
function declaredLength(headers: Headers): number | undefined {
  const length = headers.get('content-length');
  const encoding = headers.get('content-encoding');
  if (length === null || !/^\d+$/.test(length.trim())) return undefined;
  if (encoding !== null && encoding.trim().toLowerCase() !== 'identity') return undefined;
  return Number(length);
}

/** Reads a body whole, refusing with `EFBIG`, and cancelling the rest, as soon as it passes `maxSize`. */
async function readUpTo(body: ReadableStream<Uint8Array> | null, maxSize: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (body) {
    const reader = body.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > maxSize) {
        await reader.cancel();
        throw tooBig(size, maxSize);
      }
      chunks.push(chunk.value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** A MIME type without its parameters, lowercased. */
function baseType(type: string): string {
  return type.split(';')[0].trim().toLowerCase();
}

/** The `EFBIG` refusal of a body past `maxSize`. */
function tooBig(size: number, maxSize: number): HandlerError {
  return new HandlerError(
    'EFBIG',
    'File size exceeds limit',
    new Error(`File size ${size} exceeds maxSize ${maxSize}`)
  );
}
