import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FeedProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildFeed(props: Partial<FeedProps>, count: number, host: 'native' | 'custom' = 'native') {
  const feed = aria('feed', props as FeedProps);
  const feedEl = bind(document.createElement('div'), feed);
  document.body.appendChild(feedEl);

  const articles: Array<{ article: ReturnType<typeof aria>; el: HTMLElement }> = [];

  for (let index = 0; index < count; index += 1) {
    const slot = component();
    const built = slot.run(() => {
      const article =
        host === 'native' ? aria('feed-article') : aria<HTMLElement>('feed-article', {}, { native: false });

      const el = bind(document.createElement(host === 'native' ? 'article' : 'div'), article);
      el.tabIndex = -1;
      feedEl.appendChild(el);
      return { article, el };
    });

    articles.push(built);
  }

  const appendArticle = (host: 'native' | 'custom' = 'native') => {
    const slot = component();
    return slot.run(() => {
      const article =
        host === 'native' ? aria('feed-article') : aria<HTMLElement>('feed-article', {}, { native: false });

      const el = bind(document.createElement(host === 'native' ? 'article' : 'div'), article);
      el.tabIndex = -1;
      feedEl.appendChild(el);
      articles.push({ article, el });
      return { article, el };
    });
  };

  const prependArticle = () => {
    const built = appendArticle();
    feedEl.insertBefore(built.el, feedEl.firstElementChild);
    return built;
  };

  const cleanup = () => {
    for (const { article } of articles) {
      article.destroy();
    }

    feed.destroy();
    feedEl.remove();
  };

  return { feed, feedEl, articles, appendArticle, prependArticle, cleanup };
}

function press(el: HTMLElement, key: string, ctrlKey = false) {
  const event = new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('Feed - Composite Specifications', () => {
  const scope = createLifecycle();

  afterAll(() => {
    scope.destroy();
  });

  describe('Infinite Stream Navigation & Virtualization Invariant', () => {
    it('travels the stream a page at a time and to either end with Ctrl held', () =>
      scope.run(() => {
        const { feedEl, articles, cleanup } = buildFeed({ label: 'Timeline' }, 4);

        articles[0].el.focus();

        expect(press(articles[0].el, 'PageDown').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(articles[1].el);

        press(articles[1].el, 'PageDown');
        expect(document.activeElement).toBe(articles[2].el);

        press(articles[2].el, 'PageUp');
        expect(document.activeElement).toBe(articles[1].el);

        press(articles[1].el, 'End', true);
        expect(document.activeElement).toBe(articles[3].el);

        // The last article has nowhere further to fall
        expect(press(articles[3].el, 'PageDown').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(articles[3].el);

        press(articles[3].el, 'Home', true);
        expect(document.activeElement).toBe(articles[0].el);

        // An unmodified Home is the browser's to keep
        expect(press(articles[0].el, 'Home').defaultPrevented).toBe(false);

        feedEl.remove();
        cleanup();
      }));

    it('assigns one-based positions from the parent and keeps the set size uniform', () =>
      scope.run(() => {
        const { articles, appendArticle, cleanup } = buildFeed({}, 3);

        const positions = articles.map(({ el }) => Number(el.getAttribute('aria-posinset')));
        expect(positions).toEqual([1, 2, 3]);

        const sizes = articles.map(({ el }) => el.getAttribute('aria-setsize'));
        expect(new Set(sizes).size).toBe(1);
        expect(sizes[0]).not.toBeNull();

        // A late arrival takes the next position and the set size follows for everyone
        const fifth = appendArticle();
        expect(fifth.el.getAttribute('aria-posinset')).toBe('4');
        expect(articles[0].el.getAttribute('aria-setsize')).toBe(fifth.el.getAttribute('aria-setsize'));

        cleanup();
      }));

    it('lets an article declare its own position and set size', () =>
      scope.run(() => {
        const feed = aria('feed');
        const feedEl = bind(document.createElement('section'), feed);
        document.body.appendChild(feedEl);

        const declared = component().run(() => {
          const article = aria('feed-article', { posinset: 12, setsize: -1 });
          const el = bind(document.createElement('article'), article);
          feedEl.appendChild(el);
          return { article, el };
        });

        const sibling = component().run(() => {
          const article = aria('feed-article');
          const el = bind(document.createElement('article'), article);
          feedEl.appendChild(el);
          return { article, el };
        });

        expect(declared.el.getAttribute('aria-posinset')).toBe('12');
        expect(declared.el.getAttribute('aria-setsize')).toBe('-1');
        expect(sibling.el.getAttribute('aria-posinset')).not.toBe('12');

        declared.article.destroy();
        sibling.article.destroy();
        feed.destroy();
        feedEl.remove();
      }));
  });

  describe('Dynamic Item Insertion & Focus Stability Invariant', () => {
    it('keeps the reader on the same article when the stream grows in either direction', () =>
      scope.run(() => {
        const { articles, appendArticle, prependArticle, cleanup } = buildFeed({}, 3);

        articles[1].el.focus();
        const anchor = document.activeElement;

        appendArticle();
        expect(document.activeElement).toBe(anchor);

        prependArticle();
        expect(document.activeElement).toBe(anchor);

        // The article under focus keeps its identity across the reshuffle
        expect(anchor?.getAttribute('aria-posinset')).toBe('2');

        cleanup();
      }));

    it('announces a fetch as busy state and withdraws it when the batch lands', () =>
      scope.run(() => {
        const props = mutable<FeedProps>({ label: 'Inbox', busy: false });
        const { feedEl, articles, appendArticle, cleanup } = buildFeed(props, 2);

        expect(feedEl.getAttribute('aria-busy')).toBe('false');

        props.busy = true;
        expect(feedEl.getAttribute('aria-busy')).toBe('true');

        articles[0].el.focus();
        const anchor = document.activeElement;

        // A page arrives while the reader is mid-stream
        const added = appendArticle();
        expect(added.el.getAttribute('aria-posinset')).toBe('3');
        expect(document.activeElement).toBe(anchor);

        props.busy = false;
        expect(feedEl.getAttribute('aria-busy')).toBe('false');

        cleanup();
      }));
  });

  describe('Article Scope & Semantic Boundary Invariant', () => {
    it('compiles the feed role on every host and the article role only where it is not implicit', () =>
      scope.run(() => {
        const { feedEl, articles, cleanup } = buildFeed({ label: 'Discussion' }, 2);

        expect(feedEl.getAttribute('role')).toBe('feed');
        expect(feedEl.getAttribute('aria-label')).toBe('Discussion');

        // A native <article> already is an article
        expect(articles[0].el.hasAttribute('role')).toBe(false);

        cleanup();

        const custom = buildFeed({ labelledby: 'feed-heading' }, 1, 'custom');
        expect(custom.feedEl.getAttribute('aria-labelledby')).toBe('feed-heading');
        expect(custom.articles[0].el.getAttribute('role')).toBe('article');
        custom.cleanup();
      }));

    it('leaves content interaction inside an article to that content', () =>
      scope.run(() => {
        const { feedEl, articles, cleanup } = buildFeed({}, 2);

        const link = document.createElement('a');
        link.href = '/posts/1';
        link.textContent = 'Read more';
        articles[0].el.appendChild(link);
        document.body.appendChild(feedEl);

        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);

        // Only the stream keys are claimed, and only from inside an article
        expect(press(link, 'PageDown').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(articles[1].el);

        cleanup();
      }));
  });
});
