import type { Resize } from '../types.js';

/**
 * Parses an incoming image request URL into its target path and transform parameters.
 *
 * @param url The incoming request URL
 * @returns Parsed path, normalized transforms, and original-flag
 */
export function parseImageRequest(url: URL): {
  path: string;
  transforms: Resize;
  isOriginal: boolean;
} {
  const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const params = url.searchParams;

  const widthParam = params.get('w') || params.get('width');
  const heightParam = params.get('h') || params.get('height');
  const formatParam = (params.get('f') || params.get('format') || '').toLowerCase();
  const qualityParam = params.get('q') || params.get('quality');
  const fitParam = (params.get('fit') || '').toLowerCase();
  const nameParam = params.get('name') || params.get('v');
  const blurParam = params.get('blur') || params.get('b');

  const transforms: Resize = {};

  if (nameParam) {
    transforms.name = nameParam;
  }

  if (widthParam) {
    const parsed = parseInt(widthParam, 10);
    /* istanbul ignore else */
    if (!Number.isNaN(parsed) && parsed > 0) transforms.width = parsed;
  }

  if (heightParam) {
    const parsed = parseInt(heightParam, 10);
    /* istanbul ignore else */
    if (!Number.isNaN(parsed) && parsed > 0) transforms.height = parsed;
  }

  /* istanbul ignore else */
  if (formatParam && ['webp', 'avif', 'png', 'jpeg', 'jpg'].includes(formatParam)) {
    transforms.format = (formatParam === 'jpg' ? 'jpeg' : formatParam) as Resize['format'];
  }

  /* istanbul ignore else */
  if (qualityParam) {
    const parsed = parseInt(qualityParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) transforms.quality = parsed;
  }

  /* istanbul ignore else */
  if (fitParam && ['cover', 'contain', 'inside'].includes(fitParam)) {
    transforms.fit = fitParam as Resize['fit'];
  }

  /* istanbul ignore else */
  if (blurParam) {
    const parsed = parseInt(blurParam, 10);
    /* istanbul ignore else */
    if (!Number.isNaN(parsed) && parsed > 0) transforms.blur = parsed;
  }

  return {
    path,
    transforms,
    isOriginal: Object.keys(transforms).length === 0,
  };
}

/**
 * Formats a clean public image URL with requested transformation parameters.
 *
 * @param path Stored image path (e.g. '/photos/vacation.png')
 * @param transforms Desired width, height, format, or quality
 * @param baseUrl Optional base URL (defaults to relative root '/')
 * @returns Clean, formatted image URL
 */
export function formatImageUrl(
  path: string,
  transforms?: Resize,
  baseUrl = ''
): string {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  const cleanPath = path.replace(/^\/+/, '');

  if (!transforms || Object.keys(transforms).length === 0) {
    return `${base}/${cleanPath}`;
  }

  const query = new URLSearchParams();
  /* istanbul ignore else */
  if (transforms.name) query.set('name', transforms.name);
  /* istanbul ignore else */
  if (transforms.width) query.set('w', String(transforms.width));
  /* istanbul ignore else */
  if (transforms.height) query.set('h', String(transforms.height));
  /* istanbul ignore else */
  if (transforms.format) query.set('f', transforms.format);
  /* istanbul ignore else */
  if (transforms.quality) query.set('q', String(transforms.quality));
  /* istanbul ignore else */
  if (transforms.fit) query.set('fit', transforms.fit);
  /* istanbul ignore else */
  if (transforms.blur) query.set('blur', String(transforms.blur));

  return `${base}/${cleanPath}?${query.toString()}`;
}
