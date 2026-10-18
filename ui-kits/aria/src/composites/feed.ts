import { $static, $symbol, createContext, uIndex } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';

const ROLE_FEED = 'feed';
const ROLE_ARTICLE = 'article';
const ARTICLE_SELECTOR = 'article, [role="article"]';
const KEY_PAGE_DOWN = 'PageDown';
const KEY_PAGE_UP = 'PageUp';
const KEY_HOME = 'Home';
const KEY_END = 'End';

/**
 * Reactive input properties for FeedAria.
 */
export interface FeedProps extends AriaProps {
  /**
   * Optional DOM element identifier.
   */
  id?: string;

  /**
   * Accessible name announced for the feed container.
   */
  label?: string;

  /**
   * Element ID providing accessible name.
   */
  labelledby?: string;

  /**
   * Indicates whether the feed is currently loading new articles (`aria-busy="true"`).
   */
  busy?: boolean;

  /**
   * Total count of articles in the feed, or -1 if unknown.
   * Articles within the feed inherit this value unless explicitly overridden.
   *
   * @default -1
   */
  setsize?: number;
}

/**
 * Compiled HTML and ARIA attributes for a feed container element.
 *
 * @template E - Target Element type
 */
export interface FeedAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  id?: string;
  role: 'feed';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-busy'?: 'true' | 'false';
}

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
 * Ambient context contract for the enclosing Feed orchestrator.
 */
export interface FeedContext {
  id: string;
  setsize: number;
}

/**
 * Ambient instance context for the enclosing Feed orchestrator.
 */
export const feedCtx = createContext<FeedAria>();

/**
 * Headless stream container orchestrator that manages infinite feed articles,
 * tracks active article focus across dynamic additions, and delegates stream navigation.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class FeedAria<
  E extends BaseElement = HTMLElement,
  T extends FeedProps = FeedProps,
  A extends FeedAttributes<E> = FeedAttributes<E>,
> extends Aria<E, T, A> {
  public get id(): string {
    return this.properties.id!;
  }

  public articles = 0;

  /**
   * Total count of articles in the feed, or -1 if unknown.
   */
  public get setsize(): number {
    return this.properties.setsize!;
  }

  /**
   * Whether the feed is currently loading new content.
   */
  public get busy(): boolean {
    return !!this.properties.busy;
  }

  public constructor(props: Partial<T> = {}, options: AriaOptions = {}) {
    super(props, options);

    $static(() => {
      this.properties.id = this.properties.id ?? `${ROLE_FEED}-${uIndex($symbol(ROLE_FEED), true)}`;
      if (this.properties.setsize == null) this.properties.setsize = -1;
    });

    feedCtx.set(this as never);
    this.omittedAttrs.push('id', 'label', 'labelledby', 'busy', 'setsize');
    this.on('keydown', this.handleKeyDown);
    this.update();
  }

  protected handleKeyDown = (event: KeyboardEvent): void => {
    /* istanbul ignore if */
    if (!this.element) return;

    const key = event.key;
    const isCtrl = event.ctrlKey || event.metaKey;

    if (key !== KEY_PAGE_DOWN && key !== KEY_PAGE_UP && key !== KEY_HOME && key !== KEY_END) {
      return;
    }

    if ((key === KEY_HOME || key === KEY_END) && !isCtrl) {
      return;
    }

    if ((key === KEY_PAGE_DOWN || key === KEY_PAGE_UP) && isCtrl) {
      return;
    }

    const items = Array.from(this.element.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR));
    if (items.length === 0) return;

    const target = event.target as HTMLElement | null;
    const currentArticle = target?.closest<HTMLElement>(ARTICLE_SELECTOR);
    if (!currentArticle || !items.includes(currentArticle)) return;

    const currentIndex = items.indexOf(currentArticle);

    if (key === KEY_PAGE_DOWN) {
      if (currentIndex < items.length - 1) {
        items[currentIndex + 1].focus();
        event.preventDefault();
      }
    } else if (key === KEY_PAGE_UP) {
      if (currentIndex > 0) {
        items[currentIndex - 1].focus();
        event.preventDefault();
      }
    } else if (key === KEY_HOME) {
      items[0].focus();
      event.preventDefault();
      event.stopPropagation();
    } else {
      items[items.length - 1].focus();
      event.preventDefault();
      event.stopPropagation();
    }
  };

  protected override createAttributes(): A {
    return {
      id: this.properties.id,
      role: ROLE_FEED,
      'aria-label': this.properties.label,
      'aria-labelledby': this.properties.labelledby,
      'aria-busy': ariaBoolean(this.properties.busy),
    } as A;
  }
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
