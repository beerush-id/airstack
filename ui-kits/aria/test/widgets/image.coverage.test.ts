import { createLifecycle, mutable, setStaticTracker } from '@airlib/core';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { aria, type ImageEvent, type ImageProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

interface FakeLoader {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  srcValue: string;
}

let loaders: FakeLoader[] = [];

class FakeImage {
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public srcValue = '';

  public constructor() {
    loaders.push(this);
  }

  public set src(value: string) {
    this.srcValue = value;
  }
}

describe('Image - Coverage (lifecycle guards & parity)', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    loaders = [];
  });

  it('loads custom hosts through the unit-owned loader and invalidates stale eras', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        vi.stubGlobal('Image', FakeImage);
        const props = mutable<ImageProps>({ src: '/avatars/a.png', alt: 'Avatar A' });
        const image = aria('image', props);
        const content = aria<HTMLDivElement>('image-content');
        const fallback = aria('image-fallback');

        const containerEl = bind(document.createElement('div'), image);
        const divEl = bind(document.createElement('div'), content);
        const fallbackEl = bind(document.createElement('div'), fallback);

        const commits: unknown[] = [];
        containerEl.addEventListener('change', (event) =>
          commits.push((event as ImageEvent).detail),
        );

        // Custom attach spins an owned loader carrying the declared source
        expect(loaders).toHaveLength(1);
        expect(loaders[0].srcValue).toBe('/avatars/a.png');
        expect(divEl.getAttribute('aria-hidden')).toBe('true');
        expect(divEl.hasAttribute('role')).toBe(false);

        // A replacement source abandons the in-flight era: its late result commits nothing
        props.src = '/avatars/b.png';
        expect(image.status).toBe('loading');
        expect(loaders).toHaveLength(2);
        loaders[0].onload?.();
        loaders[0].onerror?.();
        expect(image.status).toBe('loading');
        expect(commits).toEqual([]);

        // The current era settles and the fallback withdraws
        loaders[1].onload?.();
        expect(image.status).toBe('loaded');
        expect(commits).toEqual(['loaded']);
        expect(divEl.getAttribute('role')).toBe('img');
        expect(divEl.getAttribute('aria-label')).toBe('Avatar A');
        expect(fallbackEl.hasAttribute('aria-label')).toBe(false);
        expect(fallbackEl.getAttribute('aria-hidden')).toBe('true');

        image.destroy();
        content.destroy();
        fallback.destroy();
      });
    }));

  it('reports owned loader failures and returns to idle when the source is withdrawn', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        vi.stubGlobal('Image', FakeImage);
        const props = mutable<ImageProps>({ src: '/avatars/a.png', alt: 'Avatar A' });
        const image = aria('image', props);
        const content = aria<HTMLDivElement>('image-content');
        const fallback = aria('image-fallback');

        const containerEl = bind(document.createElement('div'), image);
        bind(document.createElement('div'), content);
        const fallbackEl = bind(document.createElement('div'), fallback);

        const commits: unknown[] = [];
        containerEl.addEventListener('change', (event) =>
          commits.push((event as ImageEvent).detail),
        );

        loaders[0].onerror?.();
        expect(image.status).toBe('error');
        expect(fallbackEl.getAttribute('role')).toBe('img');
        expect(fallbackEl.getAttribute('aria-label')).toBe('Avatar A');

        props.src = undefined;
        expect(image.status).toBe('idle');
        expect(fallbackEl.getAttribute('role')).toBe('img');
        expect(commits).toEqual(['error', 'idle']);

        image.destroy();
        content.destroy();
        fallback.destroy();
      });
    }));

  it('settles cached native images on mount through the loading transition', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const image = aria('image', { src: '/art.png', alt: 'Abstract art' });
        const content = aria('image-content');
        const fallback = aria('image-fallback');

        bind(document.createElement('div'), image);
        const imgEl = document.createElement('img');
        Object.defineProperty(imgEl, 'complete', { value: true, configurable: true });
        Object.defineProperty(imgEl, 'naturalWidth', { value: 200, configurable: true });
        bind(imgEl, content);
        const fallbackEl = bind(document.createElement('div'), fallback);

        // Mount observation settles a cached image instead of stranding it in loading
        expect(image.status).toBe('loaded');
        expect(imgEl.getAttribute('alt')).toBe('Abstract art');
        expect(imgEl.hasAttribute('role')).toBe(false);
        expect(imgEl.hasAttribute('aria-hidden')).toBe(false);
        expect(fallbackEl.hasAttribute('aria-label')).toBe(false);

        image.destroy();
        content.destroy();
        fallback.destroy();

        const broken = aria('image', { src: '/gone.png', alt: 'Gone' });
        const brokenContent = aria('image-content');
        const brokenFallback = aria('image-fallback');

        bind(document.createElement('div'), broken);
        const brokenEl = document.createElement('img');
        Object.defineProperty(brokenEl, 'complete', { value: true, configurable: true });
        Object.defineProperty(brokenEl, 'naturalWidth', { value: 0, configurable: true });
        bind(brokenEl, brokenContent);
        const brokenFallbackEl = bind(document.createElement('div'), brokenFallback);

        expect(broken.status).toBe('error');
        expect(brokenFallbackEl.getAttribute('aria-label')).toBe('Gone');

        broken.destroy();
        brokenContent.destroy();
        brokenFallback.destroy();
      });
    }));

  it('ignores results from departed elements and duplicate settlements', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const image = aria('image', { src: '/art.png', alt: 'Abstract art' });
        const content = aria('image-content');

        const containerEl = bind(document.createElement('div'), image);
        const imgEl = bind(document.createElement('img'), content);

        const commits: unknown[] = [];
        containerEl.addEventListener('change', (event) =>
          commits.push((event as ImageEvent).detail),
        );

        // A repeated settlement for the same era commits nothing twice
        imgEl.dispatchEvent(new Event('load'));
        imgEl.dispatchEvent(new Event('load'));
        expect(image.status).toBe('loaded');
        expect(commits).toEqual(['loaded']);

        // Detaching unregisters the element: its late events commit nothing
        content.ref(null);
        imgEl.dispatchEvent(new Event('error'));
        expect(image.status).toBe('loaded');
        expect(commits).toEqual(['loaded']);

        image.destroy();
        content.destroy();
      });
    }));

  it('ignores an author-pushed status and derives the lifecycle from the source', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const forced = aria('image', { src: '/art.png', alt: 'Abstract art', status: 'error' });
        expect(forced.status).toBe('loading');
        forced.destroy();

        const sourceless = aria('image', { alt: 'Abstract art', status: 'loaded' });
        expect(sourceless.status).toBe('idle');
        sourceless.destroy();
      });
    }));

  it('keeps content and fallback inert without an enclosing image', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const content = aria<HTMLDivElement>('image-content');
        const fallback = aria('image-fallback');

        const divEl = bind(document.createElement('div'), content);
        const fallbackEl = bind(document.createElement('div'), fallback);

        expect(divEl.getAttribute('aria-hidden')).toBe('true');
        expect(divEl.hasAttribute('role')).toBe(false);
        expect(fallbackEl.getAttribute('aria-hidden')).toBe('true');
        expect(fallbackEl.hasAttribute('role')).toBe(false);

        content.destroy();
        fallback.destroy();
      });
    }));

  it('treats a bare image without props as idle and decorative', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const image = aria('image', undefined as unknown as ImageProps);
        const content = aria<HTMLDivElement>('image-content');
        const fallback = aria('image-fallback');

        expect(image.status).toBe('idle');

        const divEl = bind(document.createElement('div'), content);
        const fallbackEl = bind(document.createElement('div'), fallback);
        expect(divEl.getAttribute('aria-hidden')).toBe('true');
        expect(fallbackEl.getAttribute('aria-hidden')).toBe('true');

        image.destroy();
        content.destroy();
        fallback.destroy();
      });
    }));

  it('binds late custom content without flipping a settled result', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        vi.stubGlobal('Image', FakeImage);
        const image = aria('image', { src: '/avatars/a.png', alt: 'Avatar A' });
        const settled = aria('image-content');
        const fallback = aria('image-fallback');

        bind(document.createElement('div'), image);
        const imgEl = bind(document.createElement('img'), settled);
        const fallbackEl = bind(document.createElement('div'), fallback);

        imgEl.dispatchEvent(new Event('error'));
        expect(image.status).toBe('error');
        expect(loaders).toHaveLength(0);

        // A custom host bound after settlement starts no loader and flips nothing
        const late = aria<HTMLDivElement>('image-content');
        const lateEl = bind(document.createElement('div'), late);
        expect(loaders).toHaveLength(0);
        expect(image.status).toBe('error');
        expect(fallbackEl.getAttribute('aria-label')).toBe('Avatar A');
        expect(lateEl.getAttribute('aria-hidden')).toBe('true');

        image.destroy();
        settled.destroy();
        fallback.destroy();
        late.destroy();
      });
    }));

  it('keeps sibling image units independent', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const imageA = aria('image', { src: '/avatars/a.png', alt: 'Avatar A' });
        const contentA = aria('image-content');
        const fallbackA = aria('image-fallback');
        const imageB = aria('image', { src: '/avatars/b.png', alt: 'Avatar B' });
        const contentB = aria('image-content');
        const fallbackB = aria('image-fallback');

        bind(document.createElement('div'), imageA);
        const imgA = bind(document.createElement('img'), contentA);
        const fallbackElA = bind(document.createElement('div'), fallbackA);
        bind(document.createElement('div'), imageB);
        const imgB = bind(document.createElement('img'), contentB);
        const fallbackElB = bind(document.createElement('div'), fallbackB);

        imgA.dispatchEvent(new Event('load'));
        expect(imageA.status).toBe('loaded');
        expect(imageB.status).toBe('loading');
        expect(fallbackElA.hasAttribute('aria-label')).toBe(false);
        expect(fallbackElB.getAttribute('aria-label')).toBe('Avatar B');
        expect(imgA.getAttribute('alt')).toBe('Avatar A');
        expect(imgB.getAttribute('alt')).toBe('Avatar B');

        imageA.destroy();
        contentA.destroy();
        fallbackA.destroy();
        imageB.destroy();
        contentB.destroy();
        fallbackB.destroy();
      });
    }));

  it('discovers the container through ambient context outside the scope chain', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const stray = aria<HTMLDivElement>('image-content');
        const image = aria('image', { src: '/art.png', alt: 'Abstract art' });
        const late = aria<HTMLDivElement>('image-content');

        const strayEl = bind(document.createElement('div'), stray);
        expect(strayEl.getAttribute('aria-hidden')).toBe('true');

        bind(document.createElement('div'), image);
        const lateEl = bind(document.createElement('div'), late);
        lateEl.dispatchEvent(new Event('load'));
        expect(image.status).toBe('loaded');
        expect(lateEl.getAttribute('role')).toBe('img');

        stray.destroy();
        image.destroy();
        late.destroy();
      });
    }));

  it('constructs without frozen reactive reads in setup-like context', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const reads: string[] = [];
        const restore = setStaticTracker((_init, key) => {
          if (typeof key === 'symbol') return;
          reads.push(String(key));
        });
        try {
          const image = aria('image', { src: '/art.png', alt: 'Art' });
          const content = aria('image-content');
          const fallback = aria('image-fallback');
          image.destroy();
          content.destroy();
          fallback.destroy();
        } finally {
          restore();
        }
        expect(reads).toEqual([]);
      });
    }));

  it('compiles attributes without the HTMLImageElement global', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        vi.stubGlobal('HTMLImageElement', undefined);
        try {
          const image = aria('image', { src: '/art.png', alt: 'Art' });
          const content = aria<HTMLImageElement>('image-content');
          const fallback = aria('image-fallback');
          expect(() => content.attributes).not.toThrow();
          expect(image.status).toBe('loading');
          expect(fallback.attributes.role).toBe('img');
          image.destroy();
          content.destroy();
          fallback.destroy();
        } finally {
          vi.unstubAllGlobals();
        }
      });
    }));

  it('hides native content from assistive technology until it settles', () =>
    scope.run(() => {
      const tree = component();
      tree.run(() => {
        const image = aria('image', { src: '/art.png', alt: 'Abstract art' });
        const content = aria('image-content');

        bind(document.createElement('div'), image);
        const imgEl = bind(document.createElement('img'), content);

        expect(image.status).toBe('loading');
        expect(imgEl.getAttribute('src')).toBe('/art.png');
        expect(imgEl.getAttribute('alt')).toBe('Abstract art');
        expect(imgEl.getAttribute('aria-hidden')).toBe('true');
        expect(imgEl.hasAttribute('role')).toBe(false);

        image.destroy();
        content.destroy();
      });
    }));
});

  describe('Attribute Shielding Contract', () => {
    const shieldScope = createLifecycle();

    afterAll(() => {
      shieldScope.destroy();
    });

    it('exposes controller-managed keys on ownKeys for rest-prop omission', () =>
      shieldScope.run(() => {
        component().run(() => {
          const image = aria('image', { src: 'cover.webp', alt: 'Cover' });

          for (const key of ['src', 'alt', 'status']) {
            expect(image.ownKeys).toContain(key);
          }

          image.destroy();
          expect(image.current).toBeNull();
        });
      }));
  });
