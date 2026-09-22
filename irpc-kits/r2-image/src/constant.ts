import type { ClientConfig, ImageFormat } from './types.js';

export const DEFAULT_FORMAT: ImageFormat = 'webp';
export const DEFAULT_QUALITY = 85;
/**
 * Configured base domain for public image delivery and default transport.
 */
export const IMAGE_OPTIONS: ClientConfig = {
  format: DEFAULT_FORMAT,
  quality: DEFAULT_QUALITY,
  maxSize: 10485760, // 10MB.
  baseUrl: '',
  onDemand: false,
};
