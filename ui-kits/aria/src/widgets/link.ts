import { linkCtx } from '../context.js';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';

/**
 * Reactive input properties for LinkAria.
 */
export interface LinkProps extends AriaProps {
  /**
   * Target resource URL.
   */
  href?: string;

  /**
   * Target browsing context.
   */
  target?: string;

  /**
   * Whether the link is disabled from user interaction.
   */
  disabled?: boolean;

  /**
   * Current-page override. When undefined, matches href against ambient linkCtx.
   */
  current?: boolean;
}

/**
 * Behavioral configuration options for LinkAria.
 */
export interface LinkOptions extends AriaOptions {}

/**
 * Compiled HTML and ARIA attributes for a link element.
 *
 * @template E - Target Element type (defaults to HTMLAnchorElement)
 */
export interface LinkAttributes<E extends BaseElement = HTMLAnchorElement> extends AriaAttributes<E> {
  role?: 'link';
  href?: string;
  target?: string;
  tabindex?: number;
  'aria-disabled'?: 'true' | 'false';
  'aria-current'?: 'page';
}

/**
 * Headless WAI-ARIA link controller projecting navigation semantics onto a native
 * anchor, or polyfilling role, focus, and Enter activation on non-native elements.
 * Anchors expose no native disabled state, so disabling withholds the href and
 * blocks activation while still announcing `aria-disabled`.
 *
 * @template E - Target Element type (defaults to HTMLAnchorElement)
 * @template T - Reactive props type
 * @template A - Attributes dictionary type
 * @template O - Options configuration type
 */
export class LinkAria<
  E extends BaseElement = HTMLAnchorElement,
  T extends LinkProps = LinkProps,
  A extends LinkAttributes<E> = LinkAttributes<E>,
  O extends LinkOptions = LinkOptions,
> extends Aria<E, T, A, O> {
  public constructor(props: Partial<T> = {}, options: O = {} as O) {
    super(props, {
      native: true,
      ...options,
    });

    this.omittedAttrs.push('href', 'target', 'current', 'aria-disabled', 'aria-current');
    this.update();
  }

  /**
   * Target resource URL. Kept while disabled so the link stays discoverable;
   * navigation is suppressed via preventDefault instead.
   */
  public get href(): string | undefined {
    return this.props.href;
  }

  /**
   * Whether the link represents the current page, via explicit override
   * or ambient URL match.
   */
  public get isCurrent(): boolean {
    if (this.props.current !== undefined) return this.props.current;
    const url = linkCtx.get()?.url;
    return !!this.props.href && url === this.props.href;
  }

  /**
   * Whether the link is disabled from user interaction.
   */
  public get disabled(): boolean {
    return !!this.props.disabled;
  }

  /**
   * Computes the HTML, ARIA, and event handler attributes for the link.
   *
   * @returns Link attributes dictionary
   */
  protected override createAttributes(): A {
    const isDisabled = this.disabled;
    const attrs = Object.assign(super.createAttributes(), {
      href: this.href,
      target: this.props.target,
      'aria-disabled': ariaBoolean(isDisabled),
      'aria-current': this.isCurrent ? 'page' : undefined,
      tabindex: isDisabled ? -1 : undefined,
      onclick: this.handleClick,
      onauxclick: this.handleClick,
    });

    if (this.isNative) {
      return attrs as A;
    }

    return Object.assign(attrs, {
      role: 'link',
      tabindex: isDisabled ? -1 : 0,
      onclick: this.handleCustomClick,
      onauxclick: this.handleCustomAuxClick,
      onkeydown: this.handleKey,
    }) as A;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.disabled) return;
    event.preventDefault();
  };

  private readonly handleCustomAuxClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    if (event.button !== 1 || event.defaultPrevented) return;
    const href = this.props.href;
    if (!href) return;
    const target = this.props.target ?? '_blank';
    const host = this.element;
    queueMicrotask(() => {
      if (event.defaultPrevented || this.element !== host) return;
      event.preventDefault();
      window.open(href, target);
    });
  };

  private readonly handleCustomClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    const href = this.props.href;
    if (!href) return;

    const explicitTarget = this.props.target;
    const newTabGesture = event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1;
    const target = explicitTarget ?? (newTabGesture ? '_blank' : '_self');
    const host = this.element;
    queueMicrotask(() => {
      if (event.defaultPrevented || this.element !== host) return;
      window.open(href, target);
    });
  };

  private readonly handleKey = (event: KeyboardEvent): void => {
    if (this.disabled || event.defaultPrevented || event.key !== 'Enter') return;

    event.preventDefault();
    (event.currentTarget as HTMLElement)?.click?.();
  };
}
