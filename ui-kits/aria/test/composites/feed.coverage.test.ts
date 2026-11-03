import { createLifecycle } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, FeedAria, FeedArticleAria } from '../../src/index.js';
import { bind, component } from '../utils.js';

describe('Feed - Coverage & Edge Cases', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Feed Container Guards & Edge Cases', () => {
    it('handles busy, setsize getters, and custom id attribute compilation', () =>
      scope.run(() => {
        component().run(() => {
          const feed = new FeedAria({ id: 'stream-feed', busy: true, setsize: 25 });
          expect(feed.busy).toBe(true);
          expect(feed.setsize).toBe(25);

          const el = bind(document.createElement('div'), feed);
          expect(el.getAttribute('id')).toBe('stream-feed');
          expect(el.getAttribute('aria-busy')).toBe('true');
          expect(el.hasAttribute('aria-setsize')).toBe(false);

          const idleFeed = new FeedAria({ busy: false });
          expect(idleFeed.busy).toBe(false);
          expect(idleFeed.setsize).toBe(-1);

          feed.destroy();
          idleFeed.destroy();
        });
      }));

    it('ignores navigation keys when feed has no articles', () =>
      scope.run(() => {
        component().run(() => {
          const feed = aria('feed');
          const feedEl = bind(document.createElement('div'), feed);
          document.body.appendChild(feedEl);

          const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
          feedEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          feed.destroy();
          feedEl.remove();
        });
      }));

    it('ignores non-stream keys and modified page keys', () =>
      scope.run(() => {
        component().run(() => {
          const feed = aria('feed');
          const feedEl = bind(document.createElement('div'), feed);
          document.body.appendChild(feedEl);

          const article = aria('feed-article');
          const articleEl = bind(document.createElement('article'), article);
          articleEl.tabIndex = -1;
          feedEl.appendChild(articleEl);

          // Arrow key (not a stream key)
          const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          articleEl.dispatchEvent(arrow);
          expect(arrow.defaultPrevented).toBe(false);

          // Ctrl + PageDown is ignored per spec (PageDown must be unmodified)
          const ctrlPageDown = new KeyboardEvent('keydown', {
            key: 'PageDown',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          articleEl.dispatchEvent(ctrlPageDown);
          expect(ctrlPageDown.defaultPrevented).toBe(false);

          // Ctrl + PageUp is ignored per spec
          const ctrlPageUp = new KeyboardEvent('keydown', {
            key: 'PageUp',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          articleEl.dispatchEvent(ctrlPageUp);
          expect(ctrlPageUp.defaultPrevented).toBe(false);

          // PageUp on the first article has nowhere further to go
          const pageUp = new KeyboardEvent('keydown', {
            key: 'PageUp',
            bubbles: true,
            cancelable: true,
          });
          articleEl.dispatchEvent(pageUp);
          expect(pageUp.defaultPrevented).toBe(false);

          feed.destroy();
          feedEl.remove();
        });
      }));

    it('ignores keydown when target is the feed container itself without an article match', () =>
      scope.run(() => {
        component().run(() => {
          const feed = aria('feed');
          const feedEl = bind(document.createElement('div'), feed);
          document.body.appendChild(feedEl);

          const article = aria('feed-article');
          const articleEl = bind(document.createElement('article'), article);
          feedEl.appendChild(articleEl);

          const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: false, cancelable: true });
          feedEl.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);

          feed.destroy();
          feedEl.remove();
        });
      }));

    it('cleans up context on destroy correctly', () =>
      scope.run(() => {
        component().run(() => {
          const feed1 = new FeedAria();
          const feed2 = new FeedAria();

          feed1.destroy();
          feed2.destroy();
        });
      }));
  });

  describe('FeedArticle Standalone & Custom Host Edge Cases', () => {
    it('handles instantiation without enclosing feed context', () =>
      scope.run(() => {
        component().run(() => {
          const standalone = new FeedArticleAria();
          const el = bind(document.createElement('article'), standalone);

          expect(el.hasAttribute('aria-posinset')).toBe(false);
          expect(el.getAttribute('aria-setsize')).toBe('-1');
          expect(el.hasAttribute('role')).toBe(false);
          expect(el.hasAttribute('id')).toBe(false);

          standalone.destroy();
        });
      }));

    it('respects explicit props on custom hosts without parent feed', () =>
      scope.run(() => {
        component().run(() => {
          const custom = new FeedArticleAria({ posinset: 5 }, { native: false });
          const el = bind(document.createElement('div'), custom);

          expect(el.getAttribute('role')).toBe('article');
          expect(el.getAttribute('aria-posinset')).toBe('5');
          expect(el.getAttribute('aria-setsize')).toBe('-1');
          expect(el.hasAttribute('id')).toBe(false);

          custom.destroy();
        });
      }));
  });
});
