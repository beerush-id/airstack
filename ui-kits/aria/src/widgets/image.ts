import { $static, createContext, effect } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaEvent, AriaEventHandler, AriaOptions, AriaProps, BaseElement } from '../types.js';

/**
 * Ambient instance context for the enclosing Image orchestrator.
 */
export const imageCtx = createContext<ImageAria>();

/**
 * Reported source lifecycle of an image unit.
 */
export type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Controller-dispatched image event carrying the lifecycle status in `detail`.
 */
export type ImageEvent = AriaEvent<ImageStatus>;

/**
 * Reactive input properties for ImageAria.
 */
export interface ImageProps extends AriaProps {
  /**
   * Called with the loader status after each status transition.
   */
  onchange?: AriaEventHandler<ImageEvent>;
  /**
   * Image source URL.
   */
  src?: string;

  /**
   * Alternative text (empty string indicates decorative).
   */
  alt: string;

  /**
   * Reported source lifecycle. Read-only channel; assigning it never drives loading.
   */
  status?: ImageStatus;
}

/**
 * Compiled attributes for an image container element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface ImageAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  /** The source lifecycle, for styles to decide which representation shows. */
  'data-status'?: ImageStatus;
}

/**
 * Compiled HTML and ARIA attributes for an image content element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface ImageContentAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'img';
  src?: string;
  alt?: string;
  'aria-label'?: string;
  'aria-hidden'?: 'true';
}

/**
 * Compiled HTML and ARIA attributes for an image fallback element.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 */
export interface ImageFallbackAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: 'img';
  'aria-label'?: string;
  'aria-hidden'?: 'true';
}

interface ContentRecord {
  epoch: number;
}

/**
 * Resolves the enclosing image orchestrator by walking the ambient scope chain,
 * falling back to the published instance context.
 *
 * @param scope - Ambient scope captured at construction
 * @returns The enclosing image unit, if any
 */
function isImageElement(element: unknown): boolean {
  return (element as { tagName?: unknown } | null | undefined)?.tagName === 'IMG';
}

function resolveImageHost(scope: unknown): ImageAria | undefined {
  let current = scope as { scope?: unknown } | undefined;
  while (current) {
    if (current instanceof ImageAria) return current;
    current = current.scope as { scope?: unknown } | undefined;
  }
  return imageCtx.get();
}

/**
 * Headless image loading and fallback coordinator hosting ambient source and
 * status state. Absent source commits idle; a declared source commits loading,
 * then loaded or error as the unit's loader settles. Every source change opens
 * a new lifecycle epoch that invalidates older async results.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ImageAria<
  E extends BaseElement = HTMLElement,
  T extends ImageProps = ImageProps,
  A extends ImageAttributes<E> = ImageAttributes<E>,
  O extends AriaOptions = AriaOptions,
> extends Aria<E, T, A, O> {
  private appliedSrc: string | undefined;
  private epoch = 0;
  private readonly records = new Map<BaseElement, ContentRecord>();

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    imageCtx.set(this as unknown as ImageAria);
    this.omittedAttrs.push('src', 'alt', 'status', 'onchange');

    $static(() => {
      this.appliedSrc = this.properties.src;
      this.properties.status = this.properties.src ? 'loading' : 'idle';
    });
    effect(() => {
      this.syncSource();
    });
    this.update();
  }

  /**
   * Reported source lifecycle.
   */
  public get status(): ImageStatus {
    return this.properties.status as ImageStatus;
  }

  /**
   * Computes the attributes for the image container. The container carries no
   * accessibility semantics of its own; it coordinates lifecycle and publishes
   * it as `data-status`, so what shows on screen can differ from what assistive
   * technology is told: a picture may show while loading, before it is announced.
   *
   * @returns Image container attributes dictionary
   */
  protected override createAttributes(): A {
    return { 'data-status': this.status } as A;
  }

  /**
   * Registers a bound content element for lifecycle reporting and custom-host loading.
   *
   * @param element - The bound content element
   */
  public registerContent(element: BaseElement): void {
    this.records.set(element, { epoch: this.epoch });
    this.restartOwnedLoader(element);
  }

  /**
   * Unregisters a content element so late results from it commit nothing.
   *
   * @param element - The departing content element
   */
  public unregisterContent(element: BaseElement): void {
    this.records.delete(element);
  }

  /**
   * Accepts a settled result from a registered content element.
   *
   * @param element - The reporting content element
   * @param outcome - Settled result
   */
  public reportElement(element: BaseElement, outcome: 'loaded' | 'error'): void {
    if (!this.records.has(element)) return;
    this.commit(outcome);
  }

  private syncSource(): void {
    const src = this.properties.src;
    if (src === this.appliedSrc) return;
    this.appliedSrc = src;
    this.epoch += 1;
    const epoch = this.epoch;
    this.commit(src ? 'loading' : 'idle');
    for (const [element, record] of this.records) {
      record.epoch = epoch;
      this.restartOwnedLoader(element);
    }
  }

  private commit(status: ImageStatus): void {
    if (this.properties.status === status) return;
    this.properties.status = status;
    const host = this.element;
    if (host) {
      const event: ImageEvent = new CustomEvent('change', { bubbles: true, detail: status, cancelable: true });
      host.dispatchEvent(event);
      this.properties.onchange?.(event);
    }
  }

  private restartOwnedLoader(element: BaseElement): void {
    if (isImageElement(element)) return;
    const src = this.properties.src;
    if (!src || this.status !== 'loading') return;
    const epoch = this.epoch;
    const loader = new Image();
    loader.onload = () => {
      if (epoch !== this.epoch) return;
      this.commit('loaded');
    };
    loader.onerror = () => {
      if (epoch !== this.epoch) return;
      this.commit('error');
    };
    loader.src = src;
  }
}

/**
 * Headless visual image element exposing the loaded representation. Native
 * `<img>` hosts keep native semantics with projected source and label; custom
 * hosts compile the image role once loaded. Inactive or decorative content is
 * excluded from assistive technology while staying loading-eligible.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ImageContentAria<
  E extends BaseElement = HTMLElement,
  T extends AriaProps = AriaProps,
  A extends ImageContentAttributes<E> = ImageContentAttributes<E>,
  O extends AriaOptions = AriaOptions,
> extends Aria<E, T, A, O> {
  private readonly host?: ImageAria;

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.host = resolveImageHost(this.scope);
    this.update();
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the content element.
   *
   * @returns Image content attributes dictionary
   */
  protected override createAttributes(): A {
    const host = this.host;
    const src = host?.properties.src;
    const alt = host?.properties.alt ?? '';
    const loaded = (host?.status ?? 'idle') === 'loaded';
    const decorative = alt === '';
    const known = { src, alt };
    const handlers = {
      onload: this.handleLoad,
      onerror: this.handleError,
    };

    if (isImageElement(this.element)) {
      return Object.assign(super.createAttributes(), known, handlers, {
        'aria-hidden': !loaded || decorative ? ('true' as const) : undefined,
      }) as A;
    }

    if (loaded && !decorative) {
      return Object.assign(super.createAttributes(), known, { role: 'img' as const, 'aria-label': alt }, handlers) as A;
    }

    return Object.assign(super.createAttributes(), known, { 'aria-hidden': 'true' as const }, handlers) as A;
  }

  /**
   * Binds loader reporting and mount settlement for the content element.
   *
   * @returns Detachment cleanup unbinding the element from the lifecycle
   */
  protected override attach(): (() => void) | void {
    const host = this.host;
    const element = this.element;
    if (!host || !element) return;
    host.registerContent(element);
    const nativeElement = element as unknown as HTMLImageElement;
    if (isImageElement(element) && host.status === 'loading' && nativeElement.complete) {
      host.reportElement(element, nativeElement.naturalWidth === 0 ? 'error' : 'loaded');
    }
    return () => {
      host.unregisterContent(element);
    };
  }

  private readonly handleLoad = (): void => {
    this.host?.reportElement(this.element as BaseElement, 'loaded');
  };

  private readonly handleError = (): void => {
    this.host?.reportElement(this.element as BaseElement, 'error');
  };
}

/**
 * Headless fallback representation element carrying the shared label while it
 * is the active representation. Exposed during idle, loading, and error;
 * withdrawn once content settles and for decorative images.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class ImageFallbackAria<
  E extends BaseElement = HTMLElement,
  T extends AriaProps = AriaProps,
  A extends ImageFallbackAttributes<E> = ImageFallbackAttributes<E>,
  O extends AriaOptions = AriaOptions,
> extends Aria<E, T, A, O> {
  private readonly host?: ImageAria;

  public get initial() {
    return initialsOf(this.host?.properties.alt ?? '');
  }

  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, options);
    this.host = resolveImageHost(this.scope);
    this.update();
  }

  /**
   * Computes the HTML and ARIA attributes for the fallback element.
   *
   * @returns Image fallback attributes dictionary
   */
  protected override createAttributes(): A {
    const host = this.host;
    const alt = host?.properties.alt ?? '';
    const status = host?.status ?? 'idle';
    const active = status === 'idle' || status === 'loading' || status === 'error';

    if (active && alt !== '') {
      return {
        role: 'img',
        'aria-label': alt,
      } as A;
    }

    return {
      'aria-hidden': 'true',
    } as A;
  }
}

const initialsOf = (label: string) => {
  const words = label.toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const [word] = words;
  const letters = [word[0], words.length === 1 ? word[1] : words[1]?.[0]];
  return letters.filter(Boolean).join('');
};
