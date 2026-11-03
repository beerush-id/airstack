import { createContext } from '@airlib/core';
import { Aria } from '../core.js';
import type { AriaAttributes, AriaOptions, AriaProps, BaseElement, Orientation } from '../types.js';
import { handleRovingKey } from '../utils/navigation.js';

/**
 * CSS selector matching the enabled links a navigation group roves across.
 */
export const NAV_LINK_SELECTOR = ['a[href]', '[role="link"]'].map((s) => `${s}:not([aria-disabled="true"])`).join(',');

/**
 * Reactive input properties for NavigationAria.
 */
export interface NavigationProps extends AriaProps {
  /**
   * Accessible name for the navigation landmark.
   */
  label?: string;

  /**
   * Element ID providing the accessible name.
   */
  labelledby?: string;
}

/**
 * Compiled HTML and ARIA attributes for a navigation container.
 *
 * @template E - Target Element type
 */
export interface NavigationAttributes<E extends BaseElement = HTMLElement> extends AriaAttributes<E> {
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Ambient instance context for the enclosing navigation group.
 */
export const navCtx = createContext<NavigationBase>();

/**
 * Baseline roving link group: labels the navigation landmark and moves DOM focus across
 * the enabled links it contains, wrapping at both ends. Holds no `update()` call so a
 * subclass compiles its attributes only after its own inputs are initialized.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export abstract class NavigationBase<
  E extends BaseElement = HTMLElement,
  T extends NavigationProps = NavigationProps,
  A extends NavigationAttributes<E> = NavigationAttributes<E>,
> extends Aria<E, T, A> {
  public constructor(props: Partial<T>, options: AriaOptions) {
    super(props, options);

    navCtx.set(this as unknown as NavigationBase);
    this.omittedAttrs.push('label', 'labelledby');

    this.on('keydown', (event) => {
      handleRovingKey(this.element, event, {
        manual: true,
        selector: NAV_LINK_SELECTOR,
        orientation: this.orientation,
      });
    });
  }

  /**
   * Accessible name for the navigation landmark.
   */
  public get label(): string | undefined {
    return this.properties.label ?? this.defaultLabel;
  }

  /**
   * Axis the arrow keys travel along.
   */
  protected get orientation(): Orientation {
    return 'horizontal';
  }

  /**
   * Accessible name used when the author provides none.
   */
  protected get defaultLabel(): string | undefined {
    return undefined;
  }

  /**
   * Computes HTML and ARIA attributes for the navigation container.
   *
   * @returns Navigation attributes dictionary
   */
  protected override createAttributes(): A {
    return {
      role: this.isNative ? undefined : 'navigation',
      'aria-label': this.label,
      'aria-labelledby': this.properties.labelledby,
    } as A;
  }
}

/**
 * Headless navigation group: a roving collection of links published under a navigation
 * landmark, travelling vertically by default.
 *
 * @template E - Target Element type (defaults to HTMLElement)
 * @template T - Reactive props type
 * @template A - Compiled attributes dictionary type
 */
export class NavigationAria<
  E extends BaseElement = HTMLElement,
  T extends NavigationProps = NavigationProps,
  A extends NavigationAttributes<E> = NavigationAttributes<E>,
> extends NavigationBase<E, T, A> {
  public constructor(props: Partial<T> = {}, options: AriaOptions = { native: true }) {
    super(props, options);
    this.update();
  }

  protected override get orientation(): Orientation {
    return 'vertical';
  }
}
