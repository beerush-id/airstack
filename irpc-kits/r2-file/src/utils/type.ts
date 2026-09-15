import { HandlerError } from '@irpclib/irpc';

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  k: 1024,
  mb: 1024 * 1024,
  m: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
  g: 1024 * 1024 * 1024,
  tb: 1024 * 1024 * 1024 * 1024,
  t: 1024 * 1024 * 1024 * 1024,
};

/**
 * Validates a MIME content-type string and parses it into its type and subtype tuple.
 *
 * @param type - Raw MIME type string, optionally including parameters (e.g. 'text/plain; charset=utf-8').
 * @returns A tuple containing `[type, subtype]`.
 * @throws {HandlerError} With `EINVAL` when the MIME string is missing required segments or delimiter.
 */
export function validateType(type: string): [string, string] {
  if (!type) {
    throw new HandlerError(
      'EINVAL',
      'Invalid file type',
      new Error(`validateType: Unsupported MIME type '${type}'`)
    );
  }

  const base = type.split(';')[0].trim();
  const slashIndex = base.indexOf('/');

  if (slashIndex <= 0 || slashIndex >= base.length - 1) {
    throw new HandlerError(
      'EINVAL',
      'Invalid file type',
      new Error(`validateType: Unsupported MIME type '${type}'`)
    );
  }

  const mainType = base.slice(0, slashIndex).trim();
  const subType = base.slice(slashIndex + 1).trim();

  if (!mainType || !subType || subType.includes('/')) {
    throw new HandlerError(
      'EINVAL',
      'Invalid file type',
      new Error(`validateType: Unsupported MIME type '${type}'`)
    );
  }

  return [mainType, subType];
}

/**
 * Determines whether a given MIME type is permitted by the configured allowedTypes whitelist.
 * Supports exact matches and wildcard patterns (e.g. 'image/*').
 *
 * @param type - MIME type to evaluate.
 * @param allowedTypes - List of permitted MIME types or wildcard patterns.
 * @returns `true` if permitted or if no whitelist is configured; otherwise `false`.
 */
export function isTypeAllowed(type: string, allowedTypes?: string[]): boolean {
  if (!allowedTypes?.length) {
    return true;
  }

  const cleanType = type.split(';')[0].trim().toLowerCase();

  return allowedTypes.some((pattern) => {
    const cleanPattern = pattern.trim().toLowerCase();

    if (cleanPattern === cleanType || cleanPattern === '*/*') {
      return true;
    }

    if (cleanPattern.endsWith('/*')) {
      const prefix = cleanPattern.slice(0, -1);
      return cleanType.startsWith(prefix);
    }

    return false;
  });
}

/**
 * Evaluates whether a payload byte size satisfies a configured maximum size constraint.
 *
 * @param size - Payload size in bytes.
 * @param maxSize - Configured limit as numeric bytes or human-readable string (e.g. '5MB').
 * @returns `true` if within the allowable size limit or if unconstrained; otherwise `false`.
 */
export function isSizeAllowed(size: number, maxSize?: number | string): boolean {
  if (maxSize == null) {
    return true;
  }

  return size <= parseSize(maxSize);
}

/**
 * Parses a byte size representation into a numeric byte count.
 * Accepts numeric bytes or case-insensitive human-readable strings (e.g. '500B', '10MB', '1GB').
 *
 * @param size - Size representation to parse.
 * @returns Total size in bytes.
 */
export function parseSize(size: number | string): number {
  if (typeof size === 'number') {
    return size;
  }

  const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) {
    return Number(size) || 0;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();

  const multiplier = SIZE_UNITS[unit] ?? 1;
  return Math.round(value * multiplier);
}
