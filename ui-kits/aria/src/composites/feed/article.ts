import { $static } from '@airlib/core';
import { Aria } from '../../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../../types.js';
import { feedCtx } from './feed.js';

const ROLE_ARTICLE = 'article';
/**
 * Configuration options for FeedArticleAria.
 */
export interface FeedArticleOptions extends AriaOptions {
  /**
   * Whether bound to a native `<article>` element.
   * When true, `role="article"` is omitted.
   * @default true
   */
  native?: boolean;
}

/**
 * Reactive input properties for FeedArticleAria.
 */
export interface FeedArticleProps extends AriaProps {
  id?: string;
  /**
   * 1-based position within the feed.
   */
  posinset?: number;
}

/**
 * Compiled HTML and ARIA attributes for a feed article element.
 *
 * @template E - Target Element type
 */
export interface FeedArticleAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'article';
  'aria-posinset'?: number;
  'aria-setsize'?: number;
}

/**
 * Headless stream entry controller representing an individual article inside a feed.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class FeedArticleAria<
  E extends BaseElement = HTMLElement,
  T extends FeedArticleProps = FeedArticleProps,
  A extends FeedArticleAttributes<E> = FeedArticleAttributes<E>,
> extends Aria<E, T, A, FeedArticleOptions> {
  protected feed = feedCtx.get();

  public get id() {
    return this.properties.id!;
  }

  public constructor(props: Partial<T> = {}, options: FeedArticleOptions = { native: true }) {
    super(props, { native: true, ...options });

    $static(() => {
      if (!this.feed) return;
      this.properties.id = this.properties.id ?? `${ROLE_ARTICLE}-${(this.feed.articles += 1)}`;
    });

    this.omittedAttrs.push('id', 'posinset');
    this.update();
  }

  protected override createAttributes(): A {
    return {
      id: this.feed ? `${this.feed.id}-${this.id}` : undefined,
      role: this.isNative ? undefined : ROLE_ARTICLE,
      'aria-setsize': this.feed?.setsize ?? -1,
      'aria-posinset': this.properties.posinset,
    } as A;
  }
}
