import { HandlerError } from '@irpclib/irpc';
import { describe, expect, it } from 'vitest';
import { isSizeAllowed, isTypeAllowed, parseSize, validateType } from '../../src/utils/type.js';

/**
 * EINVAL rejection probe for malformed MIME input.
 *
 * Drives `validateType` with a malformed MIME string and asserts
 * the full dual-context contract: HandlerError variant, EINVAL code, public
 * message, and server-side diagnostic cause.
 *
 * @param type MIME string under test.
 * @returns Nothing; fails the test when the rejection contract is violated.
 */
function assertInvalidType(type: string): void {
  let thrown: unknown;

  try {
    validateType(type);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(HandlerError);

  const rejection = thrown as HandlerError & { code: string };
  expect(rejection.code).toBe('EINVAL');
  expect(rejection.message).toBe('Invalid file type');
  expect(rejection.cause).toBeInstanceOf(Error);
  expect((rejection.cause as Error).message).toContain(`validateType: Unsupported MIME type '${type}'`);
}

describe('Type Utilities - MIME Type Validation', () => {
  it('should parse valid MIME types into type and subtype', () => {
    expect(validateType('image/png')).toEqual(['image', 'png']);
    expect(validateType('application/json')).toEqual(['application', 'json']);
    expect(validateType('text/plain; charset=utf-8')).toEqual(['text', 'plain']);
  });

  it('should reject malformed MIME types with EINVAL', () => {
    assertInvalidType('invalid');
    assertInvalidType('');
    assertInvalidType('image/');
    assertInvalidType('/png');
    assertInvalidType('image/png/extra');
  });

  it('should match types against exact and wildcard whitelists', () => {
    expect(isTypeAllowed('image/png', ['image/png', 'image/jpeg'])).toBe(true);
    expect(isTypeAllowed('image/gif', ['image/*'])).toBe(true);
    expect(isTypeAllowed('application/pdf', ['image/*', 'application/pdf'])).toBe(true);
    expect(isTypeAllowed('application/x-sh', ['image/*', 'text/*'])).toBe(false);
    expect(isTypeAllowed('application/x-sh', ['image/png', 'application/pdf'])).toBe(false);
  });

  it('should allow all types when whitelist is not specified', () => {
    expect(isTypeAllowed('application/octet-stream')).toBe(true);
    expect(isTypeAllowed('video/mp4', undefined)).toBe(true);
  });
});

describe('Type Utilities - Byte Size Parsing & Gating', () => {
  it('should parse numeric sizes in bytes', () => {
    expect(parseSize(1024)).toBe(1024);
    expect(parseSize(0)).toBe(0);
  });

  it('should fallback to 0 for invalid string size', () => {
    expect(parseSize('invalid')).toBe(0);
    expect(parseSize('')).toBe(0);
  });

  it('should parse string size units case-insensitively', () => {
    expect(parseSize('500')).toBe(500);
    expect(parseSize('500B')).toBe(500);
    expect(parseSize('500kb')).toBe(500 * 1024);
    expect(parseSize('10MB')).toBe(10 * 1024 * 1024);
    expect(parseSize('1GB')).toBe(1 * 1024 * 1024 * 1024);
    expect(parseSize('500xyz')).toBe(500);
  });

  it('should validate payload size against configured maxSize limits', () => {
    expect(isSizeAllowed(500, '1kb')).toBe(true);
    expect(isSizeAllowed(1024, '1kb')).toBe(true);
    expect(isSizeAllowed(1025, '1kb')).toBe(false);
    expect(isSizeAllowed(10 * 1024 * 1024, '5MB')).toBe(false);
  });

  it('should validate payload size against numeric maxSize limits', () => {
    expect(isSizeAllowed(500, 1024)).toBe(true);
    expect(isSizeAllowed(1024, 1024)).toBe(true);
    expect(isSizeAllowed(1025, 1024)).toBe(false);
  });

  it('should allow any size when maxSize is not configured', () => {
    expect(isSizeAllowed(100 * 1024 * 1024, undefined)).toBe(true);
  });
});
