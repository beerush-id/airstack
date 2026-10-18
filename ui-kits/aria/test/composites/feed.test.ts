import { createLifecycle, mutable } from '@airlib/core';
import { afterAll, describe, expect, it } from 'vitest';
import { aria, type FeedArticleAria, type FeedProps } from '../../src/index.js';
import { bind, component } from '../utils.js';

function buildFeed(props: Partial<FeedProps>, count: number, host: 'native' | 'custom' = 'native') {
  const feed = aria('feed', props as FeedProps);
  const feedEl = bind(document.createElement('div'), feed);
  document.body.appendChild(feedEl);

  const articles: Array<{ article: FeedArticleAria; el: HTMLElement }> = [];

  for (let index = 0; index < count; index += 1) {
    const article = host === 'native' ? aria('feed-article') : aria<HTMLElement>('feed-article', {}, { native: false });

    const el = bind(document.createElement(host === 'native' ? 'article' : 'div'), article);
    el.tabIndex = -1;
    feedEl.appendChild(el);
    articles.push({ article, el });
  }

  const appendArticle = (host: 'native' | 'custom' = 'native') => {
    const article = host === 'native' ? aria('feed-article') : aria<HTMLElement>('feed-article', {}, { native: false });

    const el = bind(document.createElement(host === 'native' ? 'article' : 'div'), article);
    el.tabIndex = -1;
    feedEl.appendChild(el);
    articles.push({ article, el });
    return { article, el };
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
        component().run(() => {
          const { feedEl, articles, cleanup } = buildFeed({ label: 'Timeline', setsize: 4 }, 4);

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
        });
      }));

    it('assigns feed-scoped IDs to articles and keeps the set size uniform', () =>
      scope.run(() => {
        component().run(() => {
          const { feed, articles, appendArticle, cleanup } = buildFeed({ setsize: 10 }, 3);

          const ids = articles.map(({ el }) => el.id);
          expect(ids).toEqual([`${feed.id}-article-1`, `${feed.id}-article-2`, `${feed.id}-article-3`]);

          const sizes = articles.map(({ el }) => el.getAttribute('aria-setsize'));
          expect(sizes).toEqual(['10', '10', '10']);

          // A late arrival gets the next ID and the same uniform set size
          const fourth = appendArticle();
          expect(fourth.el.id).toBe(`${feed.id}-article-4`);
          expect(fourth.el.getAttribute('aria-setsize')).toBe('10');

          cleanup();
        });
      }));

    it('lets an article declare its own position and id', () =>
      scope.run(() => {
        component().run(() => {
          const feed = aria('feed', { setsize: 50 });
          const feedEl = bind(document.createElement('section'), feed);
          document.body.appendChild(feedEl);

          const declared = aria('feed-article', { id: 'custom-entry', posinset: 12 });
          const declaredEl = bind(document.createElement('article'), declared);
          feedEl.appendChild(declaredEl);

          const sibling = aria('feed-article');
          const siblingEl = bind(document.createElement('article'), sibling);
          feedEl.appendChild(siblingEl);

          expect(declaredEl.id).toBe(`${feed.id}-custom-entry`);
          expect(declaredEl.getAttribute('aria-posinset')).toBe('12');
          expect(declaredEl.getAttribute('aria-setsize')).toBe('50');

          expect(siblingEl.id).toBe(`${feed.id}-article-1`);
          expect(siblingEl.hasAttribute('aria-posinset')).toBe(false);
          expect(siblingEl.getAttribute('aria-setsize')).toBe('50');

          declared.destroy();
          sibling.destroy();
          feed.destroy();
          feedEl.remove();
        });
      }));
  });

  describe('Dynamic Item Insertion & Focus Stability Invariant', () => {
    it('keeps the reader on the same article when the stream grows in either direction', () =>
      scope.run(() => {
        component().run(() => {
          const { articles, appendArticle, prependArticle, cleanup } = buildFeed({}, 3);

          articles[1].el.focus();
          const anchor = document.activeElement;

          appendArticle();
          expect(document.activeElement).toBe(anchor);

          prependArticle();
          expect(document.activeElement).toBe(anchor);

          // The article under focus keeps its identity across the reshuffle
          expect(anchor).toBe(articles[1].el);

          cleanup();
        });
      }));

    it('announces a fetch as busy state and withdraws it when the batch lands', () =>
      scope.run(() => {
        component().run(() => {
          const props = mutable<FeedProps>({ label: 'Inbox', busy: false });
          const { feedEl, articles, appendArticle, cleanup } = buildFeed(props, 2);

          expect(feedEl.getAttribute('aria-busy')).toBe('false');

          props.busy = true;
          expect(feedEl.getAttribute('aria-busy')).toBe('true');

          articles[0].el.focus();
          const anchor = document.activeElement;

          // A page arrives while the reader is mid-stream
          appendArticle();
          expect(document.activeElement).toBe(anchor);

          props.busy = false;
          expect(feedEl.getAttribute('aria-busy')).toBe('false');

          cleanup();
        });
      }));
  });

  describe('Article Scope & Semantic Boundary Invariant', () => {
    it('compiles the feed role on every host and the article role only where it is not implicit', () =>
      scope.run(() => {
        component().run(() => {
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
        });
      }));

    it('leaves content interaction inside an article to that content', () =>
      scope.run(() => {
        component().run(() => {
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
        });
      }));
  });
});
