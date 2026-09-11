import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveURL, liveUrl, urlCtx } from '../../src/browser/url.js';
import * as envModule from '../../src/module.js';
import { createLifecycle } from '../../src/scope/lifecycle.js';

describe('browser/url', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/initial-path?foo=bar#init-hash');
  });

  afterEach(() => {
    window.history.pushState(null, '', '/');
    vi.restoreAllMocks();
  });

  describe('LiveURL Initialization & Sync', () => {
    it('should initialize and sync from full string URL', () => {
      const url = new LiveURL('https://user:pass@example.com:8080/nested/path?search=1&tag=ts#section');

      expect(url.protocol).toBe('https:');
      expect(url.username).toBe('user');
      expect(url.password).toBe('pass');
      expect(url.hostname).toBe('example.com');
      expect(url.port).toBe('8080');
      expect(url.host).toBe('example.com:8080');
      expect(url.origin).toBe('https://example.com:8080');
      expect(url.pathname).toBe('/nested/path');
      expect(url.search).toBe('?search=1&tag=ts');
      expect(url.hash).toBe('#section');
      expect(url.href).toBe('https://user:pass@example.com:8080/nested/path?search=1&tag=ts#section');
      expect(url.searchParams.get('search')).toBe('1');
      expect(url.searchParams.get('tag')).toBe('ts');
    });

    it('should initialize from relative string URL in browser mode', () => {
      const url = new LiveURL('/api/v1/items?limit=10');

      expect(url.pathname).toBe('/api/v1/items');
      expect(url.search).toBe('?limit=10');
      expect(url.searchParams.get('limit')).toBe('10');
    });

    it('should initialize from a URL instance', () => {
      const native = new URL('http://localhost:3000/docs');
      const url = new LiveURL(native);

      expect(url.pathname).toBe('/docs');
      expect(url.port).toBe('3000');
      expect(url.hostname).toBe('localhost');
    });

    it('should default to location.href when initialized without arguments in browser mode', () => {
      const url = new LiveURL();

      expect(url.pathname).toBe('/initial-path');
      expect(url.search).toBe('?foo=bar');
      expect(url.hash).toBe('#init-hash');
    });
  });

  describe('Browser Event Listeners & Reactivity', () => {
    it('should update on popstate event', () => {
      const url = new LiveURL();

      window.history.pushState(null, '', '/updated-page?page=2#top');
      window.dispatchEvent(new Event('popstate'));

      expect(url.pathname).toBe('/updated-page');
      expect(url.search).toBe('?page=2');
      expect(url.hash).toBe('#top');
      expect(url.searchParams.get('page')).toBe('2');
    });

    it('should update on hashchange event', () => {
      const url = new LiveURL();

      window.location.hash = '#new-anchor';
      window.dispatchEvent(new Event('hashchange'));

      expect(url.hash).toBe('#new-anchor');
    });

    it('should unbind listeners when lifecycle is destroyed via onCleanup', () => {
      const lifecycle = createLifecycle();
      let scopedUrl!: LiveURL;

      lifecycle.run(() => {
        scopedUrl = new LiveURL();
      });

      expect(scopedUrl.pathname).toBe('/initial-path');

      // Destroy lifecycle to trigger onCleanup
      lifecycle.destroy();

      window.history.pushState(null, '', '/after-destroy');
      window.dispatchEvent(new Event('popstate'));
      window.dispatchEvent(new Event('hashchange'));

      expect(scopedUrl.pathname).toBe('/initial-path');
    });
  });

  describe('Serialization', () => {
    it('should return href from toString() and toJSON()', () => {
      const target = 'https://example.com/test';
      const url = new LiveURL(target);

      expect(url.toString()).toBe(target);
      expect(url.toJSON()).toBe(target);
      expect(JSON.stringify(url)).toBe(JSON.stringify(target));
    });
  });

  describe('liveUrl & urlCtx', () => {
    it('should create a mutable LiveURL proxy via liveUrl()', () => {
      const url = liveUrl('https://example.com/api');

      expect(url).toBeInstanceOf(LiveURL);
      expect(url.pathname).toBe('/api');
    });

    it('should have a defined urlCtx context', () => {
      expect(urlCtx).toBeDefined();
      expect(typeof urlCtx.get).toBe('function');
      expect(typeof urlCtx.set).toBe('function');
    });
  });

  describe('Non-Browser Environment Fallbacks', () => {
    it('should use http://localhost base when isBrowser is false and relative string is passed', () => {
      vi.spyOn(envModule, 'isBrowser').mockReturnValue(false);

      const url = new LiveURL('/server/path?q=node');

      expect(url.origin).toBe('http://localhost');
      expect(url.pathname).toBe('/server/path');
      expect(url.search).toBe('?q=node');
    });

    it('should not sync or attach listeners when init is empty and isBrowser is false', () => {
      vi.spyOn(envModule, 'isBrowser').mockReturnValue(false);

      const url = new LiveURL();

      // Should remain uninitialized default fields
      expect(url.href).toBe('');
      expect(url.pathname).toBe('');
      expect(url.origin).toBe('');
    });
  });
});
