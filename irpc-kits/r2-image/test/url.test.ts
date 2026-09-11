import { createContextStore, withContext } from '@irpclib/irpc';
import { describe, expect, it } from 'vitest';
import { configure, transport, url } from '../src/index.js';

describe('url() and configure()', () => {
  it('formats image url with relative path by default', () => {
    const result = url('photos/avatar.png');
    expect(result).toBe('/photos/avatar.png');
  });

  it('formats image url with transformation parameters', () => {
    const result = url('photos/avatar.png', {
      width: 400,
      height: 300,
      format: 'webp',
      quality: 80,
      fit: 'cover',
    });
    expect(result).toBe('/photos/avatar.png?w=400&h=300&f=webp&q=80&fit=cover');
  });

  it('uses configured baseUrl across subsequent url() calls', () => {
    configure({ baseUrl: 'https://images.example.com' });

    expect(url('photos/avatar.png')).toBe('https://images.example.com/photos/avatar.png');
    expect(url('/photos/avatar.png')).toBe('https://images.example.com/photos/avatar.png');
    expect(url('photos/avatar.png', { width: 100 })).toBe('https://images.example.com/photos/avatar.png?w=100');
  });

  it('normalizes baseUrl with trailing slash', () => {
    configure({ baseUrl: 'https://cdn.example.com/' });

    expect(url('photos/banner.jpg')).toBe('https://cdn.example.com/photos/banner.jpg');
  });

  it('allows overriding baseUrl per call', () => {
    configure({ baseUrl: 'https://images.example.com' });

    const result = url('photos/custom.png', undefined, 'https://static.other.com');
    expect(result).toBe('https://static.other.com/photos/custom.png');
  });

  it('updates transport config and signs credentials without changing instance', () => {
    withContext(createContextStore(), () => {
      const originalTransport = transport;

      configure({
        baseUrl: 'https://images.example.com',
        apiKey: 'test-secret-key',
      });

      expect(transport).toBe(originalTransport);
      expect(transport.config.baseURL).toBe('https://images.example.com');
    });
  });
});
