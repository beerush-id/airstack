import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type ImageEvent, type ImageProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Image - Contract Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Accessible Representation & Fallback Lifecycle Invariant', () => {
    it('exposes exactly one representation as the source settles and announces each commit', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ImageProps>({ alt: 'Portrait of a sailor' });
          const image = aria('image', props);
          const content = aria('image-content');
          const fallback = aria('image-fallback');

          // 1. Creation & SSR: no source means idle, and the fallback carries the label
          expect(image.status).toBe('idle');
          expect(fallback.attributes.role).toBe('img');
          expect(fallback.attributes['aria-label']).toBe('Portrait of a sailor');

          const host = document.createElement('div');
          document.body.appendChild(host);

          const containerEl = document.createElement('div');
          const imgEl = document.createElement('img');
          const fallbackEl = document.createElement('div');
          host.appendChild(containerEl);
          host.appendChild(imgEl);
          host.appendChild(fallbackEl);

          image.ref(containerEl);
          const contentEl = bind(imgEl, content);
          bind(fallbackEl, fallback);

          const commits: Array<{ detail: unknown; bubbles: boolean }> = [];
          containerEl.addEventListener('change', (event) =>
            commits.push({
              detail: (event as ImageEvent).detail,
              bubbles: event.bubbles,
            })
          );

          // 2. Idle: the fallback is the accessible representation
          expect(fallbackEl.getAttribute('role')).toBe('img');
          expect(fallbackEl.getAttribute('aria-label')).toBe('Portrait of a sailor');

          // 3. A source arrives: loading keeps the fallback live and announces the commit
          props.src = '/avatars/sailor.png';
          expect(image.status).toBe('loading');
          expect(contentEl.getAttribute('src')).toBe('/avatars/sailor.png');
          expect(commits).toEqual([{ detail: 'loading', bubbles: true }]);

          // 4. Settled: content becomes the representation and the fallback withdraws
          contentEl.dispatchEvent(new Event('load'));
          expect(image.status).toBe('loaded');
          expect(commits).toEqual([
            { detail: 'loading', bubbles: true },
            { detail: 'loaded', bubbles: true },
          ]);
          expect(fallbackEl.hasAttribute('aria-label')).toBe(false);

          image.destroy();
          content.destroy();
          fallback.destroy();
          document.body.removeChild(host);
        });
      }));

    it('returns the fallback on error and restarts the cycle on a new source', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ImageProps>({
            src: '/avatars/missing.png',
            alt: 'Missing avatar',
          });
          const image = aria('image', props);
          const content = aria('image-content');
          const fallback = aria('image-fallback');

          const imgEl = bind(document.createElement('img'), content);
          const fallbackEl = bind(document.createElement('div'), fallback);

          expect(image.status).toBe('loading');

          imgEl.dispatchEvent(new Event('error'));
          expect(image.status).toBe('error');
          expect(fallbackEl.getAttribute('role')).toBe('img');
          expect(fallbackEl.getAttribute('aria-label')).toBe('Missing avatar');

          // A replacement source reopens the cycle instead of staying errored
          props.src = '/avatars/found.png';
          expect(image.status).toBe('loading');
          expect(fallbackEl.getAttribute('aria-label')).toBe('Missing avatar');

          imgEl.dispatchEvent(new Event('load'));
          expect(image.status).toBe('loaded');
          expect(fallbackEl.hasAttribute('aria-label')).toBe(false);

          image.destroy();
          content.destroy();
          fallback.destroy();
        });
      }));
  });

  describe('Host Parity & Presentation Invariant', () => {
    it('leaves native image semantics to the element and adds a role only to a custom host', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const nativeImage = aria('image', { src: '/art.png', alt: 'Abstract art' });
          const nativeContent = aria('image-content');
          const imgEl = bind(document.createElement('img'), nativeContent);

          expect(nativeImage.status).toBe('loading');

          imgEl.dispatchEvent(new Event('load'));
          expect(nativeImage.status).toBe('loaded');

          // A native <img> needs no role; the alt is the accessible name
          expect(imgEl.hasAttribute('role')).toBe(false);
          expect(imgEl.getAttribute('alt')).toBe('Abstract art');

          nativeImage.destroy();
          nativeContent.destroy();

          // A custom host has no implicit semantics to inherit once the loader settles
          const customImage = aria('image', {
            src: '/art.png',
            alt: 'Abstract art',
          });
          const customContent = aria<HTMLDivElement>('image-content');
          const divEl = bind(document.createElement('div'), customContent);

          divEl.dispatchEvent(new Event('load'));
          expect(customImage.status).toBe('loaded');
          expect(divEl.getAttribute('role')).toBe('img');
          expect(divEl.getAttribute('aria-label')).toBe('Abstract art');

          customImage.destroy();
          customContent.destroy();
        });
      }));

    it('supplies semantics only and never prescribes presentation', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const image = aria('image', { src: '/art.png', alt: 'Abstract art' });
          const content = aria('image-content');
          const fallback = aria('image-fallback');

          const parts = [image, content, fallback];

          for (const part of parts) {
            expect(part.attributes.class).toBeUndefined();
            expect(part.attributes.className).toBeUndefined();
            expect(part.attributes.style).toBeUndefined();
          }

          const containerEl = bind(document.createElement('div'), image);
          const imgEl = bind(document.createElement('img'), content);
          const fallbackEl = bind(document.createElement('div'), fallback);

          expect(containerEl.hasAttribute('class')).toBe(false);
          expect(containerEl.hasAttribute('style')).toBe(false);
          expect(imgEl.hasAttribute('class')).toBe(false);
          expect(fallbackEl.hasAttribute('class')).toBe(false);

          image.destroy();
          content.destroy();
          fallback.destroy();
        });
      }));
  });

  describe('Inertness & Decorative Exclusion Invariant', () => {
    it('excludes both representations from the accessibility tree for an empty alt', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const image = aria('image', { src: '/rule.png', alt: '' });
          const nativeContent = aria('image-content');
          const customContent = aria<HTMLDivElement>('image-content');

          // Native: alt="" is the platform's decorative marker, so the element stays unlabeled
          const imgEl = bind(document.createElement('img'), nativeContent);
          imgEl.dispatchEvent(new Event('load'));
          expect(image.status).toBe('loaded');
          expect(imgEl.getAttribute('alt')).toBe('');
          expect(imgEl.hasAttribute('role')).toBe(false);
          expect(imgEl.hasAttribute('aria-label')).toBe(false);

          // Custom host: no role="img" is compiled, because the image is decorative
          const divEl = bind(document.createElement('div'), customContent);
          expect(divEl.hasAttribute('role')).toBe(false);
          expect(divEl.hasAttribute('aria-label')).toBe(false);

          image.destroy();
          nativeContent.destroy();
          customContent.destroy();

          // Fallback: while it is the active representation, an empty label announces nothing
          const errored = aria('image', { src: '/gone.png', alt: '' });
          const erroredContent = aria('image-content');
          const fallback = aria('image-fallback');
          const erroredImgEl = bind(document.createElement('img'), erroredContent);
          const fallbackEl = bind(document.createElement('div'), fallback);
          erroredImgEl.dispatchEvent(new Event('error'));
          expect(errored.status).toBe('error');
          expect(fallbackEl.hasAttribute('role')).toBe(false);
          expect(fallbackEl.hasAttribute('aria-label')).toBe(false);

          errored.destroy();
          erroredContent.destroy();
          fallback.destroy();
        });
      }));

    it('owns no interaction across the container, content, and fallback', () =>
      scope.run(() => {
        const tree = component();
        tree.run(() => {
          const props = mutable<ImageProps>({ src: '/art.png', alt: 'Abstract art' });
          const image = aria('image', props);
          const content = aria('image-content');
          const fallback = aria('image-fallback');

          const containerEl = bind(document.createElement('div'), image);
          const imgEl = bind(document.createElement('img'), content);
          const fallbackEl = bind(document.createElement('div'), fallback);

          for (const el of [containerEl, imgEl, fallbackEl]) {
            expect(el.hasAttribute('tabindex')).toBe(false);
            expect(image.attributes.tabindex).toBeUndefined();

            const keydown = new KeyboardEvent('keydown', {
              key: 'Enter',
              cancelable: true,
              bubbles: true,
            });
            el.dispatchEvent(keydown);
            expect(keydown.defaultPrevented).toBe(false);

            const click = new MouseEvent('click', { cancelable: true, bubbles: true });
            el.dispatchEvent(click);
            expect(click.defaultPrevented).toBe(false);
          }

          expect(image.status).toBe('loading');

          image.destroy();
          content.destroy();
          fallback.destroy();
          expect(image.current).toBeNull();
        });
      }));
  });
});
