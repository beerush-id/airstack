import { aria } from '@airlib/aria';
import { AUI_CLASS, register } from '@airlib/aui/utils';
import { type AnyType, setup } from '@airlib/react';
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
  children?: ReactNode;
};

const FEED_ROLE = 'feed';
const ARTICLE_ROLE = 'feed-article';

register('feed', {});
register('feedArticle', {});

/**
 * Named stream of entries that grows while the reader moves through it. The
 * container carries the role and the run's size; `PageDown` and `PageUp` hand
 * focus from one entry to the next.
 */
export const Feed = setup<FeedProps>((props) => {
  const feed = aria(FEED_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.FEED, props, auiConfig.feed);

  return () => (
    <div ref={feed.ref} {...feed.restProps([...OMIT_KEYS, 'labelledby'])} className={className()}>
      {props.children}
    </div>
  );
}, 'Feed');

/**
 * One entry in the run. A real `<article>` keeps its native role while the
 * feed supplies the size and the entry states its own position.
 */
export const FeedArticle = setup<FeedArticleProps>((props) => {
  const article = aria(ARTICLE_ROLE, props as AnyType);
  const className = () => $families(AUI_CLASS.FEED_ARTICLE, props, auiConfig.feedArticle);

  return () => (
    <article ref={article.ref} {...article.restProps(OMIT_KEYS)} tabIndex={-1} className={className()}>
      {props.children}
    </article>
  );
}, 'FeedArticle');
