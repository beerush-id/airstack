import { mutable } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, DetachFn } from '../types.js';
import { ariaBoolean } from '../utils/attributes.js';

/**
 * A controller whose element can fill the screen: an image viewer, a stage player. A full-screen
 * toggle inside it finds it through the scope chain, past any toolbar in between.
 */
export interface FullscreenHost {
  readonly fullscreenHost: true;
}

/**
 * Reactive input properties for FullscreenToggleAria.
 */
export interface FullscreenToggleProps extends AriaProps {
  disabled?: boolean;
}

/**
 * Compiled HTML and ARIA attributes for a full-screen toggle button.
 */
export interface FullscreenToggleAttributes<E extends BaseElement = HTMLButtonElement> extends AriaAttributes<E> {
  type?: 'button';
  role?: 'button';
  tabindex?: number;
  disabled?: boolean;
  'aria-pressed'?: 'true' | 'false';
}

const FALLBACK_ATTR = 'data-fullscreen';

/**
 * Button that takes its enclosing full-screen host to full screen and back. It uses the browser's
 * full-screen mode where there is one; elsewhere it marks the host so styles can fill the window
 * with it, and Escape brings it back. Pressed while full screen, so its state is announced.
 */
export class FullscreenToggleAria<E extends BaseElement = HTMLButtonElement> extends Aria<
  E,
  FullscreenToggleProps,
  FullscreenToggleAttributes<E>
> {
  /**
   * Whether the host fills the screen right now.
   */
  public state = mutable({ active: false });

  public constructor(props: Partial<FullscreenToggleProps> = {}, options: AriaOptions = { native: true }) {
    super(props, { ...options, clickable: true });
    this.omittedAttrs.push('type', 'role', 'tabindex', 'disabled', 'aria-pressed');
    this.update();
  }

  /**
   * The element that goes full screen: the nearest full-screen host up the scope chain.
   */
  public get host(): HTMLElement | null {
    let scope = this.scope as (Aria<BaseElement> & Partial<FullscreenHost>) | undefined;
    while (scope && !scope.fullscreenHost) scope = scope.scope as typeof scope;
    return (scope?.current as HTMLElement | null | undefined) ?? null;
  }

  /**
   * Takes the host to full screen, or brings it back.
   */
  public toggle(): void {
    const host = this.host;
    if (!host || this.properties.disabled) return;

    if (this.state.active) {
      if (document.fullscreenElement) void document.exitFullscreen();
      else this.setFallback(host, false);
      return;
    }

    if (host.requestFullscreen) {
      host.requestFullscreen().catch(() => this.setFallback(host, true));
    } else {
      this.setFallback(host, true);
    }
  }

  protected override createAttributes(): FullscreenToggleAttributes<E> {
    const disabled = !!this.properties.disabled;
    const attrs: FullscreenToggleAttributes<E> = {
      'aria-pressed': ariaBoolean(this.state.active) as 'true' | 'false',
      onclick: this.handleClick,
    };

    if (this.isNative) {
      attrs.type = 'button';
      if (disabled) attrs.disabled = true;
    } else {
      attrs.role = 'button';
      attrs.tabindex = disabled ? -1 : 0;
    }

    return attrs;
  }

  protected override attach(): DetachFn | void {
    const sync = (): void => {
      this.state.active = !!document.fullscreenElement && document.fullscreenElement === this.host;
    };
    const escape = (event: KeyboardEvent): void => {
      const host = this.host;
      if (event.key !== 'Escape' || !host?.hasAttribute(FALLBACK_ATTR)) return;
      this.setFallback(host, false);
    };

    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('keydown', escape);
    };
  }

  /**
   * Fills the window without the browser's full-screen mode. The host goes to the top layer, as
   * full screen itself does, so no ancestor — a blurred glass pane, a transform — can hold a
   * fixed position inside its own box.
   */
  private setFallback(host: HTMLElement, active: boolean): void {
    if (active) {
      host.setAttribute(FALLBACK_ATTR, 'true');
      host.setAttribute('popover', 'manual');
      host.showPopover?.();
    } else {
      if (host.matches(':popover-open')) host.hidePopover();
      host.removeAttribute('popover');
      host.removeAttribute(FALLBACK_ATTR);
    }
    this.state.active = active;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    this.toggle();
  };
}
