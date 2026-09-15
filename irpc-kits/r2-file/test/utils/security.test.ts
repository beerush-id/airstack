import { describe, expect, it } from 'vitest';
import { signUrl, verifyToken } from '../../src/utils/security.js';

describe('Security Utilities - HMAC URL Signing & Token Verification', () => {
  const secret = 'super-secret-signing-key-12345';
  const filePath = '/media/video.mp4';
  const queryPath = '/media/video.mp4?alt=media';

  /**
   * Signs a path and extracts the issued token and expiry.
   *
   * @param path File path to sign, with or without a query string.
   * @param ttlSeconds Seconds from now until expiry.
   * @returns Token and numeric expiry issued for the path.
   */
  async function signAndParse(path: string, ttlSeconds: number): Promise<{ token: string; expires: number }> {
    const signedUrl = await signUrl(path, secret, ttlSeconds);
    const parsed = new URL(signedUrl, 'https://example.com');

    return {
      token: parsed.searchParams.get('token')!,
      expires: Number(parsed.searchParams.get('expires')),
    };
  }

  /**
   * Returns a same-length token with one character flipped.
   *
   * Keeps the encoded length stable so verification takes the
   * value-comparison path instead of the length short-circuit.
   *
   * @param token Valid signature token.
   * @returns Tampered token of identical length.
   */
  function flipTokenChar(token: string): string {
    const replacement = token[0] === 'a' ? 'b' : 'a';
    return replacement + token.slice(1);
  }

  it('should reject signature when expiration timestamp is NaN or non-finite', async () => {
    const { token } = await signAndParse(filePath, 3600);
    const future = Math.floor(Date.now() / 1000) + 3600;

    expect(await verifyToken(filePath, token, secret, NaN)).toBe(false);
    expect(await verifyToken(filePath, token, secret, Infinity)).toBe(false);
    expect(Number.isFinite(future)).toBe(true);
  });

  it('should generate signed URL with token and expires query parameters', async () => {
    const signedUrl = await signUrl(filePath, secret, 3600);
    const parsed = new URL(signedUrl, 'https://example.com');

    expect(parsed.pathname).toBe(filePath);
    expect(parsed.searchParams.has('token')).toBe(true);
    expect(parsed.searchParams.has('expires')).toBe(true);

    const expires = Number(parsed.searchParams.get('expires'));
    expect(expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should append token with & delimiter when path already includes query parameters', async () => {
    const signedUrl = await signUrl(queryPath, secret, 3600);
    const parsed = new URL(signedUrl, 'https://example.com');

    expect(parsed.searchParams.get('alt')).toBe('media');
    expect(parsed.searchParams.has('token')).toBe(true);
    expect(parsed.searchParams.has('expires')).toBe(true);
  });

  it('should successfully verify valid signed token within TTL', async () => {
    const { token, expires } = await signAndParse(filePath, 3600);

    const isValid = await verifyToken(filePath, token, secret, expires);
    expect(isValid).toBe(true);
  });

  it('should reject signature when expiration timestamp is in the past', async () => {
    // Generate signature with negative TTL (already expired)
    const { token, expires } = await signAndParse(filePath, -10);

    const isValid = await verifyToken(filePath, token, secret, expires);
    expect(isValid).toBe(false);
  });

  it('should reject signature when path has been tampered with', async () => {
    const { token, expires } = await signAndParse(filePath, 3600);

    // Attempting to use valid token on a different file
    const isValid = await verifyToken('/media/different.mp4', token, secret, expires);
    expect(isValid).toBe(false);
  });

  it('should reject signature when secret does not match', async () => {
    const { token, expires } = await signAndParse(filePath, 3600);

    const isValid = await verifyToken(filePath, token, 'wrong-secret', expires);
    expect(isValid).toBe(false);
  });

  it('should reject token with mismatched length in constant time comparison', async () => {
    expect(await verifyToken(filePath, 'short-token', secret, Math.floor(Date.now() / 1000) + 3600)).toBe(false);
  });

  it('should reject same-length signature with a single flipped character', async () => {
    const { token, expires } = await signAndParse(filePath, 3600);

    const tampered = flipTokenChar(token);
    expect(tampered).not.toBe(token);
    expect(tampered.length).toBe(token.length);

    const isValid = await verifyToken(filePath, tampered, secret, expires);
    expect(isValid).toBe(false);
  });

  it('should reject valid token when expiration timestamp is substituted', async () => {
    const { token, expires } = await signAndParse(filePath, 3600);

    const substituted = expires + 3600;
    expect(Number.isFinite(substituted)).toBe(true);
    expect(substituted).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const isValid = await verifyToken(filePath, token, secret, substituted);
    expect(isValid).toBe(false);
  });

  it('should verify the query-bearing signed path', async () => {
    const { token, expires } = await signAndParse(queryPath, 3600);

    const isValid = await verifyToken(queryPath, token, secret, expires);
    expect(isValid).toBe(true);
  });

  it('should reject valid token when the signed query string is altered or stripped', async () => {
    const { token, expires } = await signAndParse(queryPath, 3600);

    const altered = await verifyToken('/media/video.mp4?alt=other', token, secret, expires);
    expect(altered).toBe(false);

    const stripped = await verifyToken('/media/video.mp4', token, secret, expires);
    expect(stripped).toBe(false);
  });
});
