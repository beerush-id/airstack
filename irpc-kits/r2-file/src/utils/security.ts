/**
 * Generates an HMAC-SHA256 signed URL path with token and expires query parameters.
 *
 * @param path - Virtual filesystem path being signed.
 * @param secret - Shared HMAC signing secret key.
 * @param ttl - Time-to-live in seconds relative to current time.
 * @returns Signed URL string with appended token and expires query parameters.
 */
export async function signUrl(path: string, secret: string, ttl: number): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const token = await computeSignature(path, expires, secret);

  const delimiter = path.includes('?') ? '&' : '?';
  return `${path}${delimiter}token=${encodeURIComponent(token)}&expires=${expires}`;
}

/**
 * Validates whether an incoming token signature and expiration timestamp match the target path.
 *
 * @param path - Virtual filesystem path being accessed.
 * @param token - Hex-encoded HMAC signature token from the request.
 * @param secret - Shared HMAC signing secret key.
 * @param expires - Unix epoch expiration timestamp in seconds.
 * @returns `true` if the token is valid and unexpired; otherwise `false`.
 */
export async function verifyToken(path: string, token: string, secret: string, expires: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expires) || expires <= now) {
    return false;
  }

  const expectedToken = await computeSignature(path, expires, secret);
  return constantTimeCompare(token, expectedToken);
}

/**
 * Computes an HMAC-SHA256 hex digest for a given path and expiration payload.
 */
async function computeSignature(path: string, expires: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = new TextEncoder().encode(`${path}:${expires}`);
  const signature = await crypto.subtle.sign('HMAC', key, message);

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compares two strings in constant time to prevent timing side-channel attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}
