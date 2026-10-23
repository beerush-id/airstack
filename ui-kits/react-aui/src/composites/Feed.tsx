import { aria } from '@airlib/aria';
import { AUI_CLASS, branded, register } from '@airlib/aui/utils';
import { type AnyType, setup, uIndex } from '@airlib/react';
import type { ReactNode } from 'react';
import { $families, auiConfig, type ComponentStyles, OMIT_KEYS } from '../config.js';

export type FeedProps = ComponentStyles & {
  id?: string;
  label?: string;
  labelledby?: string;
  busy?: boolean;
  setsize?: number;
  children?: ReactNode;
};

export type FeedArticleProps = ComponentStyles & {
  id?: string;
  posinset?: number;
  /** What the entry is: a headline, a change, an event. It also names the article. */
  title?: string;
  /** One quiet line under the title: when, by whom, where. */
  meta?: string;
  /** The entry's body: text, links, images. */
  children?: ReactNode;
};

const FEED_ROLE = 'feed';
const ARTICLE_ROLE = 'feed-article';
const ARTICLE_SYMBOL = Symbol('aui-feed-article');

const CLASS = {
  TITLE: branded('feed-article-title'),
  META: branded('feed-article-meta'),
  LOADING: branded('feed-loading'),
};

register('feed', {});
register('feedArticle', {});

/**
 * Named stream of entries that grows while the reader moves through it. The
 * container carries the role and the run's size; `PageDown` and `PageUp` hand
 * focus from one entry to the next. While `busy`, a placeholder entry stands
 * where the next batch will land.
 */
export const Feed = setup<FeedProps>((props) => {
  const feed = aria(FEED_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.FEED, props, auiConfig.feed);

  return () => (
    <div ref={feed.ref} {...feed.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
      {/* Seen, not read: the feed's `aria-busy` already tells assistive technology a batch is coming. */}
      {props.busy && (
        <div className={CLASS.LOADING} aria-hidden="true">
          <div className="aui-skeleton text-title-md" />
          <div className="aui-skeleton-lines" style={{ '--aui-skeleton-lines': 2 } as never} />
        </div>
      )}
    </div>
  );
}, 'Feed');

/**
 * One entry in the run. A real `<article>` keeps its native role while the
 * feed supplies the size and the entry states its own position. With `title`
 * it heads the entry and names it, `meta` sits quietly under it, and the
 * children are the body.
 */
export const FeedArticle = setup<FeedArticleProps>((props) => {
  const article = aria(ARTICLE_ROLE, props as AnyType);
  // A counter in render order, the same on the server and in the browser, so the id hydrates.
  const titleId = `aui-feed-article-${uIndex(ARTICLE_SYMBOL, true)}-title`;
  const className = () => $families(AUI_CLASS.FEED_ARTICLE, props, auiConfig.feedArticle);

  return () => (
    <article
      ref={article.ref}
      {...article.restProps([...OMIT_KEYS, 'title', 'meta'])}
      aria-labelledby={props.title ? titleId : undefined}
      className={className()}
    >
      {props.title && (
        <div id={titleId} className={CLASS.TITLE}>
          {props.title}
        </div>
      )}
      {props.meta && <div className={CLASS.META}>{props.meta}</div>}
      {props.children}
    </article>
  );
}, 'FeedArticle');
